import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolConfig } from "./upstream.ts";
import { createExaClient } from "./upstream.ts";

export const TOOL_NAMES = [
  "web_search_exa",
  "web_search_advanced_exa",
  "web_fetch_exa",
  "agent_create_run",
  "agent_wait_for_run",
  "agent_get_run_output",
  "agent_cancel_run",
] as const;

type JsonMap = Record<string, unknown>;
type AgentRun = JsonMap & { id: string; status: string; output?: JsonMap };
type BasicSearch = { query: string; numResults?: number };
type AdvancedSearch = {
  query: string;
  type?: typeof searchTypes[number];
  numResults?: number;
  category?: typeof categories[number];
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  startCrawlDate?: string;
  endCrawlDate?: string;
  includeText?: string[];
  excludeText?: string[];
  userLocation?: string;
  moderation?: boolean;
  additionalQueries?: string[];
  systemPrompt?: string;
  outputSchema?: JsonMap;
  textMaxCharacters?: number;
  contextMaxCharacters?: number;
  enableSummary?: boolean;
  summaryQuery?: string;
  enableHighlights?: boolean;
  highlightsMaxCharacters?: number;
  highlightsQuery?: string;
  maxAgeHours?: number;
  livecrawlTimeout?: number;
  subpages?: number;
  subpageTarget?: string[];
};
type FetchArgs = { urls: string[]; maxCharacters?: number };
type CreateArgs = {
  query: string;
  systemPrompt?: string;
  outputSchema?: JsonMap;
  input?: JsonMap;
  dataSources?: Array<{ provider: typeof providers[number] }>;
  previousRunId?: string;
  effort?: string;
};
type WaitArgs = {
  runId: string;
  timeoutSeconds?: number;
  pollIntervalMs?: number;
};
type OutputArgs = { runId: string; requireCompleted?: boolean };
type AgentApi = {
  agent: {
    runs: {
      create(input: JsonMap): Promise<AgentRun>;
      get(id: string): Promise<AgentRun>;
      cancel(id: string): Promise<AgentRun>;
    };
  };
  request<T>(
    path: string,
    method: string,
    body: unknown,
    query?: unknown,
    headers?: Record<string, string>,
  ): Promise<T>;
};

const searchTypes = [
  "auto",
  "fast",
  "instant",
  "deep-lite",
  "deep",
  "deep-reasoning",
] as const;
const providers = [
  "fiber",
  "financial_datasets",
  "similarweb",
  "baselayer",
  "affiliate",
  "particle",
  "jinko",
] as const;
const categories = [
  "company",
  "research paper",
  "news",
  "pdf",
  "github",
  "personal site",
  "people",
  "financial report",
] as const;
const record = z.record(z.unknown());

function api(config: ToolConfig): AgentApi {
  return createExaClient(config) as unknown as AgentApi;
}

function json(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function failure(tool: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `${tool} error: ${detail}` }],
    isError: true as const,
  };
}

function integration(tool: string) {
  return { "x-exa-integration": `${tool}:keypool-exa-mcp` };
}

