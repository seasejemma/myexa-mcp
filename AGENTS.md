# AGENTS.md

This is `myexa-mcp`, a Deno-only KeyPool-backed fork of
`exa-labs/exa-mcp-server`.

## Runtime contract

- Production entrypoint: `src/main_deno.ts`.
- Deno Deploy builds `main` as Production and other linked branches as
  Development previews. `deno.json` records the non-secret app binding needed by
  the Deno CLI; environment values and domains stay in Deno settings.
- All Exa traffic must use `KEYPOOL_EXA_BASE_URL`; there is no direct
  `api.exa.ai` fallback or local key rotation.
- The caller supplies a KeyPool token as `Authorization: Bearer` (preferred) or
  `x-api-key`. Validate it through KeyPool `/whoami`, require `services.exa`,
  and forward it request-by-request only to KeyPool. Never log or store it.
- Deno Deploy holds no secret. `KEYPOOL_EXA_BASE_URL` is configuration, not a
  credential.
- Keep `/mcp` stateless. Keep `/api/*` streaming; never buffer SSE or NDJSON
  responses.
- MCP has exactly the seven names in `src/tools.ts`. Monitors are REST-only.
  Websets are unsupported by KeyPool.
- Legacy tool aliases were removed in the hard cut. Upstream OAuth verifies
  Exa-issued JWTs from `auth.exa.ai`; it is not compatible with KeyPool until
  KeyPool supports the issuer/audience or token exchange. Do not advertise a
  broken OAuth flow.

## Upstream updates

Review upstream changes rather than merging its tree. Update `UPSTREAM_COMMIT`
in `src/version.ts`, port relevant current tool/API changes, and preserve the
fork invariants above. Exa SDK/API work must be checked against current official
documentation and `exa-js` types.

## Verification and promotion

```bash
deno task ci
deno task check-env
MCP_SERVER_ENDPOINT=... KEYPOOL_TOKEN=... deno task smoke
```

Work on a branch and verify the Deno Development preview before promoting the
exact commit to `main`. After Production deploys, verify `/health`,
authenticated MCP `tools/list`, at least one real search, the REST proxy, and an
Agent lifecycle request. Roll back with the prior Deno revision when needed.

## Secrets

Follow `secret-contract.yaml`. Do not print, commit, or copy secret values into
documentation or logs. Local `.env` is ignored. Each client owns its
`KEYPOOL_TOKEN`. GitHub Actions performs offline checks and holds no runtime
credential. Deno Deploy must not contain `KEYPOOL_TOKEN`, `KEYPOOL_TEAM_TOKEN`,
or `MCP_AUTH_TOKEN`.

## Public repository

- Keep production endpoints and caller credentials out of tracked files.
- Keep the repository low-profile: no registry publication or discovery topics
  unless the owner explicitly changes that policy.
- Preserve the Exa Labs license and upstream commit attribution.
- The public Exa API skill is in `skills/exa-api`; keep its references together.
