const endpoint = Deno.env.get("MCP_SERVER_ENDPOINT")?.replace(/\/$/, "");
const token = Deno.env.get("KEYPOOL_TOKEN");
if (!endpoint || !token) {
  throw new Error("MCP_SERVER_ENDPOINT and KEYPOOL_TOKEN are required");
}

const health = await fetch(`${endpoint}/health`);
if (!health.ok) throw new Error(`health failed: ${health.status}`);
const payload = await health.json();
if (payload.status !== "ok") throw new Error("health payload is not ok");

type McpPayload = {
  error?: unknown;
  result: {
    isError?: boolean;
    resultType?: string;
    supportedVersions?: string[];
    content?: unknown[];
    tools: ReadonlyArray<{ name: string }>;
  };
};

async function mcpPayload(response: Response): Promise<McpPayload> {
  const body = await response.text();
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    return JSON.parse(body);
  }
  const messages = body.split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
  if (messages.length === 0) throw new Error(`empty MCP stream: ${body}`);
  return messages.at(-1) as McpPayload;
}

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
const initializeResult = await mcpPayload(initialized);
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
const result = await mcpPayload(mcp);
if (
  result.error || result.result?.isError === true ||
  result.result?.tools?.length !== 7
) {
  throw new Error(`unexpected MCP inventory: ${JSON.stringify(result)}`);
}

const modernMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": {
    name: "exa-mcp-smoke",
    version: "1",
  },
  "io.modelcontextprotocol/clientCapabilities": {},
};
const discovered = await fetch(`${endpoint}/mcp`, {
  method: "POST",
  headers: {
    ...mcpHeaders,
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": "server/discover",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "server/discover",
    params: { _meta: modernMeta },
  }),
});
if (!discovered.ok) {
  throw new Error(
    `MCP server/discover failed: ${discovered.status} ${await discovered
      .text()}`,
  );
}
const discovery = await mcpPayload(discovered);
if (
  discovery.result?.resultType !== "complete" ||
  !discovery.result?.supportedVersions?.includes("2026-07-28")
) {
  throw new Error(`unexpected MCP discovery: ${JSON.stringify(discovery)}`);
}

const searched = await fetch(`${endpoint}/mcp`, {
  method: "POST",
  headers: {
    ...mcpHeaders,
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": "tools/call",
    "Mcp-Name": "web_search_exa",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      _meta: modernMeta,
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
const searchResult = await mcpPayload(searched);
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
    modernProtocol: discovery.result.supportedVersions,
    liveSearch: "ok",
  }),
);
