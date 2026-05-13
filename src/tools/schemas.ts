import { z } from "zod";

const naicsCode = z
  .string()
  .regex(/^\d{6}$/, "Must be a 6-digit NAICS code")
  .describe("6-digit NAICS industry code (e.g. '541512')");

export const SearchOpportunitiesArgs = z
  .object({
    keyword: z
      .string()
      .min(1)
      .describe("Search term for opportunity title (e.g. 'cybersecurity', 'cloud migration')"),
    naicsCode: naicsCode.optional(),
    setAside: z
      .enum(["", "SBA", "8A", "WOSB", "SDVOSBC", "HZC"])
      .optional()
      .describe("Set-aside code: SBA, 8A, WOSB, SDVOSBC, HZC, or empty for any"),
    agency: z.string().optional().describe("Federal agency or department name"),
    state: z
      .string()
      .length(2)
      .optional()
      .describe("2-letter US state code for place of performance"),
    postedWithinDays: z
      .number()
      .int()
      .min(1)
      .max(365)
      .default(30)
      .describe("Only return opportunities posted within N days"),
  })
  .describe("Inputs for searching active federal contract opportunities");

export const DetectIncumbentsArgs = z
  .object({
    naicsCode,
    agency: z.string().optional().describe("Federal agency name filter"),
    keyword: z.string().optional().describe("Keyword filter for contract descriptions"),
    expiringWithinMonths: z
      .number()
      .int()
      .min(1)
      .max(36)
      .default(12)
      .describe("Look-ahead window in months for expiring contracts"),
  })
  .describe(
    "Inputs for detecting incumbent contractors with expiring federal contracts and recompete scoring",
  );

export const CompetitiveLandscapeArgs = z
  .object({
    naicsCode,
    lookbackYears: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(3)
      .describe("Years of historical data to analyze"),
    agencyFilter: z.string().optional().describe("Optional federal agency filter"),
  })
  .describe(
    "Inputs for analyzing a competitive landscape (market size, top agencies, top contractors) by NAICS",
  );

export const ARG_SCHEMA = {
  search_federal_opportunities: SearchOpportunitiesArgs,
  detect_incumbents: DetectIncumbentsArgs,
  analyze_competitive_landscape: CompetitiveLandscapeArgs,
} as const;

export type ToolName = keyof typeof ARG_SCHEMA;

export const TOOL_EVENT: Record<ToolName, string> = {
  search_federal_opportunities: "tool-call-search",
  detect_incumbents: "tool-call-incumbents",
  analyze_competitive_landscape: "tool-call-landscape",
};

export const HTTP_ROUTE: Record<ToolName, string> = {
  search_federal_opportunities: "/search",
  detect_incumbents: "/incumbents",
  analyze_competitive_landscape: "/landscape",
};
