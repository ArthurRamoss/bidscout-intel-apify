// =============================================================================
// Tool Call Router — switch(name) → handler
// =============================================================================

import type {
  ToolName,
  SearchOpportunitiesInput,
  DetectIncumbentsInput,
  CompetitiveLandscapeInput,
} from "../types/index.js";
import { handleSearchOpportunities } from "./search-opportunities.js";
import { handleDetectIncumbents } from "./detect-incumbents.js";
import { handleCompetitiveLandscape } from "./competitive-landscape.js";

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (name as ToolName) {
    case "search_federal_opportunities":
      return (await handleSearchOpportunities(
        args as unknown as SearchOpportunitiesInput
      )) as unknown as Record<string, unknown>;

    case "detect_incumbents":
      return (await handleDetectIncumbents(
        args as unknown as DetectIncumbentsInput
      )) as unknown as Record<string, unknown>;

    case "analyze_competitive_landscape":
      return (await handleCompetitiveLandscape(
        args as unknown as CompetitiveLandscapeInput
      )) as unknown as Record<string, unknown>;

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
