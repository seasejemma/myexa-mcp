export type RuntimeConfig = {
  baseUrl: string;
  port: number;
};

export function loadConfig(
  env: Record<string, string | undefined> = Deno.env.toObject(),
): RuntimeConfig {
  const baseUrl = required(env, "KEYPOOL_EXA_BASE_URL").replace(/\/$/, "");
  if (!baseUrl.endsWith("/v1/exa")) {
    throw new Error("KEYPOOL_EXA_BASE_URL must end with /v1/exa");
  }
  return {
    baseUrl,
    port: Number(env.PORT ?? "8000"),
  };
}

function required(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
