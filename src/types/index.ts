// =============================================================================
// BidScout Intel — TypeScript Interfaces
// =============================================================================

// ---------------------------------------------------------------------------
// Shared / Common
// ---------------------------------------------------------------------------

export interface QueryEcho {
  naicsCode: string;
  agency?: string;
  keyword?: string;
  expiringWithinMonths?: number;
  lookbackYears?: number;
  agencyFilter?: string;
}

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  title: string;
}

// ---------------------------------------------------------------------------
// Tool 1 — search_federal_opportunities (SAM.gov)
// ---------------------------------------------------------------------------

export interface SearchOpportunitiesInput {
  keyword: string;
  naicsCode?: string;
  setAside?: string;
  agency?: string;
  state?: string;
  postedWithinDays?: number;
}

export interface AwardInfo {
  awardDate: string;
  awardAmount: number;
  awardeeName: string;
  awardeeUei: string;
}

export interface Opportunity {
  noticeId: string;
  title: string;
  solicitationNumber: string;
  agency: string;
  postedDate: string;
  type: string;
  responseDeadline: string;
  naicsCode: string;
  classificationCode: string;
  setAside: string;
  setAsideCode: string;
  placeOfPerformance: string;
  awardInfo: AwardInfo;
  contactInfo: ContactInfo;
  samLink: string;
  resourceLinks: string[];
}

export interface SearchOpportunitiesResult {
  totalRecords: number;
  opportunities: Opportunity[];
  searchSummary: string;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Tool 2 — detect_incumbents (USASpending)
// ---------------------------------------------------------------------------

export interface DetectIncumbentsInput {
  naicsCode: string;
  agency?: string;
  keyword?: string;
  expiringWithinMonths?: number;
}

export interface ExpiringContract {
  contractId: string;
  title: string;
  incumbentName: string;
  awardAmountUsd: number;
  awardingAgency: string;
  awardingSubAgency: string;
  startDate: string;
  endDate: string;
  daysUntilExpiration: number;
  recompeteScore: number;
  naicsCode: string;
  contractType: string;
}

export interface TopIncumbent {
  name: string;
  totalValueUsd: number;
  contractCount: number;
  avgRecompeteScore: number;
}

export interface DetectIncumbentsResult {
  query: QueryEcho;
  totalContractsFound: number;
  totalValueUsd: number;
  expiringContracts: ExpiringContract[];
  topIncumbents: TopIncumbent[];
  strategicInsights: string[];
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Tool 3 — analyze_competitive_landscape (USASpending)
// ---------------------------------------------------------------------------

export interface CompetitiveLandscapeInput {
  naicsCode: string;
  lookbackYears?: number;
  agencyFilter?: string;
}

export interface MarketOverview {
  totalContractValueUsd: number;
  totalContractCount: number;
  averageContractValueUsd: number;
}

export interface TopAgency {
  agencyName: string;
  totalSpendUsd: number;
  agencyCode: string;
}

export interface TopContractor {
  contractorName: string;
  totalWonUsd: number;
  contractCount: number;
  recipientId: string;
}

export interface TopExpiringContract {
  contractId: string;
  incumbentName: string;
  valueUsd: number;
  agency: string;
  endDate: string;
}

export interface ExpiringContractsSummary {
  count: number;
  totalValueUsd: number;
  topExpiring: TopExpiringContract[];
}

export interface CompetitiveLandscapeResult {
  query: QueryEcho;
  marketOverview: MarketOverview;
  topAgencies: TopAgency[];
  topContractors: TopContractor[];
  expiringContractsSummary: ExpiringContractsSummary;
  strategicInsights: string[];
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// USASpending API — Raw response types
// ---------------------------------------------------------------------------

export interface USASpendingAwardResult {
  "Award ID": string;
  "Recipient Name": string;
  "Start Date": string;
  "End Date": string;
  "Award Amount": number;
  "Awarding Agency": string;
  "Awarding Sub Agency": string;
  "Contract Award Type": string;
  "NAICS Code": string;
  Description: string;
  generated_internal_id: string;
  recipient_id: string;
}

export interface USASpendingSearchResponse {
  limit: number;
  results: USASpendingAwardResult[];
  page_metadata: {
    page: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface USASpendingCategoryResult {
  amount: number;
  code: string;
  name: string;
  id: number;
}

export interface USASpendingCategoryResponse {
  results: USASpendingCategoryResult[];
  page_metadata: {
    page: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// ---------------------------------------------------------------------------
// SAM.gov API — Raw response types
// ---------------------------------------------------------------------------

export interface SAMOpportunityRaw {
  noticeId: string;
  title: string;
  solicitationNumber: string;
  fullParentPathName: string;
  fullParentPathCode: string;
  postedDate: string;
  type: string;
  baseType: string;
  archiveType: string;
  archiveDate: string;
  typeOfSetAsideDescription: string | null;
  typeOfSetAside: string | null;
  responseDeadLine: string | null;
  naicsCode: string | null;
  classificationCode: string | null;
  active: string; // "Yes" | "No"
  award: {
    date: string;
    number: string;
    amount: string; // STRING not number!
    awardee: {
      name: string;
      location: {
        city: { name: string };
        state: { code: string };
        zip: string;
        country: { code: string };
      };
      ueiSAM: string;
    };
  } | null;
  pointOfContact: Array<{
    type: string;
    email: string;
    phone: string;
    title: string;
    fullName: string;
  }> | null;
  description: string;
  organizationType: string;
  officeAddress: {
    zipcode: string;
    city: string;
    countryCode: string;
    state: string;
  } | null;
  placeOfPerformance: {
    city: { name: string };
    state: { code: string };
    zip: string;
  } | null;
  uiLink: string;
  resourceLinks: string[] | null;
}

export interface SAMSearchResponse {
  totalRecords: number;
  limit: number;
  offset: number;
  opportunitiesData: SAMOpportunityRaw[];
}

// ---------------------------------------------------------------------------
// Tool call handler types
// ---------------------------------------------------------------------------

export type ToolName =
  | "search_federal_opportunities"
  | "detect_incumbents"
  | "analyze_competitive_landscape";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
}
