# bidscout-intel-apify

An Apify Actor that exposes federal contract intelligence as both:
- a REST API (`POST /search`, `POST /incumbents`, `POST /landscape`), and
- a native **MCP server** (`POST /mcp`) — pluggable into Claude Desktop, Cursor, and any other MCP client.

Monetized via Apify Store with Pay-Per-Event pricing.

## Repository layout

```
src/
├── server.ts            Entry point: Standby HTTP server + batch-mode dispatch
├── mcp-server.ts        StreamableHTTPServerTransport wiring for /mcp
├── tools/
│   ├── index.ts         Tool catalog (TOOLS array — single source of truth)
│   ├── schemas.ts       zod schemas (ARG_SCHEMA), TOOL_EVENT, HTTP_ROUTE maps
│   ├── handlers.ts      Dispatcher: handleToolCall(name, args)
│   ├── search-opportunities.ts
│   ├── detect-incumbents.ts
│   └── competitive-landscape.ts
├── api/                       Internal data-source clients (proprietary)
├── utils/
│   ├── scoring.ts       Recompete probability formula
│   ├── date-helpers.ts
│   └── normalizer.ts
└── types/index.ts

.actor/
├── actor.json                 Apify manifest (webServerMcpPath: "/mcp")
├── INPUT_SCHEMA.json          Batch-mode input form
├── DATASET_SCHEMA.json
├── web_server_openapi.json    OpenAPI for the REST surface
└── ACTOR.md                   Apify Store page content

Dockerfile          Multi-stage build, base apify/actor-node:20
```

## Local development

```bash
npm install
npm run dev          # tsx watch — starts the HTTP server on ACTOR_WEB_SERVER_PORT (default 4321)
# In another terminal:
curl http://localhost:4321/tools
curl -X POST http://localhost:4321/incumbents -H 'Content-Type: application/json' -d '{"naicsCode":"541512"}'
```

Batch-mode dispatch (mirrors what runs when an Apify task fires the Actor with an input):

```bash
# Put { "action": "detect_incumbents", "naicsCode": "541512" } in storage/key_value_stores/default/INPUT.json
apify run
# Results land in storage/datasets/default/
```

MCP smoke test:

```bash
npm run dev
npx @modelcontextprotocol/inspector --cli http://localhost:4321/mcp
# In inspector: List Tools → 3 tools; Call detect_incumbents → structured result
```

Charge-cap test (verifies Pay-Per-Event monetization):

```bash
ACTOR_TEST_PAY_PER_EVENT=true \
ACTOR_USE_CHARGING_LOG_DATASET=true \
APIFY_MAX_TOTAL_CHARGE_USD=0.10 \
npm run dev
# First POST /incumbents → 200; second → 402 EVENT_CHARGE_LIMIT_REACHED
# Check storage/datasets/charging_log/ for event entries
```

## Deploying

```bash
npm install -g apify-cli
apify login
apify push
```

Then in the Apify Console:
1. Open the new build → **Publication** → **Monetization** → choose **Pay Per Event** → define `tool-call-search` ($0.03), `tool-call-incumbents` ($0.75), `tool-call-landscape` ($0.12).
2. **Publish on Store**.

See `.actor/ACTOR.md` for the user-facing Store page.

## License

MIT
