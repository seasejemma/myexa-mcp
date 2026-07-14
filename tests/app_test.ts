import { assert, assertEquals, assertThrows } from "std/assert";
import { createHandler } from "../src/app.ts";
import {
  authorizeKeyPoolToken,
  requestToken,
  type TokenAuthorizer,
  unauthorized,
} from "../src/auth.ts";
import { loadConfig, type RuntimeConfig } from "../src/config.ts";
import { TOOL_NAMES } from "../src/tools.ts";

const baseConfig: RuntimeConfig = {
  baseUrl: "http://127.0.0.1:9/v1/exa",
  port: 8000,
};

const allowUser: TokenAuthorizer = (token) =>
  Promise.resolve(
    token === "user-secret" ? null : unauthorized("invalid_token"),
  );

Deno.test("configuration hard-requires the KeyPool contract", () => {
  assertThrows(() => loadConfig({}), Error, "KEYPOOL_EXA_BASE_URL");
  assertThrows(
    () =>
      loadConfig({
        KEYPOOL_EXA_BASE_URL: "https://example.test",
      }),
    Error,
    "must end with /v1/exa",
  );
});

Deno.test("Agent wait polls through the current SDK and stops on completion", async () => {
  let requests = 0;
  const upstream = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    (request) => {
      requests++;
      assertEquals(
        new URL(request.url).pathname,
        "/v1/exa/agent/runs/agent_run_test",
      );
      return Response.json({
        id: "agent_run_test",
        status: requests === 1 ? "running" : "completed",
        output: requests === 1 ? undefined : { text: "done" },
      });
    },
  );
  try {
    const handler = createHandler(
      {
        ...baseConfig,
        baseUrl: `http://127.0.0.1:${upstream.addr.port}/v1/exa`,
      },
      allowUser,
    );
    const response = await handler(
      new Request("https://m.test/mcp", {
        method: "POST",
        headers: {
          authorization: "Bearer user-secret",
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "agent_wait_for_run",
            arguments: {
              runId: "agent_run_test",
              pollIntervalMs: 1000,
              timeoutSeconds: 3,
            },
          },
        }),
      }),
    );
    assertEquals(response.status, 200);
    assertEquals(requests, 2);
    const payload = await response.json();
    assert(payload.result.content[0].text.includes('"terminal": true'));
  } finally {
    await upstream.shutdown();
  }
});

Deno.test("request auth accepts Bearer and x-api-key credentials", () => {
  assertEquals(
    requestToken(
      new Request("https://m.test/mcp", {
        headers: { authorization: "Bearer user-secret" },
      }),
    ),
    "user-secret",
  );
  assertEquals(
    requestToken(
      new Request("https://m.test/mcp", {
        headers: { "x-api-key": "user-secret" },
      }),
    ),
    "user-secret",
  );
  assertEquals(
    requestToken(new Request("https://m.test/mcp")),
    undefined,
  );
});

Deno.test("auth delegates token validity and Exa access to KeyPool whoami", async () => {
  const keypool = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    (request) => {
      assertEquals(new URL(request.url).pathname, "/whoami");
      const authorization = request.headers.get("authorization");
      if (authorization === "Bearer invalid") {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      return Response.json({
        services: { exa: authorization === "Bearer user-secret" },
      });
    },
  );
  const config = {
    ...baseConfig,
    baseUrl: `http://127.0.0.1:${keypool.addr.port}/v1/exa`,
  };
  try {
    assertEquals(await authorizeKeyPoolToken("user-secret", config), null);
    assertEquals(
      (await authorizeKeyPoolToken("invalid", config))?.status,
      401,
    );
    assertEquals(
      (await authorizeKeyPoolToken("no-exa", config))?.status,
      403,
    );
  } finally {
    await keypool.shutdown();
  }
});

Deno.test("configuration needs no credential stored in the runtime", () => {
  assertEquals(
    loadConfig({ KEYPOOL_EXA_BASE_URL: "https://keypool.test/v1/exa" }),
    { baseUrl: "https://keypool.test/v1/exa", port: 8000 },
  );
});

Deno.test("health is public while operational routes require auth", async () => {
  const handler = createHandler(baseConfig, allowUser);
  assertEquals(
    (await handler(new Request("https://m.test/health"))).status,
    200,
  );
  assertEquals(
    (await handler(new Request("https://m.test/mcp", { method: "POST" })))
      .status,
    401,
  );
  assertEquals(
    (await handler(
      new Request("https://m.test/admin/tokens", {
        headers: { authorization: "Bearer user-secret" },
      }),
    )).status,
    404,
  );
});

