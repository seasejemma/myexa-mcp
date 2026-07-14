import type { RuntimeConfig } from "./config.ts";

export type TokenAuthorizer = (
  token: string,
  config: RuntimeConfig,
) => Promise<Response | null>;

export function requestToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }
  return request.headers.get("x-api-key")?.trim() || undefined;
}

export async function authorizeKeyPoolToken(
  token: string,
  config: RuntimeConfig,
): Promise<Response | null> {
  let response: Response;
  try {
    response = await fetch(new URL("/whoami", config.baseUrl), {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
  } catch {
    return Response.json({ error: "keypool_auth_unavailable" }, {
      status: 503,
    });
  }

  if (response.status === 401) return unauthorized("invalid_token");
  if (!response.ok) {
    return Response.json({ error: "keypool_auth_unavailable" }, {
      status: response.status >= 500 ? 503 : response.status,
    });
  }

  try {
    const identity = await response.json();
    if (identity?.services?.exa !== true) {
      return Response.json({ error: "keypool_exa_forbidden" }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "keypool_auth_invalid_response" }, {
      status: 503,
    });
  }
  return null;
}

export function unauthorized(
  reason: "missing" | "invalid_token" = "missing",
): Response {
  const challenge = reason === "invalid_token"
    ? 'Bearer realm="keypool", error="invalid_token"'
    : 'Bearer realm="keypool"';
  return Response.json({ error: reason }, {
    status: 401,
    headers: { "www-authenticate": challenge },
  });
}
