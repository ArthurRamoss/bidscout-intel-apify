// =============================================================================
// USASpending.gov API Client
// Base: https://api.usaspending.gov
// Auth: NONE required
// =============================================================================

import type {
  USASpendingSearchResponse,
  USASpendingCategoryResponse,
} from "../types/index.js";

const BASE_URL = "https://api.usaspending.gov";

// ---------------------------------------------------------------------------
// Generic POST helper
// ---------------------------------------------------------------------------

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `USASpending API error ${response.status}: ${response.statusText} — ${text}`
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Build filters object (reused across endpoints)
// ---------------------------------------------------------------------------

interface FilterOptions {
  naicsCode: string;
  agency?: string;
  keyword?: string;
  startDate: string;
  endDate: string;
}

function buildFilters(opts: FilterOptions): Record<string, unknown> {
  const filters: Record<string, unknown> = {
    award_type_codes: ["A", "B", "C", "D"], // BPA Call, Purchase Order, Delivery Order, Definitive Contract
    naics_codes: { require: [opts.naicsCode] },
    time_period: [{ start_date: opts.startDate, end_date: opts.endDate }],
  };

  if (opts.agency) {
    filters.agencies = [
      { type: "awarding", tier: "toptier", name: opts.agency },
    ];
  }

  if (opts.keyword) {
    filters.keywords = [opts.keyword];
  }

  return filters;
}

// ---------------------------------------------------------------------------
// Search awards (used by Tool 2: detect_incumbents & Tool 3: competitive_landscape)
// ---------------------------------------------------------------------------

export interface SearchAwardsOptions {
  naicsCode: string;
  agency?: string;
  keyword?: string;
  startDate: string;
  endDate: string;
  limit?: number;
  page?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export async function searchAwards(
  opts: SearchAwardsOptions
): Promise<USASpendingSearchResponse> {
  return post<USASpendingSearchResponse>(
    "/api/v2/search/spending_by_award/",
    {
      filters: buildFilters({
        naicsCode: opts.naicsCode,
        agency: opts.agency,
        keyword: opts.keyword,
        startDate: opts.startDate,
        endDate: opts.endDate,
      }),
      fields: [
        "Award ID",
        "Recipient Name",
        "Start Date",
        "End Date",
        "Award Amount",
        "Awarding Agency",
        "Awarding Sub Agency",
        "Contract Award Type",
        "NAICS Code",
        "Description",
        "generated_internal_id",
        "recipient_id",
      ],
      sort: opts.sort ?? "Award Amount",
      order: opts.order ?? "desc",
      limit: opts.limit ?? 100,
      page: opts.page ?? 1,
      subawards: false,
    }
  );
}

// ---------------------------------------------------------------------------
// Spending by category (used by Tool 3: competitive_landscape)
// Categories: awarding_agency, awarding_subagency, recipient_duns, naics
// ---------------------------------------------------------------------------

export type SpendingCategory =
  | "awarding_agency"
  | "awarding_subagency"
  | "recipient_duns"
  | "naics";

export interface SpendingByCategoryOptions {
  category: SpendingCategory;
  naicsCode: string;
  agency?: string;
  startDate: string;
  endDate: string;
  limit?: number;
  page?: number;
}

export async function searchByCategory(
  opts: SpendingByCategoryOptions
): Promise<USASpendingCategoryResponse> {
  return post<USASpendingCategoryResponse>(
    `/api/v2/search/spending_by_category/${opts.category}/`,
    {
      filters: buildFilters({
        naicsCode: opts.naicsCode,
        agency: opts.agency,
        startDate: opts.startDate,
        endDate: opts.endDate,
      }),
      category: opts.category,
      limit: opts.limit ?? 10,
      page: opts.page ?? 1,
      subawards: false,
    }
  );
}
