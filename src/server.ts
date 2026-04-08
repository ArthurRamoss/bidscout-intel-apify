/**
 * BidScout Intel — Apify Actor
 *
 * Federal procurement intelligence:
 * - search_federal_opportunities (SAM.gov)
 * - detect_incumbents (USASpending)
 * - analyze_competitive_landscape (USASpending)
 *
 * Supports both batch mode (Apify input) and Standby mode (HTTP API).
 */

import { Actor } from "apify";
import express, { type Request, type Response } from "express";
import { handleToolCall } from "./tools/handlers.js";

interface ActorInput {
  action: "search_opportunities" | "detect_incumbents" | "competitive_landscape";
  keyword?: string;
  naicsCode?: string;
  agency?: string;
  setAside?: string;
  state?: string;
  postedWithinDays?: number;
  expiringWithinMonths?: number;
  lookbackYears?: number;
}

const ACTION_TO_TOOL: Record<string, string> = {
  search_opportunities: "search_federal_opportunities",
  detect_incumbents: "detect_incumbents",
  competitive_landscape: "analyze_competitive_landscape",
};

function buildToolArgs(input: ActorInput): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (input.keyword) args.keyword = input.keyword;
  if (input.naicsCode) args.naicsCode = input.naicsCode;
  if (input.agency) args.agency = input.agency;
  if (input.setAside) args.setAside = input.setAside;
  if (input.state) args.state = input.state;
  if (input.postedWithinDays) args.postedWithinDays = input.postedWithinDays;
  if (input.expiringWithinMonths) args.expiringWithinMonths = input.expiringWithinMonths;
  if (input.lookbackYears) args.lookbackYears = input.lookbackYears;
  if (input.agency && input.action === "competitive_landscape") {
    args.agencyFilter = input.agency;
  }
  return args;
}

async function runAnalysis(input: ActorInput) {
  const toolName = ACTION_TO_TOOL[input.action];
  if (!toolName) {
    throw new Error(`Unknown action: ${input.action}. Valid: ${Object.keys(ACTION_TO_TOOL).join(", ")}`);
  }
  const args = buildToolArgs(input);
  return await handleToolCall(toolName, args);
}

// ==========================================================================
// Standby HTTP Server
// ==========================================================================

function createHttpServer() {
  const app = express();
  app.use(express.json());

  app.get("/", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      actor: "bidscout-intel",
      version: "1.0.0",
      mode: "standby",
      actions: Object.keys(ACTION_TO_TOOL),
      usage: "POST / with { action, keyword?, naicsCode?, ... }",
    });
  });

  app.post("/", async (req: Request, res: Response) => {
    try {
      const input = req.body as ActorInput;
      if (!input.action) {
        res.status(400).json({ error: "Missing required field: action" });
        return;
      }

      const result = await runAnalysis(input);

      await Actor.charge({ eventName: "analysis-completed" });

      res.json({ success: true, action: input.action, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });

  app.post("/search", async (req: Request, res: Response) => {
    try {
      const result = await runAnalysis({ ...req.body, action: "search_opportunities" });
      await Actor.charge({ eventName: "analysis-completed" });
      res.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });

  app.post("/incumbents", async (req: Request, res: Response) => {
    try {
      const result = await runAnalysis({ ...req.body, action: "detect_incumbents" });
      await Actor.charge({ eventName: "analysis-completed" });
      res.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });

  app.post("/landscape", async (req: Request, res: Response) => {
    try {
      const result = await runAnalysis({ ...req.body, action: "competitive_landscape" });
      await Actor.charge({ eventName: "analysis-completed" });
      res.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });

  return app;
}

// ==========================================================================
// Main Actor Entry Point
// ==========================================================================

await Actor.init();

const isStandby = Actor.isAtHome() && Actor.config.get("metamorph") !== undefined
  || process.env.APIFY_IS_AT_HOME === "1";

const port = Actor.isAtHome()
  ? (Actor.config.get("standbyPort") as number) || Number(process.env.ACTOR_STANDBY_PORT) || 3000
  : Number(process.env.PORT) || 3000;

const standbyMode = process.env.ACTOR_STANDBY_PORT || process.env.APIFY_ACTOR_STANDBY_PORT;

if (standbyMode) {
  const app = createHttpServer();
  app.listen(port, () => {
    console.log(`BidScout Intel running in Standby mode on port ${port}`);
    console.log(`POST / with { action, keyword?, naicsCode?, ... }`);
  });
} else {
  const input = await Actor.getInput<ActorInput>();
  if (!input?.action) {
    console.log("No action specified. Running in Standby-ready HTTP mode.");
    const app = createHttpServer();
    app.listen(port, () => {
      console.log(`BidScout Intel HTTP server on port ${port}`);
    });
  } else {
    console.log(`Running analysis: ${input.action}`);
    try {
      const result = await runAnalysis(input);
      await Actor.pushData({ action: input.action, ...result });
      await Actor.charge({ eventName: "analysis-completed" });
      console.log(`Analysis complete. Results pushed to dataset.`);
    } catch (error) {
      console.error("Analysis failed:", error);
      throw error;
    }
    await Actor.exit();
  }
}
