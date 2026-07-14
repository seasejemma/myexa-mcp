# myexa-mcp

A small Deno MCP gateway for team search tooling. It exposes the current Exa
tool surface exclusively through an Exa-compatible KeyPool upstream.

Licensed under the terms in [`LICENSE`](LICENSE).

## Endpoints

- `GET /health` — public deployment health and version
- `POST /mcp` — stateless Streamable HTTP MCP; KeyPool Bearer authentication
- `/api/*` — transparent Exa REST proxy; Bearer or `x-api-key` authentication

The MCP inventory is fixed: `web_search_exa`, `web_search_advanced_exa`,
`web_fetch_exa`, and four Agent run tools (create, wait, output, cancel).
Historical aliases are intentionally gone. Upstream's OAuth resource-server
support only accepts Exa-issued JWTs from `auth.exa.ai`; it is not a KeyPool
authorization server or token exchange, so this deployment does not advertise
OAuth. Callers authenticate with their existing KeyPool token.

Search Monitors remain available through `/api/*`. KeyPool intentionally returns
`404 CAPABILITY_NOT_SUPPORTED` for Websets.

## Connect

Obtain the MCP endpoint and a KeyPool token through your team's private channel.
Keep both values in your local environment:

```bash
export MYEXA_MCP_URL='https://your-team-endpoint.example/mcp'
export KEYPOOL_TOKEN='your-team-token'
```

The server accepts either of these request headers:

```text
Authorization: Bearer <KEYPOOL_TOKEN>
x-api-key: <KEYPOOL_TOKEN>
```

Do not put the endpoint or token in a shared repository.

## Exa API skill

The reusable agent skill lives in [`skills/exa-api`](skills/exa-api). Install it
globally with Vercel's [`skills` CLI](https://www.skills.sh/docs/cli); it
detects installed agents automatically:

```bash
npx skills add seasejemma/myexa-mcp --skill exa-api --global --yes
```

To target the five clients documented below explicitly:

```bash
npx skills add seasejemma/myexa-mcp --skill exa-api --global --yes \
  --agent codex --agent pi --agent claude-code --agent cursor --agent goose
```

`add-skill` is an executable alias shipped by the same npm package, but
`npx skills add` is the documented invocation and avoids resolving an unrelated
npm package named `add-skill`.

The skill tracks current Exa SDK and API capabilities. It contains no endpoint
or credential.

## MCP client setup

Run these after exporting `MYEXA_MCP_URL` and `KEYPOOL_TOKEN` as shown above.
The examples install the server for the current user, except Pi's shared config,
which can also be stored as a project-level `.mcp.json`.

### Codex

Codex can read the Bearer token directly from an environment variable:

```bash
codex mcp add myexa --url "$MYEXA_MCP_URL" \
  --bearer-token-env-var KEYPOOL_TOKEN
codex mcp list
```

### Pi

Pi does not include an MCP client. Install the reviewed
[`pi-mcp-adapter`](https://pi.dev/packages/pi-mcp-adapter), restart Pi, and put
this entry in `~/.config/mcp/mcp.json`:

```bash
pi install npm:pi-mcp-adapter
```

```json
{
  "mcpServers": {
    "myexa": {
      "url": "https://your-team-endpoint.example/mcp",
      "auth": "bearer",
      "bearerTokenEnv": "KEYPOOL_TOKEN",
      "lifecycle": "lazy"
    }
  }
}
```

Use `/mcp` inside Pi to verify the connection. If another client is already
configured, `pi-mcp-adapter init` can import its MCP configuration instead.

### Claude Code

The single-quoted JSON deliberately stores environment-variable references, not
their current values:

```bash
claude mcp add-json --scope user myexa \
  '{"type":"http","url":"${MYEXA_MCP_URL}","headers":{"Authorization":"Bearer ${KEYPOOL_TOKEN}"}}'
claude mcp get myexa
```

### Cursor

Cursor's CLI accepts a user-level MCP definition. This command builds the JSON
without putting the literal token in shell history; Cursor stores it in the
local user profile:

```bash
cursor --add-mcp "$(jq -cn \
  --arg url "$MYEXA_MCP_URL" \
  --arg authorization "Bearer $KEYPOOL_TOKEN" \
  '{name:"myexa",url:$url,headers:{Authorization:$authorization}}')"
```

Alternatively, add the same `url` and `headers` fields under `myexa` in the
user-only `~/.cursor/mcp.json` file.

### Goose

Goose's configuration command supports authenticated remote Streamable HTTP
extensions:

```bash
goose configure
```

Choose `Add Extension` → `Remote Extension (Streamable HTTP)`, name it `myexa`,
enter `$MYEXA_MCP_URL`, and add the custom header `Authorization` with value
`Bearer <KEYPOOL_TOKEN>`. Goose stores this in the local user configuration. The
one-session `--with-streamable-http-extension` flag does not accept custom
headers, so it is not suitable for this authenticated endpoint.

## Development

Copy `env.example` to an ignored `.env`, load it with direnv, then:

```bash
deno task ci
deno task dev
```

Raw operator smoke test:

```bash
MCP_SERVER_ENDPOINT=http://localhost:8000 KEYPOOL_TOKEN=... deno task smoke
```

## Deployment

Deno Deploy builds linked GitHub branches in its Development context and `main`
in Production. `deno.json` records the non-secret Deno app binding required by
the CLI; the endpoint and environment values stay in Deno settings. GitHub
Actions runs offline checks only and holds no deployment or caller credential.

Configure the runtime settings described in
[`secret-contract.yaml`](secret-contract.yaml) in both Deno contexts. Deno
stores no credential: it validates each caller's token with KeyPool `/whoami`,
then forwards that token only to the KeyPool Exa API.

See [`AGENTS.md`](AGENTS.md) for the maintenance and promotion workflow.
