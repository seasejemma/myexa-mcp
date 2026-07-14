import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  authorizeKeyPoolToken,
  requestToken,
  type TokenAuthorizer,
  unauthorized,
} from "./auth.ts";
import type { RuntimeConfig } from "./config.ts";
import { createMcpServer } from "./server.ts";
import { proxyExa } from "./upstream.ts";
import { SERVER_NAME, SERVER_VERSION, UPSTREAM_COMMIT } from "./version.ts";

export function createHandler(
  config: RuntimeConfig,
  authorizeToken: TokenAuthorizer = authorizeKeyPoolToken,
) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (
      (url.pathname === "/" || url.pathname === "/health") &&
      request.method === "GET"
    ) {
      return Response.json({
        status: "ok",
        server: SERVER_NAME,
        version: SERVER_VERSION,
        upstreamCommit: UPSTREAM_COMMIT,
        authRequired: true,
        upstream: "keypool",
      });
    }
    const token = requestToken(request);
    if (!token) return unauthorized();
    const authFailure = await authorizeToken(token, config);
    if (authFailure) return authFailure;
    if (url.pathname === "/mcp") {
      if (request.method === "GET") {
        return Response.json({ error: "method_not_allowed" }, {
          status: 405,
          headers: { allow: "POST, DELETE" },
        });
      }
      if (request.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      if (request.method !== "POST") {
        return Response.json({ error: "method_not_allowed" }, { status: 405 });
      }
      return await handleMcp(request, config, token);
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return await proxyExa(request, config, token);
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  };
}

async function handleMcp(
  request: Request,
  config: RuntimeConfig,
  token: string,
): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createMcpServer({
    baseUrl: config.baseUrl,
    teamToken: token,
  });
  await server.connect(transport);
  return await transport.handleRequest(request);
}
