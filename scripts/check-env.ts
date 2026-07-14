import { loadConfig } from "../src/config.ts";

if (import.meta.main) {
  const config = loadConfig();
  console.log(JSON.stringify({
    ok: true,
    baseUrl: new URL(config.baseUrl).origin + "/.../v1/exa",
    runtimeSecretsRequired: false,
  }));
}
