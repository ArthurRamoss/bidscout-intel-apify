// =============================================================================
// Data Normalizer — Bridge between USASpending / SAM.gov raw data and our schemas
// =============================================================================

import type {
  SAMOpportunityRaw,
  Opportunity,
  AwardInfo,
  ContactInfo,
  USASpendingAwardResult,
  ExpiringContract,
  TopIncumbent,
  TopContractor,
  TopAgency,
  USASpendingCategoryResult,
} from "../types/index.js";
import { daysFromNow, parseAmount } from "./date-helpers.js";
import { calculateRecompeteScore } from "./scoring.js";

// ---------------------------------------------------------------------------
// SAM.gov → Opportunity (Tool 1)
// ---------------------------------------------------------------------------

export function normalizeSAMOpportunity(raw: SAMOpportunityRaw): Opportunity {
  // Build place of performance string
  let placeOfPerformance = "";
  if (raw.placeOfPerformance) {
    const city = raw.placeOfPerformance.city?.name ?? "";
    const state = raw.placeOfPerformance.state?.code ?? "";
    placeOfPerformance = [city, state].filter(Boolean).join(", ");
  }

  // Build award info (amount comes as STRING from SAM.gov!)
  // Never return null — outputSchema declares type: "object", MCP SDK validates strictly
  const awardInfo: AwardInfo = raw.award
    ? {
        awardDate: raw.award.date ?? "",
        awardAmount: parseAmount(raw.award.amount),
        awardeeName: raw.award.awardee?.name ?? "",
        awardeeUei: raw.award.awardee?.ueiSAM ?? "",
      }
    : { awardDate: "", awardAmount: 0, awardeeName: "", awardeeUei: "" };

  // Build contact info — never null (outputSchema declares type: "object")
  let contactInfo: ContactInfo = { name: "", email: "", phone: "", title: "" };
  if (raw.pointOfContact && raw.pointOfContact.length > 0) {
    const primary =
      raw.pointOfContact.find((c) => c.type === "primary") ??
      raw.pointOfContact[0];
    contactInfo = {
      name: primary.fullName ?? "",
      email: primary.email ?? "",
      phone: primary.phone ?? "",
      title: primary.title ?? "",
    };
  }

  return {
    noticeId: raw.noticeId ?? "",
    title: raw.title ?? "",
    solicitationNumber: raw.solicitationNumber ?? "",
    agency: raw.fullParentPathName ?? "",
    postedDate: raw.postedDate ?? "",
    type: raw.type ?? "",
    responseDeadline: raw.responseDeadLine ?? "",
    naicsCode: raw.naicsCode ?? "",
    classificationCode: raw.classificationCode ?? "",
    setAside: raw.typeOfSetAsideDescription ?? "",
    setAsideCode: raw.typeOfSetAside ?? "",
    placeOfPerformance,
    awardInfo,
    contactInfo,
    samLink: raw.uiLink ?? "",
    resourceLinks: raw.resourceLinks ?? [],
  };
}

// ---------------------------------------------------------------------------
// USASpending Award → ExpiringContract (Tool 2)
// ---------------------------------------------------------------------------

export function normalizeUSASpendingToContract(
  raw: USASpendingAwardResult
): ExpiringContract {
  const endDate = raw["End Date"] ?? "";
  const startDate = raw["Start Date"] ?? "";
  const awardAmount = parseAmount(raw["Award Amount"]);

  return {
    contractId: raw["Award ID"] ?? "",
    title: raw["Description"] ?? "",
    incumbentName: raw["Recipient Name"] ?? "",
    awardAmountUsd: awardAmount,
    awardingAgency: raw["Awarding Agency"] ?? "",
    awardingSubAgency: raw["Awarding Sub Agency"] ?? "",
    startDate,
    endDate,
    daysUntilExpiration: Math.max(0, daysFromNow(endDate)),
    recompeteScore: calculateRecompeteScore({ endDate, startDate, awardAmount }),
    naicsCode: raw["NAICS Code"] ?? "",
    contractType: raw["Contract Award Type"] ?? "",
  };
}

