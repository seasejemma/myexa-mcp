import { Exa } from "exa-js";
import type { RuntimeConfig } from "./config.ts";

export type ToolConfig = { baseUrl: string; teamToken: string };

export function createExaClient(config: ToolConfig): Exa {
  return new Exa(config.teamToken, config.baseUrl);
}

const HOP_BY_HOP = new Set([
  "authorization",
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-api-key",
]);

export async function proxyExa(
  request: Request,
  config: RuntimeConfig,
  token: string,
): Promise<Response> {
  const incoming = new URL(request.url);
  const suffix = incoming.pathname.slice("/api".length);
  const upstream = new URL(`${config.baseUrl}${suffix || "/"}`);
  upstream.search = incoming.search;
  const headers = new Headers();
  for (const [name, value] of request.headers) {
    if (!HOP_BY_HOP.has(name.toLowerCase())) headers.set(name, value);
  }
  headers.set("x-api-key", token);
  headers.set("x-exa-integration", "keypool-exa-mcp-rest");
  const response = await fetch(upstream, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD"
      ? undefined
      : request.body,
    redirect: "manual",
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
