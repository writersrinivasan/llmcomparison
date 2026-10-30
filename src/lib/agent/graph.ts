import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGroq } from "@langchain/groq";
import { AIMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { Annotation, END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { SNAPSHOT_DATE, categories } from "@/data/catalog";
import type { CategoryId, Item } from "@/data/types";
import { heuristicPlan, searchCatalog, type Plan } from "@/lib/search";
import { advisorTools } from "./tools";

export const MODEL_ID = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
export const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

// Server-side refusal fallback is only accepted on these models (Claude API).
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export type LLMConfig =
  | { provider: "anthropic"; model: string }
  | { provider: "groq"; model: string; apiKey: string; byok: boolean };

export interface BYOK {
  groqKey?: string;
  groqModel?: string;
}

/** A user-supplied Groq key wins; otherwise fall back to server-configured providers. */
export function resolveLLM(byok?: BYOK): LLMConfig | null {
  const userKey = byok?.groqKey?.trim();
  if (userKey) return { provider: "groq", apiKey: userKey, model: byok?.groqModel?.trim() || DEFAULT_GROQ_MODEL, byok: true };
  if (process.env.ANTHROPIC_API_KEY) return { provider: "anthropic", model: MODEL_ID };
  if (process.env.GROQ_API_KEY) return { provider: "groq", apiKey: process.env.GROQ_API_KEY, model: DEFAULT_GROQ_MODEL, byok: false };
  return null;
}

/** Human-readable label for the configured provider — never includes the key. */
export function describeLLM(llm: LLMConfig | null) {
  if (!llm) return null;
  return llm.provider === "anthropic" ? `Claude · ${llm.model}` : `Groq · ${llm.model}${llm.byok ? " (your key)" : ""}`;
}

function makeModel(llm: LLMConfig, effort: "low" | "medium" | "high") {
  if (llm.provider === "groq") {
    return new ChatGroq({ apiKey: llm.apiKey, model: llm.model, temperature: effort === "low" ? 0 : 0.3, maxTokens: 4096 });
  }
  const fallback = FALLBACK_MODELS.has(llm.model);
  return new ChatAnthropic({
    model: llm.model,
    maxTokens: 16000,
    thinking: { type: "adaptive" },
    outputConfig: { effort },
    ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], invocationKwargs: { fallbacks: "default" } } : {}),
  });
}

const categoryIds = categories.map((c) => c.id) as [CategoryId, ...CategoryId[]];

const PlanSchema = z.object({
  categories: z.array(z.enum(categoryIds)).describe("1-3 most relevant catalog categories"),
  audience: z.enum(["personal", "enterprise", "both"]),
  maxPriceTier: z.number().describe("1 = free/cheap … 4 = premium; 4 if budget not mentioned"),
  needsOpenSource: z.boolean(),
  keywords: z.array(z.string()).describe("lowercase keywords capturing the requirements"),
});

const AdvisorState = Annotation.Root({
  ...MessagesAnnotation.spec,
  plan: Annotation<Plan | null>({ reducer: (_, b) => b, default: () => null }),
  shortlist: Annotation<Item[]>({ reducer: (_, b) => b, default: () => [] }),
  mode: Annotation<"llm" | "offline">({ reducer: (_, b) => b, default: () => "offline" }),
});

type State = typeof AdvisorState.State;

function lastUserText(messages: BaseMessage[]) {
  const last = [...messages].reverse().find((m) => m.getType() === "human");
  return last?.text ?? "";
}

/**
 * Builds the advisor graph for one request. The LLM config (which may hold a
 * user's own API key) is captured in a closure rather than passed through
 * `configurable`, so it never lands in run metadata or traces.
 */
