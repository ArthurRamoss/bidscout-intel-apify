// =============================================================================
// BidScout Intel — Tool Definitions
// Each tool has: name, description, _meta, inputSchema, outputSchema
// outputSchema is THE most critical piece — the CTX planning LLM reads it
// =============================================================================

export const TOOLS = [
  // =========================================================================
  // Tool 1: search_federal_opportunities (SAM.gov)
  // =========================================================================
  {
    name: "search_federal_opportunities",
    description:
      "Searches active federal contract opportunities on SAM.gov. Returns solicitations, presolicitations, sources sought, and award notices filtered by keyword, NAICS code, set-aside type, agency, and state. Results include contact information, deadlines, award details, and direct SAM.gov links.",
    _meta: {
      surface: "both",
      queryEligible: true,
      latencyClass: "slow",
      pricing: {
        executeUsd: "0",
      },
      rateLimit: {
        maxRequestsPerMinute: 10,
        cooldownMs: 1000,
        maxConcurrency: 1,
        supportsBulk: false,
        recommendedBatchTools: [],
        notes:
          "SAM.gov daily cap: 1,000 requests. Geo-restricted to US-based IPs. Use narrow keyword + NAICS filters to avoid wasting quota. Prefer detect_incumbents or analyze_competitive_landscape for contract data.",
      },
    },
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: {
          type: "string",
          description:
            "Search term for opportunity title (e.g. 'cybersecurity', 'cloud migration')",
          examples: ["cybersecurity", "IT modernization", "cloud computing"],
        },
        naicsCode: {
          type: "string",
          description: "6-digit NAICS code to filter by industry",
          examples: ["541512", "541330"],
        },
        setAside: {
          type: "string",
          description:
            "Set-aside type code (e.g. 'SBA' for small business, '8A' for 8(a))",
          examples: ["SBA", "8A", "WOSB", "SDVOSBC", "HZC"],
        },
        agency: {
          type: "string",
          description: "Agency or department name to filter by",
          examples: [
            "Department of Defense",
            "Department of Homeland Security",
          ],
        },
        state: {
          type: "string",
          description: "2-letter state code for place of performance",
          examples: ["VA", "CA", "TX", "DC"],
        },
        postedWithinDays: {
          type: "number",
          description: "Only show opportunities posted within N days",
          default: 30,
          examples: [7, 30, 60, 90],
        },
      },
      required: ["keyword"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        totalRecords: {
          type: "number",
          description: "Total opportunities matching the search criteria",
        },
        opportunities: {
          type: "array",
          description:
            "List of matching federal contract opportunities, sorted by posted date descending",
          items: {
            type: "object",
            properties: {
              noticeId: {
                type: "string",
                description: "SAM.gov unique notice identifier",
              },
              title: { type: "string", description: "Opportunity title" },
              solicitationNumber: {
                type: "string",
                description: "Solicitation number",
              },
              agency: {
                type: "string",
                description:
                  "Full agency hierarchy (e.g. 'DEPT OF DEFENSE.DEPT OF THE ARMY.ARMY CONTRACTING COMMAND')",
              },
              postedDate: {
                type: "string",
                description: "Date opportunity was posted (ISO 8601)",
              },
              type: {
                type: "string",
                description:
                  "Notice type: Solicitation, Presolicitation, Combined Synopsis/Solicitation, Sources Sought, Award Notice, Special Notice",
              },
              responseDeadline: {
                type: "string",
                description:
                  "Response deadline (ISO 8601), null if not applicable",
              },
              naicsCode: { type: "string", description: "NAICS code" },
              classificationCode: {
                type: "string",
                description: "PSC/classification code",
              },
              setAside: {
                type: "string",
                description:
                  "Set-aside description (e.g. 'Total Small Business Set-Aside') or null",
              },
              setAsideCode: {
                type: "string",
                description: "Set-aside code (e.g. 'SBA') or null",
              },
              placeOfPerformance: {
                type: "string",
                description: "City, State of performance location",
              },
              awardInfo: {
                type: "object",
                description:
                  "Award information if this is an award notice, null otherwise",
                properties: {
                  awardDate: {
                    type: "string",
                    description: "Date of award (ISO 8601)",
                  },
                  awardAmount: {
                    type: "number",
                    description: "Award value in USD",
                  },
                  awardeeName: {
                    type: "string",
                    description: "Name of winning contractor",
                  },
                  awardeeUei: {
                    type: "string",
                    description: "Awardee Unique Entity Identifier (UEI)",
                  },
                },
              },
              contactInfo: {
                type: "object",
                description: "Primary point of contact",
                properties: {
                  name: { type: "string", description: "Contact full name" },
                  email: { type: "string", description: "Contact email" },
                  phone: { type: "string", description: "Contact phone" },
                  title: { type: "string", description: "Contact title" },
                },
              },
              samLink: {
                type: "string",
                description: "Direct link to the opportunity on SAM.gov",
              },
              resourceLinks: {
                type: "array",
                description: "URLs to attached documents/resources",
                items: { type: "string" },
              },
            },
            required: ["noticeId", "title", "agency", "postedDate", "type"],
          },
        },
        searchSummary: {
          type: "string",
          description:
            "Natural language summary of search results and key observations",
        },
        fetchedAt: { type: "string", description: "ISO 8601 timestamp" },
      },
      required: [
        "totalRecords",
        "opportunities",
        "searchSummary",
        "fetchedAt",
      ],
    },
  },

  // =========================================================================
  // Tool 2: detect_incumbents ⭐ (CORE feature)
  // =========================================================================
  {
    name: "detect_incumbents",
    description:
      "Given a NAICS code and optional agency filter, identifies current incumbent contractors with expiring federal contracts, calculates recompete probability scores (0-100), and provides strategic intelligence about upcoming recompete opportunities. This is competitive intelligence that typically costs $25K/yr from GovWin.",
    _meta: {
      surface: "both",
      queryEligible: true,
      latencyClass: "fast",
      pricing: {
        executeUsd: "0",
      },
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
    inputSchema: {
      type: "object" as const,
      properties: {
        naicsCode: {
          type: "string",
          description:
            "6-digit NAICS code (e.g. '541512' for Computer Systems Design)",
          examples: ["541512", "541330", "518210"],
        },
        agency: {
          type: "string",
          description: "Federal agency name filter",
          default: "",
        },
        keyword: {
          type: "string",
          description: "Keyword to filter contract descriptions",
          default: "",
        },
        expiringWithinMonths: {
          type: "number",
          description: "Look ahead window in months for expiring contracts",
          default: 12,
          examples: [6, 12, 18, 24],
        },
      },
      required: ["naicsCode"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "object",
          description: "Echo of input parameters",
          properties: {
            naicsCode: {
              type: "string",
              description: "NAICS code searched",
            },
            agency: {
              type: "string",
              description: "Agency filter applied",
            },
            keyword: {
              type: "string",
              description: "Keyword filter applied",
            },
            expiringWithinMonths: {
              type: "number",
              description: "Months lookahead used",
            },
          },
          required: ["naicsCode", "expiringWithinMonths"],
        },
        totalContractsFound: {
          type: "number",
          description:
            "Total contracts matching criteria before expiration filter",
        },
        totalValueUsd: {
          type: "number",
          description: "Sum of all expiring contract values in USD",
        },
        expiringContracts: {
          type: "array",
          description:
            "Contracts expiring within timeframe, sorted by recompeteScore descending",
          items: {
            type: "object",
            properties: {
              contractId: {
                type: "string",
                description: "Federal contract PIID (e.g. FA881222C0001)",
              },
              title: { type: "string", description: "Contract description" },
              incumbentName: {
                type: "string",
                description: "Current contractor name",
              },
              awardAmountUsd: {
                type: "number",
                description: "Total award amount in USD",
              },
              awardingAgency: {
                type: "string",
                description: "Top-tier awarding agency",
              },
              awardingSubAgency: {
                type: "string",
                description: "Sub-agency",
              },
              startDate: {
                type: "string",
                description: "Performance start (ISO 8601)",
              },
              endDate: {
                type: "string",
                description: "Performance end (ISO 8601)",
              },
              daysUntilExpiration: {
                type: "number",
                description: "Days remaining",
              },
              recompeteScore: {
                type: "number",
                description:
                  "0-100 likelihood of recompete. Formula: proximity (40pts: closer=higher) + value (30pts: larger=higher) + duration (30pts: longer=higher)",
              },
              naicsCode: { type: "string", description: "NAICS code" },
              contractType: {
                type: "string",
                description:
                  "e.g. 'DEFINITIVE CONTRACT', 'DELIVERY ORDER'",
              },
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
          description:
            "Top contractors by total expiring contract value",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Contractor name" },
              totalValueUsd: {
                type: "number",
                description: "Sum of their expiring contracts in USD",
              },
              contractCount: {
                type: "number",
                description: "Number of expiring contracts",
              },
              avgRecompeteScore: {
                type: "number",
                description:
                  "Average recompete score across their contracts",
              },
            },
            required: ["name", "totalValueUsd", "contractCount"],
          },
        },
        strategicInsights: {
          type: "array",
          description:
            "Actionable observations about recompete opportunities",
          items: { type: "string" },
        },
        fetchedAt: { type: "string", description: "ISO 8601 timestamp" },
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

  // =========================================================================
  // Tool 3: analyze_competitive_landscape
  // =========================================================================
  {
    name: "analyze_competitive_landscape",
    description:
      "Provides a comprehensive competitive intelligence briefing for a NAICS code, including market size, top agencies by spend, top contractors by contract value won, contracts expiring in the next 12 months, and strategic insights about market concentration and recompete opportunities.",
    _meta: {
      surface: "both",
      queryEligible: true,
      latencyClass: "slow",
      pricing: {
        executeUsd: "0",
      },
      rateLimit: {
        maxRequestsPerMinute: 20,
        cooldownMs: 1000,
        maxConcurrency: 1,
        supportsBulk: true,
        recommendedBatchTools: ["analyze_competitive_landscape"],
        notes:
          "Makes 3 parallel USASpending API calls (spend-by-agency, spend-by-contractor, active contracts). This is the preferred batch tool — use instead of multiple detect_incumbents calls. Call alone for best throughput.",
      },
    },
    inputSchema: {
      type: "object" as const,
      properties: {
        naicsCode: {
          type: "string",
          description: "6-digit NAICS code",
          examples: ["541512", "541330"],
        },
        lookbackYears: {
          type: "number",
          description: "Years of historical data to analyze",
          default: 3,
          examples: [1, 2, 3, 5],
        },
        agencyFilter: {
          type: "string",
          description: "Optional agency filter",
          default: "",
        },
      },
      required: ["naicsCode"],
    },
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
          description: "High-level market statistics",
          properties: {
            totalContractValueUsd: {
              type: "number",
              description:
                "Total contract value in the NAICS during lookback period",
            },
            totalContractCount: {
              type: "number",
              description: "Number of contracts awarded",
            },
            averageContractValueUsd: {
              type: "number",
              description: "Average contract value",
            },
          },
          required: ["totalContractValueUsd", "totalContractCount"],
        },
        topAgencies: {
          type: "array",
          description:
            "Top federal agencies by contract spend, sorted descending",
          items: {
            type: "object",
            properties: {
              agencyName: { type: "string", description: "Agency name" },
              totalSpendUsd: {
                type: "number",
                description: "Total spend in USD",
              },
              agencyCode: { type: "string", description: "Agency code" },
            },
            required: ["agencyName", "totalSpendUsd"],
          },
        },
        topContractors: {
          type: "array",
          description: "Top contractors by contract value won",
          items: {
            type: "object",
            properties: {
              contractorName: {
                type: "string",
                description: "Company name",
              },
              totalWonUsd: {
                type: "number",
                description: "Total value of contracts won",
              },
              contractCount: {
                type: "number",
                description: "Number of contracts",
              },
              recipientId: {
                type: "string",
                description: "USASpending recipient ID for drill-down",
              },
            },
            required: ["contractorName", "totalWonUsd", "contractCount"],
          },
        },
        expiringContractsSummary: {
          type: "object",
          description: "Summary of contracts expiring in next 12 months",
          properties: {
            count: {
              type: "number",
              description: "Number of expiring contracts",
            },
            totalValueUsd: {
              type: "number",
              description: "Total value of expiring contracts",
            },
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
                required: [
                  "contractId",
                  "incumbentName",
                  "valueUsd",
                  "endDate",
                ],
              },
            },
          },
          required: ["count", "totalValueUsd"],
        },
        strategicInsights: {
          type: "array",
          description: "Key observations and actionable intelligence",
          items: { type: "string" },
        },
        fetchedAt: { type: "string", description: "ISO 8601 timestamp" },
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