// ---------------------------------------------------------------------------
// Aggregate top incumbents from contracts (Tool 2)
// ---------------------------------------------------------------------------

export function aggregateTopIncumbents(
  contracts: ExpiringContract[]
): TopIncumbent[] {
  const map = new Map<
    string,
    { totalValue: number; count: number; scores: number[] }
  >();

  for (const c of contracts) {
    const name = c.incumbentName;
    const existing = map.get(name) ?? { totalValue: 0, count: 0, scores: [] };
    existing.totalValue += c.awardAmountUsd;
    existing.count += 1;
    existing.scores.push(c.recompeteScore);
    map.set(name, existing);
  }

  return Array.from(map.entries())
    .map(([name, data]) => ({
      name,
      totalValueUsd: data.totalValue,
      contractCount: data.count,
      avgRecompeteScore: Math.round(
        data.scores.reduce((a, b) => a + b, 0) / data.scores.length
      ),
    }))
    .sort((a, b) => b.totalValueUsd - a.totalValueUsd);
}

// ---------------------------------------------------------------------------
// USASpending category results → TopAgency / TopContractor (Tool 3)
// ---------------------------------------------------------------------------

export function normalizeCategoryToAgency(
  raw: USASpendingCategoryResult
): TopAgency {
  return {
    agencyName: raw.name ?? "",
    totalSpendUsd: raw.amount ?? 0,
    agencyCode: raw.code ?? "",
  };
}

export function normalizeCategoryToContractor(
  raw: USASpendingCategoryResult
): TopContractor {
  return {
    contractorName: raw.name ?? "",
    totalWonUsd: raw.amount ?? 0,
    contractCount: 0, // Category endpoint doesn't give count — enriched later
    recipientId: String(raw.id ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Strategic insights generator (pure logic, no LLM)
// ---------------------------------------------------------------------------

export function generateInsights(
  contracts: ExpiringContract[],
  topContractors: TopIncumbent[] | TopContractor[]
): string[] {
  const insights: string[] = [];
  const totalValue = contracts.reduce((sum, c) => sum + c.awardAmountUsd, 0);
  const highValue = contracts.filter((c) => c.awardAmountUsd > 10_000_000);

  // High-value expiring
  if (highValue.length > 0) {
    const hvTotal = highValue.reduce((s, c) => s + c.awardAmountUsd, 0);
    insights.push(
      `${highValue.length} high-value contracts (>$10M) totaling $${(hvTotal / 1e6).toFixed(1)}M are expiring — potential recompete opportunities`
    );
  }

  // Market concentration
  if (topContractors.length >= 3) {
    const getValue = (c: TopIncumbent | TopContractor): number =>
      "totalValueUsd" in c ? c.totalValueUsd : (c as TopContractor).totalWonUsd;

    const top3Value = topContractors
      .slice(0, 3)
      .reduce((s, c) => s + getValue(c), 0);
    const totalMarket = topContractors.reduce((s, c) => s + getValue(c), 0);

    if (totalMarket > 0) {
      const concentration = ((top3Value / totalMarket) * 100).toFixed(0);
      if (Number(concentration) > 60) {
        insights.push(
          `Market is highly concentrated — top 3 contractors hold ${concentration}% of contract value`
        );
      }
    }
  }

  // Urgent expiring (< 6 months)
  const urgent = contracts.filter((c) => c.daysUntilExpiration < 180);
  if (urgent.length > 0) {
    insights.push(
      `${urgent.length} contracts expire within 6 months — procurement cycle likely already started for recompetes`
    );
  }

  // Very high score contracts
  const hotOpps = contracts.filter((c) => c.recompeteScore >= 80);
  if (hotOpps.length > 0) {
    insights.push(
      `${hotOpps.length} contracts have recompete scores ≥80 — highest probability recompete targets`
    );
  }

  // Fallback insight
  if (insights.length === 0) {
    insights.push(
      `${contracts.length} contracts totaling $${(totalValue / 1e6).toFixed(1)}M identified in the search criteria`
    );
  }

  return insights;
}
