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

Use this gate sequence for every release candidate. Do not evaluate one commit
and promote another.

1. Work on a feature branch. Run `deno task ci` and `deno task check-env`.
   Offline tests must distinguish the intended behavior from plausible wrong
   implementations, especially at timeout, streaming, auth, and protocol-era
   boundaries.
2. Commit the tested tree. Deploy that exact commit to a Deno Development
   preview, never Production, and record its commit and Deno revision.
3. Run the credentialed `deno task smoke` against that preview. It must cover
   health, legacy inventory, modern discovery, all seven tool names, and a real
   search.
4. Run the opt-in, costed `deno task eval:agent` against the same preview when
   MCP, Exa, Agent, auth, runtime, or deployment behavior changed. The eval must
   assert semantic output, use a deadline, cancel nonterminal runs, and emit no
   token, run identifier, or Agent content.
5. Record the offline, smoke, and eval evidence in the pull request. Merge only
   the evaluated commit. A docs-only change may mark live gates not applicable
   with a reason.
6. After Production deploys from `main`, verify `/health`, authenticated MCP
   `tools/list`, at least one real search, the streaming REST proxy, and an
   Agent lifecycle request. Roll back with the prior Deno revision when needed.

```bash
deno task ci
deno task check-env
MCP_SERVER_ENDPOINT=... KEYPOOL_TOKEN=... deno task smoke
MCP_SERVER_ENDPOINT=... KEYPOOL_TOKEN=... deno task eval:agent
```

GitHub Actions is the credential-free offline gate. Never add KeyPool or Exa
credentials to Actions to automate the live gates; run those from an approved
operator profile instead.

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
