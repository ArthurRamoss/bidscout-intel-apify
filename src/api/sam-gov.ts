// =============================================================================
// SAM.gov Opportunities Search Client
//
// Uses SAM.gov's internal search API (sam.gov/api/prod/sgs/v1/search/)
// which is the same endpoint the SAM.gov website frontend uses.
//
// The official public API (api.sam.gov/opportunities/v2/search) is blocked
// from cloud provider IPs (AWS, GCP, Railway, etc.) by a government WAF.
// This internal search API works from any IP and requires no API key.
//
// ⚠️ GOTCHAS:
//   - Requires Accept: application/hal+json header
//   - Response uses HAL+JSON format with _embedded.results
//   - NAICS code filter uses &naics= param
//   - Pagination: page (0-indexed), size (max ~1000)
//   - Filter active opps with &is_active=true
//   - No API key needed (public search)
//   - Max 10,000 records retrievable
// =============================================================================

import type { SAMSearchResponse, SAMOpportunityRaw } from "../types/index.js";

const SEARCH_URL = "https://sam.gov/api/prod/sgs/v1/search/";

// ---------------------------------------------------------------------------
// Internal SAM.gov search result types
// ---------------------------------------------------------------------------

interface SAMInternalResult {
  _id: string;
  _type: string;
  _rScore: number;
  title: string;
  solicitationNumber: string;
  publishDate: string;
  modifiedDate: string;
  responseDate: string | null;
  responseDateActual: string | null;
  responseTimeZone: string;
  isActive: boolean;
  isCanceled: boolean;
  type: { code: string; value: string };
  descriptions: Array<{ content: string; lastModifiedDate: string }>;
  organizationHierarchy: Array<{
    organizationId: string;
    code: string;
    name: string;
    type: string;
    level: number;
    status: string;
    address: {
      city: string | null;
      state: string | null;
      zip: string | null;
      country: string | null;
      streetAddress: string | null;
      streetAddress2: string | null;
    };
  }>;
  award: {
    awardee: {
      ueiSAM: string | null;
      name: string | null;
    };
  } | null;
  modifications: { count: number };
  parentNoticeId: string | null;
}

interface SAMInternalSearchResponse {
  _embedded?: {
    results: SAMInternalResult[];
  };
  page?: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
    maxAllowedRecords: number;
  };
}

// Map notice type codes to readable names
const NOTICE_TYPES: Record<string, string> = {
  o: "Solicitation",
  k: "Combined Synopsis/Solicitation",
  p: "Presolicitation",
  r: "Sources Sought",
  s: "Special Notice",
  a: "Award Notice",
  u: "Justification",
  g: "Sale of Surplus Property",
  i: "Intent to Bundle",
};

// ---------------------------------------------------------------------------
// Search opportunities
// ---------------------------------------------------------------------------

export interface SearchOpportunitiesOptions {
  keyword?: string;
  naicsCode?: string;
  setAside?: string;
  agency?: string;
  state?: string;
  postedWithinDays?: number;
  limit?: number;
  offset?: number;
  /** Notice types: o=Solicitation, k=Combined, p=Presolicitation, r=Sources Sought, a=Award, s=Special */
  ptype?: string;
}

export async function searchOpportunities(
  opts: SearchOpportunitiesOptions
): Promise<SAMSearchResponse> {
  const params = new URLSearchParams();

  // Required: search index for opportunities
  params.set("index", "opp");
  params.set("mode", "search");
  params.set("sort", "-modifiedDate");
  params.set("is_active", "true");

  // Keyword search
  params.set("q", opts.keyword ?? "");

  // Optional filters
  if (opts.naicsCode) params.set("naics", opts.naicsCode);
  if (opts.ptype) params.set("ptype", opts.ptype);

  // Pagination
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;
  params.set("size", String(limit));
  params.set("page", String(Math.floor(offset / limit)));

  const url = `${SEARCH_URL}?${params.toString()}`;
  console.log("[sam-gov] Searching:", url.substring(0, 200));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/hal+json",
      "User-Agent":
        "BidScout-Intel/1.0 (Federal Procurement Intelligence MCP Server)",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[sam-gov] Error ${response.status}: ${text.substring(0, 200)}`);
    return { totalRecords: 0, limit: 0, offset: 0, opportunitiesData: [] };
  }

  const data = (await response.json()) as SAMInternalSearchResponse;

  if (!data._embedded?.results) {
    return { totalRecords: 0, limit, offset: 0, opportunitiesData: [] };
  }

  // Convert internal format to our SAMOpportunityRaw format
  const opportunitiesData = data._embedded.results.map((r) =>
    convertToRawFormat(r)
  );

  return {
    totalRecords: data.page?.totalElements ?? 0,
    limit: data.page?.size ?? limit,
    offset: (data.page?.number ?? 0) * (data.page?.size ?? limit),
    opportunitiesData,
  };
}

// ---------------------------------------------------------------------------
// Convert internal SAM.gov result to our SAMOpportunityRaw format
// ---------------------------------------------------------------------------

function convertToRawFormat(r: SAMInternalResult): SAMOpportunityRaw {
  // Build organization path from hierarchy
  const orgPath =
    r.organizationHierarchy
      ?.sort((a, b) => a.level - b.level)
      .map((o) => o.name)
      .join(".") ?? "";

  const orgCodes =
    r.organizationHierarchy
      ?.sort((a, b) => a.level - b.level)
      .map((o) => o.code)
      .join(".") ?? "";

  // Get office address (deepest level in hierarchy)
  const office = r.organizationHierarchy?.sort(
    (a, b) => b.level - a.level
  )?.[0];

  // Build description text (strip HTML tags)
  const description =
    r.descriptions?.[0]?.content
      ?.replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim() ?? "";

  return {
    noticeId: r._id,
    title: r.title ?? "",
    solicitationNumber: r.solicitationNumber ?? "",
    fullParentPathName: orgPath,
    fullParentPathCode: orgCodes,
    postedDate: r.publishDate ?? "",
    type: NOTICE_TYPES[r.type?.code] ?? r.type?.value ?? "",
    baseType: r.type?.value ?? "",
    archiveType: "",
    archiveDate: "",
    typeOfSetAsideDescription: null,
    typeOfSetAside: null,
    responseDeadLine: r.responseDate ?? r.responseDateActual ?? null,
    naicsCode: null,
    classificationCode: null,
    active: r.isActive ? "Yes" : "No",
    award: r.award?.awardee?.name
      ? {
          date: "",
          number: "",
          amount: "0",
          awardee: {
            name: r.award.awardee.name,
            location: {
              city: { name: "" },
              state: { code: "" },
              zip: "",
              country: { code: "" },
            },
            ueiSAM: r.award.awardee.ueiSAM ?? "",
          },
        }
      : null,
    pointOfContact: null,
    description,
    organizationType: r.organizationHierarchy?.[0]?.type ?? "",
    officeAddress: office?.address
      ? {
          zipcode: office.address.zip ?? "",
          city: office.address.city ?? "",
          countryCode: office.address.country ?? "",
          state: office.address.state ?? "",
        }
      : null,
    placeOfPerformance: null,
    uiLink: `https://sam.gov/opp/${r._id}/view`,
    resourceLinks: null,
  };
}
