// =============================================================================
// Tool 1: search_federal_opportunities
// Source: SAM.gov Opportunities API
// =============================================================================

import type {
  SearchOpportunitiesInput,
  SearchOpportunitiesResult,
} from "../types/index.js";
import { searchOpportunities } from "../api/sam-gov.js";
import { normalizeSAMOpportunity } from "../utils/normalizer.js";
import { nowIso8601 } from "../utils/date-helpers.js";

export async function handleSearchOpportunities(
  args: SearchOpportunitiesInput
): Promise<SearchOpportunitiesResult> {
  // 1. Call SAM.gov API
  const response = await searchOpportunities({
    keyword: args.keyword,
    naicsCode: args.naicsCode,
    setAside: args.setAside,
    agency: args.agency,
    state: args.state,
    postedWithinDays: args.postedWithinDays ?? 30,
    limit: 25,
    offset: 0,
  });

  // 2. Normalize raw opportunities to our schema
  const opportunities = (response.opportunitiesData ?? []).map(
    normalizeSAMOpportunity
  );

  // 3. Generate human-readable summary
  const searchSummary = buildSearchSummary(
    args,
    response.totalRecords,
    opportunities.length
  );

  return {
    totalRecords: response.totalRecords,
    opportunities,
    searchSummary,
    fetchedAt: nowIso8601(),
  };
}

// ---------------------------------------------------------------------------
// Summary generator
// ---------------------------------------------------------------------------

function buildSearchSummary(
  args: SearchOpportunitiesInput,
  total: number,
  returned: number
): string {
  const parts: string[] = [];

  parts.push(
    `Found ${total} federal contract opportunities matching "${args.keyword}"`
  );

  if (args.naicsCode) parts.push(`in NAICS ${args.naicsCode}`);
  if (args.agency) parts.push(`at ${args.agency}`);
  if (args.setAside) parts.push(`with ${args.setAside} set-aside`);
  if (args.state) parts.push(`in ${args.state}`);

  parts.push(
    `posted within the last ${args.postedWithinDays ?? 30} days.`
  );

  if (returned < total) {
    parts.push(`Showing top ${returned} results.`);
  }

  return parts.join(" ");
}
