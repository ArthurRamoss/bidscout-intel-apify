import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";
import { ARG_SCHEMA } from "./schemas.js";

function inputSchemaFor(zodSchema: z.ZodTypeAny): Record<string, unknown> {
  const result = zodToJsonSchema(zodSchema, { $refStrategy: "none" }) as Record<string, unknown>;
  delete result.$schema;
  return result;
}

export const TOOLS = [
  {
    name: "search_federal_opportunities",
    description:
      "Searches active federal contract opportunities on SAM.gov. Returns solicitations, presolicitations, sources sought, and award notices filtered by keyword, NAICS code, set-aside type, agency, and state. Results include contact information, deadlines, award details, and direct SAM.gov links. Output shape: { totalRecords, opportunities[], searchSummary, fetchedAt }.",
    _meta: {
      surface: "both",
      queryEligible: true,
      latencyClass: "slow",
      pricing: { event: "tool-call-search" },
      rateLimit: {
        maxRequestsPerMinute: 10,
        cooldownMs: 1000,
        maxConcurrency: 1,
        supportsBulk: false,
        recommendedBatchTools: [],
        notes:
          "SAM.gov daily cap: 1,000 requests. Geo-restricted to US-based IPs. Use narrow keyword + NAICS filters to avoid wasting quota.",
      },
    },
    inputSchema: inputSchemaFor(ARG_SCHEMA.search_federal_opportunities),
    outputSchema: {
      type: "object" as const,
      properties: {
        totalRecords: { type: "number", description: "Total opportunities matching the search criteria" },
        opportunities: {
          type: "array",
          description: "List of matching federal contract opportunities, sorted by posted date descending",
          items: {
            type: "object",
            properties: {
              noticeId: { type: "string", description: "SAM.gov unique notice identifier" },
              title: { type: "string", description: "Opportunity title" },
              solicitationNumber: { type: "string", description: "Solicitation number" },
              agency: { type: "string", description: "Full agency hierarchy" },
              postedDate: { type: "string", description: "Date opportunity was posted (ISO 8601)" },
              type: {
                type: "string",
                description:
                  "Notice type: Solicitation, Presolicitation, Combined Synopsis/Solicitation, Sources Sought, Award Notice, Special Notice",
              },
              responseDeadline: { type: "string", description: "Response deadline (ISO 8601), null if N/A" },
              naicsCode: { type: "string" },
              classificationCode: { type: "string", description: "PSC/classification code" },
              setAside: { type: "string", description: "Set-aside description or null" },
              setAsideCode: { type: "string", description: "Set-aside code or null" },
              placeOfPerformance: { type: "string", description: "City, State of performance location" },
              awardInfo: {
                type: "object",
                description: "Award info if this is an award notice, null otherwise",
                properties: {
                  awardDate: { type: "string" },
                  awardAmount: { type: "number" },
                  awardeeName: { type: "string" },
                  awardeeUei: { type: "string" },
                },
              },
              contactInfo: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  title: { type: "string" },
                },
              },
              samLink: { type: "string", description: "Direct link to the opportunity on SAM.gov" },
              resourceLinks: { type: "array", items: { type: "string" } },
            },
            required: ["noticeId", "title", "agency", "postedDate", "type"],
          },
        },
        searchSummary: { type: "string", description: "Natural language summary of results" },
        fetchedAt: { type: "string", description: "ISO 8601 timestamp" },
      },
      required: ["totalRecords", "opportunities", "searchSummary", "fetchedAt"],
    },
  },

  {
    name: "detect_incumbents",
    description:
      "Given a NAICS code and optional agency filter, identifies current incumbent contractors with expiring federal contracts, calculates recompete probability scores (0-100), and provides strategic intelligence about upcoming recompete opportunities. This is the differentiator tool — competitive intelligence that typically costs $25K/yr from GovWin. Output shape: { query, totalContractsFound, totalValueUsd, expiringContracts[], topIncumbents[], strategicInsights[], fetchedAt }.",
    _meta: {
      surface: "both",
      queryEligible: true,
      latencyClass: "fast",
      pricing: { event: "tool-call-incumbents" },
      rateLimit: {
        maxRequestsPerMinute: 30,
        cooldownMs: 500,
        maxConcurrency: 2,
        supportsBulk: false,
        recommendedBatchTools: ["analyze_competitive_landscape"],
        notes:
          "Single USASpending API call per invocation. For full market picture, prefer analyze_competitive_landscape which bundles incumbents + agency spend + market size in one call.",
      },
    },
    inputSchema: inputSchemaFor(ARG_SCHEMA.detect_incumbents),
    outputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "object",
          properties: {
            naicsCode: { type: "string" },
            agency: { type: "string" },
            keyword: { type: "string" },
            expiringWithinMonths: { type: "number" },
          },
          required: ["naicsCode", "expiringWithinMonths"],
        },
        totalContractsFound: { type: "number" },
        totalValueUsd: { type: "number" },
        expiringContracts: {
          type: "array",
          description: "Contracts expiring within timeframe, sorted by recompeteScore descending",
          items: {
            type: "object",
            properties: {
              contractId: { type: "string", description: "Federal contract PIID (e.g. FA881222C0001)" },
              title: { type: "string", description: "Contract description" },
              incumbentName: { type: "string", description: "Current contractor name" },
              awardAmountUsd: { type: "number" },
              awardingAgency: { type: "string" },
              awardingSubAgency: { type: "string" },
              startDate: { type: "string", description: "Performance start (ISO 8601)" },
              endDate: { type: "string", description: "Performance end (ISO 8601)" },
              daysUntilExpiration: { type: "number" },
              recompeteScore: {
                type: "number",
                description:
                  "0-100 likelihood of recompete. Formula: proximity (40pts: closer=higher) + value (30pts: larger=higher) + duration (30pts: longer=higher)",
              },
              naicsCode: { type: "string" },
              contractType: { type: "string", description: "e.g. 'DEFINITIVE CONTRACT', 'DELIVERY ORDER'" },
            },
            required: [
              "contractId",
              "incumbentName",
              "awardAmountUsd",
              "awardingAgency",
              "endDate",
              "daysUntilExpiration",
              "recompeteScore",
            ],
          },
        },
        topIncumbents: {
          type: "array",
          description: "Top contractors by total expiring contract value",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              totalValueUsd: { type: "number" },
              contractCount: { type: "number" },
              avgRecompeteScore: { type: "number" },
            },
            required: ["name", "totalValueUsd", "contractCount"],
          },
        },
        strategicInsights: { type: "array", items: { type: "string" } },
        fetchedAt: { type: "string" },
      },
      required: [
        "query",
        "totalContractsFound",
        "totalValueUsd",
        "expiringContracts",
        "topIncumbents",
        "strategicInsights",
        "fetchedAt",
      ],
    },
  },

  {
    name: "analyze_competitive_landscape",
    description:
      "Provides a comprehensive competitive intelligence briefing for a NAICS code, including market size, top agencies by spend, top contractors by contract value won, contracts expiring in the next 12 months, and strategic insights about market concentration. Output shape: { query, marketOverview, topAgencies[], topContractors[], expiringContractsSummary, strategicInsights[], fetchedAt }.",
    _meta: {
      surface: "both",
      queryEligible: true,
      latencyClass: "slow",
      pricing: { event: "tool-call-landscape" },
      rateLimit: {
        maxRequestsPerMinute: 20,
        cooldownMs: 1000,
        maxConcurrency: 1,
        supportsBulk: true,
        recommendedBatchTools: ["analyze_competitive_landscape"],
        notes:
          "Makes 3 parallel USASpending API calls (spend-by-agency, spend-by-contractor, active contracts). Preferred batch tool — use instead of multiple detect_incumbents calls.",
      },
    },
    inputSchema: inputSchemaFor(ARG_SCHEMA.analyze_competitive_landscape),
    outputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "object",
          properties: {
            naicsCode: { type: "string" },
            lookbackYears: { type: "number" },
            agencyFilter: { type: "string" },
          },
          required: ["naicsCode", "lookbackYears"],
        },
        marketOverview: {
          type: "object",
          properties: {
            totalContractValueUsd: { type: "number" },
            totalContractCount: { type: "number" },
            averageContractValueUsd: { type: "number" },
          },
          required: ["totalContractValueUsd", "totalContractCount"],
        },
        topAgencies: {
          type: "array",
          description: "Top federal agencies by contract spend, sorted descending",
          items: {
            type: "object",
            properties: {
              agencyName: { type: "string" },
              totalSpendUsd: { type: "number" },
              agencyCode: { type: "string" },
            },
            required: ["agencyName", "totalSpendUsd"],
          },
        },
        topContractors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              contractorName: { type: "string" },
              totalWonUsd: { type: "number" },
              contractCount: { type: "number" },
              recipientId: { type: "string", description: "USASpending recipient ID for drill-down" },
            },
            required: ["contractorName", "totalWonUsd", "contractCount"],
          },
        },
        expiringContractsSummary: {
          type: "object",
          properties: {
            count: { type: "number" },
            totalValueUsd: { type: "number" },
            topExpiring: {
              type: "array",
              description: "Top 5 highest-value expiring contracts",
              items: {
                type: "object",
                properties: {
                  contractId: { type: "string" },
                  incumbentName: { type: "string" },
                  valueUsd: { type: "number" },
                  agency: { type: "string" },
                  endDate: { type: "string" },
                },
                required: ["contractId", "incumbentName", "valueUsd", "endDate"],
              },
            },
          },
          required: ["count", "totalValueUsd"],
        },
        strategicInsights: { type: "array", items: { type: "string" } },
        fetchedAt: { type: "string" },
      },
      required: [
        "query",
        "marketOverview",
        "topAgencies",
        "topContractors",
        "expiringContractsSummary",
        "strategicInsights",
        "fetchedAt",
      ],
    },
  },
];
