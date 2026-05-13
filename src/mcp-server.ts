import type { Request, Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Actor } from "apify";
import { ZodError } from "zod";
import { TOOLS } from "./tools/index.js";
import { handleToolCall } from "./tools/handlers.js";
import { ARG_SCHEMA, TOOL_EVENT, type ToolName } from "./tools/schemas.js";

function buildServer(): Server {
  const server = new Server(
    { name: "bidscout-intel", version: "1.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: rawArgs } = req.params;

    if (!(name in ARG_SCHEMA)) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
      };
    }
    const toolName = name as ToolName;

    let args: Record<string, unknown>;
    try {
      args = ARG_SCHEMA[toolName].parse(rawArgs ?? {}) as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof ZodError ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : (err as Error).message;
      return {
        isError: true,
        content: [{ type: "text", text: `Invalid arguments: ${message}` }],
      };
    }

    const result = await handleToolCall(toolName, args);

    const charge = (await Actor.charge({ eventName: TOOL_EVENT[toolName] })) as {
      eventChargeLimitReached?: boolean;
    };
    if (charge?.eventChargeLimitReached) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Budget cap reached for this run. Increase maxTotalChargeUsd to continue.",
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  });

  return server;
}

export async function createMcpHandler(req: Request, res: Response): Promise<void> {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
