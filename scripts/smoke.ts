const endpoint = Deno.env.get("MCP_SERVER_ENDPOINT")?.replace(/\/$/, "");
const token = Deno.env.get("KEYPOOL_TOKEN");
if (!endpoint || !token) {
  throw new Error("MCP_SERVER_ENDPOINT and KEYPOOL_TOKEN are required");
}

const health = await fetch(`${endpoint}/health`);
if (!health.ok) throw new Error(`health failed: ${health.status}`);
const payload = await health.json();
if (payload.status !== "ok") throw new Error("health payload is not ok");

const mcpHeaders = {
  authorization: `Bearer ${token}`,
  accept: "application/json, text/event-stream",
  "content-type": "application/json",
};
const initialized = await fetch(`${endpoint}/mcp`, {
  method: "POST",
  headers: mcpHeaders,
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "exa-mcp-smoke", version: "1" },
    },
  }),
});
if (!initialized.ok) {
  throw new Error(
    `MCP initialize failed: ${initialized.status} ${await initialized.text()}`,
  );
}
const initializeResult = await initialized.json();
if (initializeResult.error || initializeResult.result?.isError === true) {
  throw new Error(
    `MCP initialize returned an error: ${JSON.stringify(initializeResult)}`,
  );
}

const mcp = await fetch(`${endpoint}/mcp`, {
  method: "POST",
  headers: mcpHeaders,
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  }),
});
if (!mcp.ok) {
  throw new Error(`MCP tools/list failed: ${mcp.status} ${await mcp.text()}`);
}
const result = await mcp.json();
if (
  result.error || result.result?.isError === true ||
  result.result?.tools?.length !== 7
) {
  throw new Error(`unexpected MCP inventory: ${JSON.stringify(result)}`);
}

const searched = await fetch(`${endpoint}/mcp`, {
  method: "POST",
  headers: mcpHeaders,
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "web_search_exa",
      arguments: {
        query: "Deno Deploy official documentation",
        numResults: 1,
      },
    },
  }),
});
if (!searched.ok) {
  throw new Error(
    `MCP web_search_exa failed: ${searched.status} ${await searched.text()}`,
  );
}
const searchResult = await searched.json();
if (
  searchResult.error || searchResult.result?.isError === true ||
  !searchResult.result?.content?.length
) {
  throw new Error(
    `web_search_exa returned an error: ${JSON.stringify(searchResult)}`,
  );
}
console.log(
  JSON.stringify({
    ok: true,
    version: payload.version,
    tools: result.result.tools.map((tool: { name: string }) => tool.name),
    liveSearch: "ok",
  }),
);
