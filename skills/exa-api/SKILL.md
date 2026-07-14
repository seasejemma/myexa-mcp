---
name: exa-api
description: Work with Exa's current official TypeScript and Python SDKs and HTTP API. Use when implementing or reviewing Exa Search, Contents, Answer, Agent, Exa Connect data sources, Search Monitors, streaming, continuation, SDK upgrades, API documentation, or determining why Websets are unavailable with free credits.
---

# Exa API

Treat Exa as a fast-moving API. Derive syntax from current installed packages
and official sources instead of recalling older Search- and Research-only
clients.

## Source order

1. Inspect the installed `exa-js` and `exa-py` versions, exported types, and
   client methods.
2. Read the current Exa SDK specifications and
   `https://exa.ai/docs/exa-spec.yaml`.
3. Use Exa's official `exa-labs/exa-mcp-server` skills for workflow ideas, not
   SDK method or provider-name spelling.
4. Use community skills only as secondary comparisons.

## Workflow

1. Identify the needed family with
   [references/capabilities.md](references/capabilities.md).
2. For search planning, read
   [references/search-recipes.md](references/search-recipes.md).
3. Confirm the installed method signature in both requested languages.
4. Keep the API key and base URL configurable; custom proxies require both.
5. Prefer stable namespaces and current calls. Isolate deprecated compatibility
   samples.
6. For Agent or Connect, read
   [references/agent-connect.md](references/agent-connect.md).
7. Separate offline surface checks, cheap live calls, and costed/stateful tests.
8. Clean up resources created by Search Monitor or Agent tests.

## Default rules

- Prefer `search` with `contents` over deprecated combined helpers.
- Prefer `agent` over the deprecated `beta.agent` alias.
- Treat Connect as Agent `dataSources` / `data_sources`, not a separate client.
- Persist returned IDs for every stateful resource and continuation.
- Preserve SSE streaming; never buffer a whole Agent, Search, or Answer stream
  merely to inspect it.
- Treat list calls as account-scoped discovery unless the surrounding system
  explicitly aggregates accounts.
- Keep upstream plan, entitlement, and usage errors distinct from transport or
  SDK compatibility errors.
- Verify provider identifiers against current Connect docs; do not copy MCP tool
  identifiers into SDK requests.
- Treat the complete Websets family as unavailable for free-credit integrations.
  Its SDK namespace does not imply usable entitlement; do not advertise or test
  Websets as supported without an explicit paid-plan change.

## Refresh checklist

- Upgrade both official SDKs before editing samples.
- Compare current exported namespaces/methods with the repository's coverage
  contract.
- Re-check bundled search recipes against the current SDK specifications and
  OpenAPI source.
- Re-run type/surface tests before live tests.
- Record any official-doc versus released-SDK mismatch explicitly.
