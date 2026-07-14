# Agent and Connect operating notes

## Create and retrieve

- Use `agent.runs.create` with a bounded query, effort, and output schema.
- Non-streaming creation returns a run object with `id`.
- Streaming creation emits `agent_run.created`; capture its `data.id` before
  later get, events, cancel, or delete calls.
- Use the SDK polling helper only after preserving the ID independently.

## Continue

- Pass `previousRunId` in TypeScript or `previous_run_id` in Python.
- A continuation creates a new run; it does not reuse the prior ID.
- Continuation must reach the same upstream account as the previous run in any
  multi-account proxy.

## Connect

- Pass providers as `dataSources: [{ provider: "..." }]` or
  `data_sources=[{"provider": "..."}]`.
- Verify current provider strings in the Connect docs. API examples such as
  `similarweb` may differ from names used by MCP tool wrappers.
- Expect provider-specific entitlement and usage charges. Bound `maxItems` and
  requested contact fields.

## Streaming and retention

- Proxy SSE incrementally and inspect only bounded event prefixes when an ID
  must be captured.
- Do not convert an Agent stream into buffered JSON.
- Zero Data Retention accounts require streaming and restrict retrieval,
  continuation, and Connect; preserve the upstream error instead of masking it.

## Tests

- Keep method/namespace drift checks offline.
- Use the lowest effort supported by the installed SDK for live smokes.
- Put costed Agent/Connect tests behind an explicit flag.
- Delete created runs in `finally`, and report entitlement skips separately from
  passes.