export function buildAdvisorGraph(llm: LLMConfig | null) {
  /** Node 1 — understand the request: categories, audience, budget, constraints. */
  async function planner(state: State): Promise<Partial<State>> {
    const query = lastUserText(state.messages);
    if (!llm) return { plan: heuristicPlan(query), mode: "offline" };
    const system = new SystemMessage(
      `Classify a request for an AI tooling comparison catalog. Categories: ${categories
        .map((c) => `${c.id} (${c.name})`)
        .join(", ")}.`,
    );
    try {
      const structured =
        llm.provider === "anthropic"
          ? makeModel(llm, "low").withStructuredOutput(PlanSchema, { method: "jsonSchema" })
          : makeModel(llm, "low").withStructuredOutput(PlanSchema, { name: "plan" });
      const plan = await structured.invoke([system, ...state.messages]);
      return { plan, mode: "llm" };
    } catch (err) {
      // Keep the LLM researcher; only the planning falls back to rules.
      console.error(`[advisor] ${llm.provider} planner failed, using rule-based plan:`, err instanceof Error ? err.message : err);
      return { plan: heuristicPlan(query), mode: "llm" };
    }
  }

  /** Node 2 — deterministic retrieval from the catalog based on the plan. */
  function retrieve(state: State): Partial<State> {
    return { shortlist: searchCatalog(state.plan ?? heuristicPlan(lastUserText(state.messages)), 3) };
  }

  /** Node 3 — tool-using analyst that researches and writes the recommendation. */
  async function researcher(state: State): Promise<Partial<State>> {
    const model = makeModel(llm!, "medium").bindTools(advisorTools);
    const system = new SystemMessage(
      [
        `You are the AI Compare Hub advisor: a friendly, sharp consultant helping individuals and enterprises choose AI models, IDEs, platforms, agent frameworks, vector databases, assistants and creative tools.`,
        `Ground every recommendation in the catalog tools (search_catalog, compare_items, list_items). The catalog is an editorial snapshot from ${SNAPSHOT_DATE}; tell users to verify prices on vendor sites.`,
        `Planner output: ${JSON.stringify(state.plan)}`,
        `Pre-retrieved shortlist: ${state.shortlist.map((i) => `${i.id} (${i.name})`).join(", ")}`,
        `Answer in Markdown: a one-line verdict, a "Top picks" list (bold the exact catalog name — why, who it's for), a compact comparison table when comparing 2+ options, and "Watch-outs". Keep it under ~350 words.`,
      ].join("\n"),
    );
    const response = await model.invoke([system, ...state.messages]);
    return { messages: [response] };
  }

  /** Offline alternative to the researcher when no model is configured. */
  function composeOffline(state: State): Partial<State> {
    const plan = state.plan!;
    const byCat = new Map<CategoryId, Item[]>();
    for (const item of state.shortlist) byCat.set(item.category, [...(byCat.get(item.category) ?? []), item]);
    const audienceLabel = plan.audience === "both" ? "personal & enterprise use" : `${plan.audience} use`;
    const sections = [...byCat.entries()].map(([cat, list]) => {
      const meta = categories.find((c) => c.id === cat)!;
      const rows = list
        .map((i) => `- **${i.name}** (${i.vendor}) — ${i.tagline} _Best for: ${i.bestFor.join(", ")}._`)
        .join("\n");
      return `### ${meta.emoji} ${meta.name}\n${rows}`;
    });
    const text = [
      `**Top picks for ${audienceLabel}${plan.maxPriceTier <= 2 ? " on a budget" : ""}${plan.needsOpenSource ? " (open-source friendly)" : ""}:**`,
      ...sections,
      `> Offline mode: these picks come from rule-based ranking. Add your own Groq key with the 🔑 button above (or set \`ANTHROPIC_API_KEY\` on the server) for full AI analysis.`,
    ].join("\n\n");
    return { messages: [new AIMessage(text)] };
  }

  return new StateGraph(AdvisorState)
    .addNode("planner", planner)
    .addNode("retrieve", retrieve)
    .addNode("researcher", researcher)
    .addNode("tools", new ToolNode(advisorTools))
    .addNode("compose_offline", composeOffline)
    .addEdge(START, "planner")
    .addEdge("planner", "retrieve")
    .addConditionalEdges("retrieve", (s: State) => (s.mode === "llm" ? "researcher" : "compose_offline"), [
      "researcher",
      "compose_offline",
    ])
    .addConditionalEdges("researcher", toolsCondition, ["tools", END])
    .addEdge("tools", "researcher")
    .addEdge("compose_offline", END)
    .compile();
}
