/**
 * BidScout Intel — Apify Actor + MCP server
 *
 * Two modes:
 *   - Batch: Actor.getInput() carries an action, run once, push to dataset, exit.
 *   - HTTP (Standby): bind ACTOR_WEB_SERVER_PORT, serve REST routes + native MCP at /mcp.
 *
 * Tool registry is the single source of truth — src/tools/index.ts drives both REST
 * routes (this file) and the MCP server (src/mcp-server.ts) via the maps in
 * src/tools/schemas.ts (ARG_SCHEMA, TOOL_EVENT, HTTP_ROUTE).
 */

import { Actor } from "apify";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { TOOLS } from "./tools/index.js";
import { handleToolCall } from "./tools/handlers.js";
import {
  ARG_SCHEMA,
  HTTP_ROUTE,
  TOOL_EVENT,
  type ToolName,
} from "./tools/schemas.js";
import { createMcpHandler } from "./mcp-server.js";

interface BatchInput {
  action?: "search_opportunities" | "detect_incumbents" | "competitive_landscape";
  keyword?: string;
  naicsCode?: string;
  agency?: string;
  setAside?: string;
  state?: string;
  postedWithinDays?: number;
  expiringWithinMonths?: number;
  lookbackYears?: number;
}

const BATCH_ACTION_TO_TOOL: Record<NonNullable<BatchInput["action"]>, ToolName> = {
  search_opportunities: "search_federal_opportunities",
  detect_incumbents: "detect_incumbents",
  competitive_landscape: "analyze_competitive_landscape",
};

function buildBatchArgs(input: BatchInput, toolName: ToolName): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (input.keyword) args.keyword = input.keyword;
  if (input.naicsCode) args.naicsCode = input.naicsCode;
  if (input.setAside) args.setAside = input.setAside;
  if (input.state) args.state = input.state;
  if (input.postedWithinDays) args.postedWithinDays = input.postedWithinDays;
  if (input.expiringWithinMonths) args.expiringWithinMonths = input.expiringWithinMonths;
  if (input.lookbackYears) args.lookbackYears = input.lookbackYears;
  if (input.agency) {
    if (toolName === "analyze_competitive_landscape") args.agencyFilter = input.agency;
    else args.agency = input.agency;
  }
  if (input.keyword && toolName === "detect_incumbents") args.keyword = input.keyword;
  return args;
}

function createHttpServer() {
  const app = express();

  app.use((req, res, next) => {
    if (req.headers["x-apify-container-server-readiness-probe"]) {
      res.status(200).type("text/plain").send("ready");
      return;
    }
    next();
  });

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      actor: "bidscout-intel",
      version: "1.1.0",
      mode: "http",
      routes: {
        list_tools: "GET /tools",
        mcp: "POST /mcp",
        ...Object.fromEntries(TOOLS.map((t) => [t.name, `POST ${HTTP_ROUTE[t.name as ToolName]}`])),
      },
      mcp_setup: {
        url: process.env.ACTOR_WEB_SERVER_URL
          ? `${process.env.ACTOR_WEB_SERVER_URL}/mcp`
          : "http://localhost:<port>/mcp",
        auth: "Bearer <APIFY_TOKEN>",
      },
    });
  });

  app.get("/tools", (_req: Request, res: Response) => {
    res.json({
      tools: TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        outputSchema: t.outputSchema,
        chargeEvent: TOOL_EVENT[t.name as ToolName],
      })),
    });
  });

  app.post("/mcp", (req: Request, res: Response) => {
    void createMcpHandler(req, res);
  });

  for (const tool of TOOLS) {
    const toolName = tool.name as ToolName;
    const route = HTTP_ROUTE[toolName];
    app.post(route, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const args = ARG_SCHEMA[toolName].parse(req.body ?? {}) as Record<string, unknown>;
        const result = await handleToolCall(toolName, args);
        const charge = (await Actor.charge({ eventName: TOOL_EVENT[toolName] })) as {
          eventChargeLimitReached?: boolean;
        };
        if (charge?.eventChargeLimitReached) {
          res.status(402).json({
            error: "Budget cap reached for this run",
            code: "EVENT_CHARGE_LIMIT_REACHED",
          });
          return;
        }
        res.json({ success: true, tool: toolName, data: result });
      } catch (err) {
        next(err);
      }
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: "Invalid input",
        code: "INVALID_INPUT",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[server] error:", message);
    res.status(500).json({ error: message, code: "INTERNAL" });
  });

  return app;
}

await Actor.init();

const input = await Actor.getInput<BatchInput>();
const hasBatchAction = !!(input && input.action && BATCH_ACTION_TO_TOOL[input.action]);

console.log(
  `[bidscout] mode=${hasBatchAction ? "batch" : "http"} input=${input ? JSON.stringify({ action: input.action }) : "null"} ACTOR_WEB_SERVER_PORT=${process.env.ACTOR_WEB_SERVER_PORT ?? "unset"} ACTOR_WEB_SERVER_URL=${process.env.ACTOR_WEB_SERVER_URL ?? "unset"}`,
);

if (hasBatchAction) {
  const toolName = BATCH_ACTION_TO_TOOL[input!.action!];
  const rawArgs = buildBatchArgs(input!, toolName);

  try {
    const args = ARG_SCHEMA[toolName].parse(rawArgs) as Record<string, unknown>;
    console.log(`[bidscout] running ${toolName} with args=${JSON.stringify(args)}`);
    const result = await handleToolCall(toolName, args);
    await Actor.pushData({ tool: toolName, ...result });
    const charge = (await Actor.charge({ eventName: TOOL_EVENT[toolName] })) as {
      eventChargeLimitReached?: boolean;
    };
    if (charge?.eventChargeLimitReached) {
      console.warn("[bidscout] event charge limit reached after this run");
    }
    console.log(`[bidscout] analysis complete, results pushed to dataset`);
  } catch (err) {
    console.error("[bidscout] batch run failed:", err);
    throw err;
  }
  await Actor.exit();
} else {
  const port = Number(process.env.ACTOR_WEB_SERVER_PORT) || 4321;
  const publicUrl = process.env.ACTOR_WEB_SERVER_URL ?? `http://localhost:${port}`;
  const app = createHttpServer();
  app.listen(port, () => {
    console.log(`[bidscout] listening on ${publicUrl}`);
    console.log(`[bidscout] MCP endpoint: ${publicUrl}/mcp`);
    console.log(`[bidscout] REST routes: GET /tools, POST /search /incumbents /landscape`);
  });
}
