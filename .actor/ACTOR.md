# BidScout Federal Contracts Intelligence

> **Unofficial.** BidScout is an independent third-party tool. It is **not affiliated with, endorsed by, or sponsored by** the U.S. federal government, any U.S. government agency, or any third-party data provider whose public records may be referenced. All trademarks and service marks are the property of their respective owners.

Turn federal government contract data into actionable competitive intelligence. BidScout aggregates and enriches authoritative federal procurement data so government contractors can find opportunities, identify incumbents, and map competitive landscapes — at a fraction of legacy provider pricing.

This Actor runs as a **persistent HTTP API** (Standby mode) and **also speaks the Model Context Protocol** — connect it directly to Claude Desktop, Cursor, or any MCP client.

## What it does

### 1. Search Federal Opportunities — `tool-call-search`
Searches active federal contract opportunities. Filter by keyword, NAICS code, set-aside type, agency, and state.

### 2. Detect Incumbent Contractors — `tool-call-incumbents`
Identifies current contractors with expiring federal contracts and calculates a **proprietary recompete probability score (0-100)** based on proximity to expiration, contract value, and duration. This is competitive intelligence that typically costs $25K/yr from legacy providers like GovWin.

### 3. Analyze Competitive Landscape — `tool-call-landscape`
Comprehensive market intelligence: total market size, top agencies by spend, top contractors by value won, expiring contracts summary, and strategic insights.

## Use cases

- Government contractors looking for upcoming recompete opportunities
- Business development teams mapping competitive landscapes by NAICS
- Small businesses finding set-aside opportunities (8(a), WOSB, SDVOSBC, HUBZone)
- AI agents that need federal procurement intelligence as a tool

## Pricing — Pay Per Event

| Event | Price | What you get |
|---|---|---|
| `tool-call-search` | **$0.03** | One federal opportunity search |
| `tool-call-incumbents` | **$0.75** | One incumbent-detection run with proprietary recompete scoring (vs $25K/yr legacy = ~1000× cheaper) |
| `tool-call-landscape` | **$0.12** | One landscape briefing with aggregated market intelligence |

Monitor your spend in real time from the Apify Console billing dashboard. The Actor returns HTTP `402` (or an MCP error) if the platform reports a per-event budget cap was reached.

## How to use it

### Option A — MCP client (Claude Desktop / Cursor / mcp-inspector)

Add to your MCP client config. Example for Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "bidscout": {
      "url": "https://<your-actor-id>.apify.actor/mcp",
      "headers": { "Authorization": "Bearer <YOUR_APIFY_TOKEN>" }
    }
  }
}
```

Restart your MCP client. Then ask the model things like:
- *"Find incumbent contractors in NAICS 541512 with contracts expiring in the next 6 months."*
- *"Show me the competitive landscape for cybersecurity contracts, top 10 contractors over 3 years."*

### Option B — REST API (curl / your own SDK)

**Search opportunities:**
```bash
curl -X POST "https://<your-actor-id>.apify.actor/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_APIFY_TOKEN>" \
  -d '{"keyword": "cybersecurity", "naicsCode": "541512"}'
```

**Detect incumbents (the high-value call):**
```bash
curl -X POST "https://<your-actor-id>.apify.actor/incumbents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_APIFY_TOKEN>" \
  -d '{"naicsCode": "541512", "expiringWithinMonths": 12}'
```

**Competitive landscape:**
```bash
curl -X POST "https://<your-actor-id>.apify.actor/landscape" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_APIFY_TOKEN>" \
  -d '{"naicsCode": "541512", "lookbackYears": 3}'
```

**Discover capabilities:**
```bash
curl "https://<your-actor-id>.apify.actor/tools"
```

### Option C — Batch run (Apify Console / scheduled task)

Use the Input form to pick an `action` and parameters. Results are pushed to the default dataset. Each batch run triggers the same Pay-Per-Event charge as a single HTTP call.
