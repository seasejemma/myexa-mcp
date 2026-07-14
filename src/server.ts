import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolConfig } from "./upstream.ts";
import { registerTools } from "./tools.ts";
import { SERVER_NAME, SERVER_VERSION } from "./version.ts";

export function createMcpServer(config: ToolConfig): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    title: "Exa via KeyPool",
    version: SERVER_VERSION,
  });
  registerTools(server, config);
  return server;
}
