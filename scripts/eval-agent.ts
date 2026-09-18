const endpoint = Deno.env.get("MCP_SERVER_ENDPOINT")?.replace(/\/$/, "");
const token = Deno.env.get("KEYPOOL_TOKEN");
if (!endpoint || !token) {
  console.error(JSON.stringify({ ok: false, agentLifecycle: "config_error" }));
  Deno.exit(1);
}

const configuredTimeout = Number(Deno.env.get("EVAL_TIMEOUT_SECONDS") ?? "120");
if (!Number.isFinite(configuredTimeout) || configuredTimeout < 10) {
  console.error(JSON.stringify({ ok: false, agentLifecycle: "config_error" }));
  Deno.exit(1);
}

type ToolResult = {
  success?: boolean;
  outputReady?: boolean;
  run?: {
    id?: string;
    status?: string;
    output?: { structured?: Record<string, unknown> };
  };
};

type McpPayload = {
  error?: unknown;
  result?: {
    isError?: boolean;
    content?: Array<{ type: string; text?: string }>;
  };
};

const modernMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": {
    name: "myexa-agent-eval",
    version: "1",
  },
  "io.modelcontextprotocol/clientCapabilities": {},
};
let requestId = 0;

async function callTool(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolResult> {
  const response = await fetch(`${endpoint}/mcp`, {
    method: "POST",
    signal,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "tools/call",
      "Mcp-Name": name,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++requestId,
      method: "tools/call",
      params: { _meta: modernMeta, name, arguments: args },
    }),
  });
  if (!response.ok) throw new Error(`${name} HTTP ${response.status}`);
  const payload = await mcpPayload(response);
  if (payload.error || payload.result?.isError) {
    throw new Error(`${name} returned an error`);
  }
  const text = payload.result?.content?.find((item) => item.type === "text")
    ?.text;
  if (!text) throw new Error(`${name} returned no text result`);
  const result = JSON.parse(text) as ToolResult;
  if (!result.success) throw new Error(`${name} was not successful`);
  return result;
}

async function mcpPayload(response: Response): Promise<McpPayload> {
  const body = await response.text();
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    return JSON.parse(body);
  }
  const messages = body.split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as McpPayload);
  const payload = messages.at(-1);
  if (!payload) throw new Error("MCP returned an empty stream");
  return payload;
}

async function evaluateAgent(): Promise<void> {
  const created = await callTool("agent_create_run", {
    query: "Return an object whose answer field is exactly the string ok.",
    outputSchema: {
      type: "object",
      properties: { answer: { type: "string", const: "ok" } },
      required: ["answer"],
      additionalProperties: false,
    },
    effort: "minimal",
  });
  const runId = created.run?.id;
  if (!runId) throw new Error("agent_create_run returned no run ID");

  const deadline = Date.now() + configuredTimeout * 1000;
  let lastStatus: string | undefined;
  try {
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const result = await callTool("agent_get_run_output", {
        runId,
        requireCompleted: false,
      }, AbortSignal.timeout(remaining));
      lastStatus = result.run?.status;
      if (result.outputReady && lastStatus === "completed") {
        if (result.run?.output?.structured?.answer !== "ok") {
          throw new Error("Agent output did not satisfy the eval assertion");
        }
        return;
      }
      if (lastStatus === "failed" || lastStatus === "cancelled") {
        throw new Error(`Agent reached ${lastStatus}`);
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, Math.min(3000, deadline - Date.now())))
      );
    }
  } catch (error) {
    if (!terminal(lastStatus)) await cancel(runId);
    throw error;
  }

  await cancel(runId);
  throw new Error("Agent lifecycle timed out and was cancelled");
}

function terminal(status: string | undefined): boolean {
  return status === "completed" || status === "failed" ||
    status === "cancelled";
}

async function cancel(runId: string): Promise<void> {
  try {
    await callTool(
      "agent_cancel_run",
      { runId },
      AbortSignal.timeout(10_000),
    );
  } catch {
    // The eval still fails without exposing the run identifier or response.
  }
}

try {
  await evaluateAgent();
  console.log(JSON.stringify({ ok: true, agentLifecycle: "completed" }));
} catch {
  console.error(JSON.stringify({ ok: false, agentLifecycle: "failed" }));
  Deno.exit(1);
}
