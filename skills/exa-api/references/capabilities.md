# Exa SDK capability map

## Core client

- Search: regular modes, deep modes, structured deep output, inline contents,
  and `streamSearch` / `stream_search`.
- Stored-page snapshots: use `snapshotAsOf` only with the supported search and
  contents combinations; snapshots have a rolling retention window and plan
  restrictions.
- Dynamic highlights: beta, cross-result highlight budgeting. It requires the
  current beta header and cannot be combined with per-document `maxCharacters`.
- Contents: text, highlights, summaries, context, and subpages through
  `getContents` / `get_contents`.
- Answer: synchronous and streamed answers with citations.
- Compatibility: `searchAndContents`, `findSimilar`, and combined find-similar
  helpers are deprecated.

## Agent and Connect

- Stable namespace: `agent.runs`.
- Lifecycle: create, stream, get, list, cancel, delete, poll/create-and-wait
  helpers, and stored events.
- Graceful stop preserves partial results and is distinct from cancellation.
- Agent Max and Agent Monitors are beta surfaces with separate headers,
  entitlement, and cost implications. Do not enable them by default.
- Continuation: create a new run with `previousRunId` / `previous_run_id`;
  retain both IDs.
- Connect: pass `dataSources` / `data_sources` during Agent creation.

## Batch and OpenAI-compatible routes

- Batch Search and Agent requests are enterprise beta REST capabilities; the
  TypeScript SDK does not currently provide a dedicated Batch namespace.
- OpenAI-compatible `/chat/completions` and `/responses` routes map to Answer
  and Agent. Their availability must be checked independently from the native
  Answer and Agent routes.
- Provider-neutral, OpenAI, and Anthropic tool helpers are client conveniences;
  they do not add Exa endpoints or justify additional MCP tools.

## Search Monitors

- `monitors`: create, get, list, update, delete, and trigger.
- `monitors.runs`: list and get run history.
- Creation currently requires an HTTPS webhook configuration.

## Unavailable: Websets

The official SDKs expose `websets` and subclients for items, searches,
enrichments, events, imports, monitors, and webhooks. Do not treat those
namespaces as generally accessible: Exa requires a paid plan, and free Exa
credits do not grant Websets access.

For KeyPool and other free-credit integrations, omit the Websets `/v0/*` routes
from supported API references, samples, affinity configuration, and live-test
claims. Record the exclusion explicitly instead of presenting entitlement
failures as optional skips.

## Legacy Research

The `research` namespace remains for compatibility. Prefer Agent for new
long-running structured research workflows unless existing behavior or cost
requires Research.

## Authoritative sources

- OpenAPI: `https://exa.ai/docs/exa-spec.yaml`
- TypeScript SDK specification:
  `https://exa.ai/docs/sdks/typescript-sdk-specification`
- Python SDK specification: `https://exa.ai/docs/sdks/python-sdk-specification`
- Agent guide: `https://exa.ai/docs/reference/agent-api-guide`
- Connect: `https://exa.ai/docs/reference/agent-api/connect/overview`
- Official skills: `https://github.com/exa-labs/exa-mcp-server/tree/main/skills`