Deno.test("REST proxy preserves method and query, replaces caller credentials", async () => {
  let seen: {
    method?: string;
    path?: string;
    key?: string;
    authorization?: string | null;
    body?: string;
  } = {};
  const upstream = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    async (request) => {
      const url = new URL(request.url);
      seen = {
        method: request.method,
        path: `${url.pathname}${url.search}`,
        key: request.headers.get("x-api-key") ?? undefined,
        authorization: request.headers.get("authorization"),
        body: await request.text(),
      };
      return Response.json({ ok: true });
    },
  );
  try {
    const config = {
      ...baseConfig,
      baseUrl: `http://127.0.0.1:${upstream.addr.port}/v1/exa`,
    };
    const response = await createHandler(config, allowUser)(
      new Request("https://m.test/api/search?mode=deep", {
        method: "PATCH",
        headers: {
          authorization: "Bearer user-secret",
          "content-type": "application/json",
        },
        body: '{"query":"x"}',
      }),
    );
    assertEquals(response.status, 200);
    assertEquals(seen, {
      method: "PATCH",
      path: "/v1/exa/search?mode=deep",
      key: "user-secret",
      authorization: null,
      body: '{"query":"x"}',
    });
  } finally {
    await upstream.shutdown();
  }
});

Deno.test("REST proxy returns streaming bodies without buffering", async () => {
  const encoder = new TextEncoder();
  const upstream = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode("event: first\ndata: 1\n\n"));
            setTimeout(() => {
              controller.enqueue(encoder.encode("event: second\ndata: 2\n\n"));
              controller.close();
            }, 250);
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      ),
  );
  try {
    const config = {
      ...baseConfig,
      baseUrl: `http://127.0.0.1:${upstream.addr.port}/v1/exa`,
    };
    const response = await createHandler(config, allowUser)(
      new Request("https://m.test/api/agent/runs", {
        headers: { authorization: "Bearer user-secret" },
      }),
    );
    assertEquals(response.headers.get("content-type"), "text/event-stream");
    const reader = response.body!.getReader();
    const first = await reader.read();
    assertEquals(
      new TextDecoder().decode(first.value),
      "event: first\ndata: 1\n\n",
    );
    await reader.cancel();
  } finally {
    await upstream.shutdown();
  }
});

Deno.test("MCP inventory is the seven modern tools with no aliases", async () => {
  const handler = createHandler(baseConfig, allowUser);
  const response = await handler(
    new Request("https://m.test/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer user-secret",
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    }),
  );
  assertEquals(response.status, 200, await response.clone().text());
  const payload = await response.json();
  assertEquals(
    payload.result.tools.map((tool: { name: string }) => tool.name),
    TOOL_NAMES,
  );
});

Deno.test("advanced search forwards deep fields and current Connect enum is advertised", async () => {
  let body: Record<string, unknown> = {};
  const upstream = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    async (request) => {
      body = await request.json();
      return Response.json({ results: [] });
    },
  );
  try {
    const config = {
      ...baseConfig,
      baseUrl: `http://127.0.0.1:${upstream.addr.port}/v1/exa`,
    };
    const handler = createHandler(config, allowUser);
    const call = await handler(
      new Request("https://m.test/mcp", {
        method: "POST",
        headers: {
          authorization: "Bearer user-secret",
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "web_search_advanced_exa",
            arguments: {
              query: "x",
              type: "deep-reasoning",
              systemPrompt: "cite",
              outputSchema: { type: "object" },
              additionalQueries: ["y"],
            },
          },
        }),
      }),
    );
    assertEquals(call.status, 200, await call.clone().text());
    assertEquals(body.type, "deep-reasoning");
    assertEquals(body.systemPrompt, "cite");
    assertEquals(body.additionalQueries, ["y"]);

    const list = await handler(
      new Request("https://m.test/mcp", {
        method: "POST",
        headers: {
          authorization: "Bearer user-secret",
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/list",
          params: {},
        }),
      }),
    );
    const tools = (await list.json()).result.tools;
    const create = tools.find((tool: { name: string }) =>
      tool.name === "agent_create_run"
    );
    const providerEnum =
      create.inputSchema.properties.dataSources.items.properties.provider.enum;
    assertEquals(providerEnum, [
      "fiber",
      "financial_datasets",
      "similarweb",
      "baselayer",
      "affiliate",
      "particle",
      "jinko",
    ]);
  } finally {
    await upstream.shutdown();
  }
});
