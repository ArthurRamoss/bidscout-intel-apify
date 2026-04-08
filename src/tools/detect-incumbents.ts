// =============================================================================
// Tool 2: detect_incumbents ⭐ (CORE — the differentiator)
// Source: USASpending.gov API (no auth required!)
//
// Logic:
//   1. Search awards by NAICS/agency/keyword with wide time window
//   2. Filter to contracts ending within N months from today
//   3. Calculate recompete score for each (pure math)
//   4. Aggregate top incumbents
//   5. Generate strategic insights
//   6. Return structured result matching outputSchema EXACTLY
// =============================================================================

import type {
  DetectIncumbentsInput,
  DetectIncumbentsResult,
} from "../types/index.js";
import { searchAwards } from "../api/usaspending.js";
import {
  normalizeUSASpendingToContract,
  aggregateTopIncumbents,
  generateInsights,
} from "../utils/normalizer.js";
import {
  todayIso,
  monthsFromNowIso,
  nowIso8601,
  monthsAgoIso,
} from "../utils/date-helpers.js";

export async function handleDetectIncumbents(
  args: DetectIncumbentsInput
): Promise<DetectIncumbentsResult> {
  const expiringMonths = args.expiringWithinMonths ?? 12;

  // 1. Fetch awards — wide window: 5 years back to N months ahead
  //    We need contracts that are currently active (started in the past, ending in the future)
  const response = await searchAwards({
    naicsCode: args.naicsCode,
    agency: args.agency || undefined,
    keyword: args.keyword || undefined,
    startDate: monthsAgoIso(60), // 5 years back to catch long-running contracts
    endDate: monthsFromNowIso(expiringMonths),
    limit: 100,
    sort: "Award Amount",
    order: "desc",
  });

  const totalContractsFound = response.results.length;

  // 2. Normalize to our schema
  const allContracts = response.results.map(normalizeUSASpendingToContract);

  // 3. Filter: only contracts expiring within the window (end date between today and N months)
  const today = todayIso();
  const cutoff = monthsFromNowIso(expiringMonths);

  const expiringContracts = allContracts
    .filter((c) => c.endDate >= today && c.endDate <= cutoff)
    .sort((a, b) => b.recompeteScore - a.recompeteScore);

  // 4. Calculate totals
  const totalValueUsd = expiringContracts.reduce(
    (sum, c) => sum + c.awardAmountUsd,
    0
  );

  // 5. Aggregate top incumbents
  const topIncumbents = aggregateTopIncumbents(expiringContracts);

  // 6. Generate strategic insights
  const strategicInsights = generateInsights(expiringContracts, topIncumbents);

  return {
    query: {
      naicsCode: args.naicsCode,
      agency: args.agency ?? "",
      keyword: args.keyword ?? "",
      expiringWithinMonths: expiringMonths,
    },
    totalContractsFound,
    totalValueUsd,
    expiringContracts,
    topIncumbents,
    strategicInsights,
    fetchedAt: nowIso8601(),
  };
}
