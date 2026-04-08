# BidScout Federal Contracts Intelligence

Turn federal government contract data into actionable competitive intelligence. BidScout analyzes USASpending and SAM.gov to help government contractors find opportunities, identify incumbents, and map competitive landscapes.

## What it does

BidScout provides three powerful analysis tools:

### 1. Search Federal Opportunities
Searches active contract opportunities on SAM.gov including solicitations, presolicitations, sources sought, and award notices. Filter by keyword, NAICS code, set-aside type, agency, and state.

### 2. Detect Incumbent Contractors
Identifies current contractors with expiring federal contracts and calculates a **recompete probability score (0-100)** based on proximity to expiration, contract value, and duration. This is competitive intelligence that typically costs $25K/yr from GovWin.

### 3. Analyze Competitive Landscape
Comprehensive market intelligence briefing including total market size, top agencies by spend, top contractors by value won, expiring contracts summary, and strategic insights about market concentration.

## Use cases

- **Government contractors** looking for upcoming recompete opportunities
- **Business development teams** mapping competitive landscapes by NAICS code
- **Small businesses** finding set-aside opportunities (8(a), WOSB, SDVOSBC, HUBZone)
- **Market researchers** analyzing federal spending patterns

## Input

| Parameter | Description |
|-----------|-------------|
| `action` | Which analysis to run: `search_opportunities`, `detect_incumbents`, or `competitive_landscape` |
| `keyword` | Search term for opportunities or contracts |
| `naicsCode` | 6-digit NAICS code (e.g. `541512` for Computer Systems Design) |
| `agency` | Filter by federal agency name |
| `setAside` | Small business set-aside filter |
| `state` | 2-letter state code for place of performance |

## Output

Results are saved to the default dataset in JSON format with full structured data including contract details, scores, rankings, and strategic insights.

## Standby Mode (API)

This Actor supports **Standby mode** for real-time API access. Send POST requests to run analyses on-demand without waiting for Actor startup.

### API Examples

**Search opportunities:**
```bash
curl -X POST "https://YOUR_ACTOR_URL" \
  -H "Content-Type: application/json" \
  -d '{"action": "search_opportunities", "keyword": "cybersecurity", "naicsCode": "541512"}'
```

**Detect incumbents:**
```bash
curl -X POST "https://YOUR_ACTOR_URL" \
  -H "Content-Type: application/json" \
  -d '{"action": "detect_incumbents", "naicsCode": "541512", "expiringWithinMonths": 12}'
```

## Data sources

- **SAM.gov** - Federal procurement opportunities
- **USASpending.gov** - Federal contract awards and spending data

## Cost

This Actor uses the **Pay Per Event** pricing model. You are charged per analysis performed. No platform compute costs are passed to you.
