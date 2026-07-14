import { createHandler } from "./app.ts";
import { loadConfig } from "./config.ts";

if (import.meta.main) {
  const config = loadConfig();
  console.error(`exa-mcp listening on :${config.port}`);
  Deno.serve({ port: config.port }, createHandler(config));
}
