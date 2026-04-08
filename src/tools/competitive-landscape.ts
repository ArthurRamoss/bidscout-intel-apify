// =============================================================================
// Tool 3: analyze_competitive_landscape
// Source: USASpending.gov API (multiple aggregation endpoints, no auth)
//
// Logic:
//   3 API calls in parallel:
//     1. /spending_by_category/awarding_agency/  → topAgencies
//     2. /spending_by_category/recipient_duns/    → topContractors
//     3. /spending_by_award/                      → raw contracts → filter expiring
//   Then: aggregate, generate insights, return structured result
// =============================================================================

import type {
  CompetitiveLandscapeInput,
  CompetitiveLandscapeResult,
  ExpiringContract,
} from "../types/index.js";
import { searchAwards, searchByCategory } from "../api/usaspending.js";
import {
  normalizeCategoryToAgency,
  normalizeCategoryToContractor,
  normalizeUSASpendingToContract,
  generateInsights,
} from "../utils/normalizer.js";
import {
  monthsAgoIso,
  todayIso,
  monthsFromNowIso,
  nowIso8601,
} from "../utils/date-helpers.js";

export async function handleCompetitiveLandscape(
  args: CompetitiveLandscapeInput
): Promise<CompetitiveLandscapeResult> {
  const lookbackYears = args.lookbackYears ?? 3;
  const startDate = monthsAgoIso(lookbackYears * 12);
  const endDate = todayIso();

  // 3 parallel API calls
  const [agenciesRes, contractorsRes, awardsRes] = await Promise.all([
    // 1. Top agencies by spend
    searchByCategory({
      category: "awarding_agency",
      naicsCode: args.naicsCode,
      agency: args.agencyFilter || undefined,
      startDate,
      endDate,
      limit: 10,
    }),
    // 2. Top contractors
    searchByCategory({
      category: "recipient_duns",
      naicsCode: args.naicsCode,
      agency: args.agencyFilter || undefined,
      startDate,
      endDate,
      limit: 10,
    }),
    // 3. Raw awards (for expiring contracts + market totals)
    searchAwards({
      naicsCode: args.naicsCode,
      agency: args.agencyFilter || undefined,
      startDate,
      endDate: monthsFromNowIso(12), // extend to catch contracts ending in next 12 months
      limit: 100,
      sort: "Award Amount",
      order: "desc",
    }),
  ]);

  // --- Normalize agencies ---
  const topAgencies = agenciesRes.results.map(normalizeCategoryToAgency);

  // --- Normalize contractors ---
  const topContractors = contractorsRes.results.map(
    normalizeCategoryToContractor
  );

  // --- Process awards for market overview + expiring contracts ---
  const allContracts = awardsRes.results.map(normalizeUSASpendingToContract);

  // Market overview: aggregate from awards
  const totalContractValueUsd = allContracts.reduce(
    (sum, c) => sum + c.awardAmountUsd,
    0
  );
  const totalContractCount = allContracts.length;
  const averageContractValueUsd =
    totalContractCount > 0 ? totalContractValueUsd / totalContractCount : 0;

  // Expiring contracts: ending within 12 months from today
  const today = todayIso();
  const cutoff12m = monthsFromNowIso(12);
  const expiring: ExpiringContract[] = allContracts
    .filter((c) => c.endDate >= today && c.endDate <= cutoff12m)
    .sort((a, b) => b.awardAmountUsd - a.awardAmountUsd);

  const expiringTotalValue = expiring.reduce(
    (sum, c) => sum + c.awardAmountUsd,
    0
  );

  const topExpiring = expiring.slice(0, 5).map((c) => ({
    contractId: c.contractId,
    incumbentName: c.incumbentName,
    valueUsd: c.awardAmountUsd,
    agency: c.awardingAgency,
    endDate: c.endDate,
  }));

  // Strategic insights
  const strategicInsights = generateInsights(expiring, topContractors);

  return {
    query: {
      naicsCode: args.naicsCode,
      lookbackYears,
      agencyFilter: args.agencyFilter ?? "",
    },
    marketOverview: {
      totalContractValueUsd,
      totalContractCount,
      averageContractValueUsd: Math.round(averageContractValueUsd),
    },
    topAgencies,
    topContractors,
    expiringContractsSummary: {
      count: expiring.length,
      totalValueUsd: expiringTotalValue,
      topExpiring,
    },
    strategicInsights,
    fetchedAt: nowIso8601(),
  };
}