export function registerTools(server: McpServer, config: ToolConfig): void {
  server.tool(
    "web_search_exa",
    "Search the web and return current results with useful excerpts.",
    {
      query: z.string().min(1),
      numResults: z.number().int().min(1).max(100).optional(),
    },
    { readOnlyHint: true, idempotentHint: true },
    async ({ query, numResults }: BasicSearch) => {
      try {
        const result = await api(config).request<JsonMap>(
          "/search",
          "POST",
          {
            query,
            type: "auto",
            numResults: numResults ?? 10,
            contents: { highlights: true },
          },
          undefined,
          integration("web-search-mcp"),
        );
        return json(result);
      } catch (error) {
        return failure("web_search_exa", error);
      }
    },
  );

  server.tool(
    "web_search_advanced_exa",
    "Advanced Exa search including deep modes, structured output, filters, summaries, highlights, and subpages.",
    {
      query: z.string().min(1),
      type: z.enum(searchTypes).optional(),
      numResults: z.number().int().min(1).max(100).optional(),
      category: z.enum(categories).optional(),
      includeDomains: z.array(z.string()).optional(),
      excludeDomains: z.array(z.string()).optional(),
      startPublishedDate: z.string().optional(),
      endPublishedDate: z.string().optional(),
      startCrawlDate: z.string().optional(),
      endCrawlDate: z.string().optional(),
      includeText: z.array(z.string()).optional(),
      excludeText: z.array(z.string()).optional(),
      userLocation: z.string().optional(),
      moderation: z.boolean().optional(),
      additionalQueries: z.array(z.string()).optional(),
      systemPrompt: z.string().optional(),
      outputSchema: record.optional(),
      textMaxCharacters: z.number().int().positive().optional(),
      contextMaxCharacters: z.number().int().positive().optional(),
      enableSummary: z.boolean().optional(),
      summaryQuery: z.string().optional(),
      enableHighlights: z.boolean().optional(),
      highlightsMaxCharacters: z.number().int().positive().optional(),
      highlightsQuery: z.string().optional(),
      maxAgeHours: z.number().min(0).optional(),
      livecrawlTimeout: z.number().int().positive().optional(),
      subpages: z.number().int().min(1).max(10).optional(),
      subpageTarget: z.array(z.string()).optional(),
    },
    { readOnlyHint: true, idempotentHint: true },
    async (params: AdvancedSearch) => {
      try {
        const contents: JsonMap = {
          text: params.textMaxCharacters
            ? { maxCharacters: params.textMaxCharacters }
            : true,
          ...(params.contextMaxCharacters
            ? { context: { maxCharacters: params.contextMaxCharacters } }
            : {}),
          ...(params.enableSummary
            ? {
              summary: params.summaryQuery
                ? { query: params.summaryQuery }
                : true,
            }
            : {}),
          ...(params.enableHighlights
            ? {
              highlights: {
                maxCharacters: params.highlightsMaxCharacters,
                query: params.highlightsQuery,
              },
            }
            : {}),
          ...(params.maxAgeHours !== undefined
            ? { maxAgeHours: params.maxAgeHours }
            : { livecrawl: "fallback" }),
          ...(params.livecrawlTimeout
            ? { livecrawlTimeout: params.livecrawlTimeout }
            : {}),
          ...(params.subpages ? { subpages: params.subpages } : {}),
          ...(params.subpageTarget
            ? { subpageTarget: params.subpageTarget }
            : {}),
        };
        const body = Object.fromEntries(
          Object.entries({
            ...params,
            type: params.type ?? "auto",
            numResults: params.numResults ?? 10,
            contents,
          }).filter(([, value]) => value !== undefined),
        );
        for (
          const key of [
            "textMaxCharacters",
            "contextMaxCharacters",
            "enableSummary",
            "summaryQuery",
            "enableHighlights",
            "highlightsMaxCharacters",
            "highlightsQuery",
            "maxAgeHours",
            "livecrawlTimeout",
            "subpages",
            "subpageTarget",
          ]
        ) delete body[key];
        return json(
          await api(config).request<JsonMap>(
            "/search",
            "POST",
            body,
            undefined,
            integration("web-search-advanced-mcp"),
          ),
        );
      } catch (error) {
        return failure("web_search_advanced_exa", error);
      }
    },
  );

  server.tool(
    "web_fetch_exa",
    "Read one or more URLs and return their full extracted content.",
    {
      urls: z.array(z.string().url()).min(1),
      maxCharacters: z.number().int().positive().optional(),
    },
    { readOnlyHint: true, idempotentHint: true },
    async ({ urls, maxCharacters }: FetchArgs) => {
      try {
        return json(
          await api(config).request<JsonMap>(
            "/contents",
            "POST",
            {
              urls,
              text: { maxCharacters: maxCharacters ?? 3000 },
            },
            undefined,
            integration("web-fetch-mcp"),
          ),
        );
      } catch (error) {
        return failure("web_fetch_exa", error);
      }
    },
  );

  server.tool(
    "agent_create_run",
    "Create an asynchronous Exa Agent run. Use outputSchema for repeatable structured results.",
    {
      query: z.string().min(1),
      systemPrompt: z.string().optional(),
      outputSchema: record.optional(),
      input: z.object({
        data: z.array(record).optional(),
        exclusion: z.array(record).optional(),
      }).optional(),
      dataSources: z.array(z.object({ provider: z.enum(providers) })).max(5)
        .optional(),
      previousRunId: z.string().optional(),
      effort: z.enum(["minimal", "low", "medium", "high", "xhigh", "auto"])
        .optional(),
    },
    { readOnlyHint: false, idempotentHint: false },
    async (params: CreateArgs) => {
      try {
        const run = await api(config).agent.runs.create({
          ...params,
          effort: params.effort ?? "auto",
        });
        return json({
          success: true,
          run,
          nextAction: `Call agent_wait_for_run with runId "${run.id}".`,
        });
      } catch (error) {
        return failure("agent_create_run", error);
      }
    },
  );

  server.tool(
    "agent_wait_for_run",
    "Poll an Exa Agent run until it is terminal or the bounded wait expires.",
    {
      runId: z.string().min(1),
      timeoutSeconds: z.number().min(1).max(50).optional(),
      pollIntervalMs: z.number().int().min(1000).max(10000).optional(),
    },
    { readOnlyHint: true, idempotentHint: true },
    async ({ runId, timeoutSeconds, pollIntervalMs }: WaitArgs) => {
      try {
        const deadline = Date.now() + (timeoutSeconds ?? 45) * 1000;
        let run = await api(config).agent.runs.get(runId);
        while (!terminal(run.status) && Date.now() < deadline) {
          await new Promise((resolve) =>
            setTimeout(resolve, pollIntervalMs ?? 4000)
          );
          run = await api(config).agent.runs.get(runId);
        }
        return json({
          success: true,
          terminal: terminal(run.status),
          timedOut: !terminal(run.status),
          run,
        });
      } catch (error) {
        return failure("agent_wait_for_run", error);
      }
    },
  );

  server.tool(
    "agent_get_run_output",
    "Retrieve Agent text, structured output, grounding, usage, and cost.",
    { runId: z.string().min(1), requireCompleted: z.boolean().optional() },
    { readOnlyHint: true, idempotentHint: true },
    async ({ runId, requireCompleted }: OutputArgs) => {
      try {
        const run = await api(config).agent.runs.get(runId);
        if ((requireCompleted ?? true) && run.status !== "completed") {
          return json({ success: true, outputReady: false, run });
        }
        return json({
          success: true,
          outputReady: run.status === "completed",
          run,
        });
      } catch (error) {
        return failure("agent_get_run_output", error);
      }
    },
  );

  server.tool(
    "agent_cancel_run",
    "Cancel a queued or running Exa Agent run.",
    { runId: z.string().min(1) },
    { readOnlyHint: false, idempotentHint: true },
    async ({ runId }: { runId: string }) => {
      try {
        return json({
          success: true,
          run: await api(config).agent.runs.cancel(runId),
        });
      } catch (error) {
        return failure("agent_cancel_run", error);
      }
    },
  );
}

function terminal(status: string): boolean {
  return status === "completed" || status === "failed" ||
    status === "cancelled";
}
