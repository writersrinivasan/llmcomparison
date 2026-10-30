import { categories, items } from "@/data/catalog";
import type { CategoryId, Item } from "@/data/types";

export type Audience = "personal" | "enterprise" | "both";

export interface Plan {
  categories: CategoryId[];
  audience: Audience;
  /** 1 = free/cheap … 4 = premium */
  maxPriceTier: number;
  needsOpenSource: boolean;
  keywords: string[];
}

const CATEGORY_HINTS: Record<CategoryId, string[]> = {
  llms: ["llm", "model", "gpt", "claude", "gemini", "grok", "reasoning", "api model", "frontier", "chatbot backend"],
  "open-models": ["open source", "open-source", "open weight", "self-host", "self host", "local", "on-prem", "llama", "qwen", "deepseek", "ollama", "offline", "fine-tune", "finetune"],
  ides: ["ide", "code", "coding", "developer", "editor", "copilot", "cursor", "programming", "refactor", "vscode", "terminal"],
  platforms: ["platform", "cloud", "aws", "azure", "gcp", "bedrock", "vertex", "foundry", "hosting", "deploy", "inference", "provider"],
  "agent-frameworks": ["agent", "agentic", "framework", "langgraph", "crewai", "autogen", "multi-agent", "orchestration", "workflow"],
  "vector-dbs": ["vector", "rag", "embedding", "retrieval", "semantic search", "knowledge base", "database", "memory"],
  assistants: ["assistant", "chat app", "chatgpt", "productivity", "writing", "research", "everyday", "personal use", "office", "email"],
  creative: ["image", "video", "art", "design", "creative", "marketing visuals", "photo", "illustration", "generate pictures"],
};

const ENTERPRISE_HINTS = ["enterprise", "company", "business", "team", "compliance", "soc", "hipaa", "gdpr", "governance", "org", "corporate", "production", "scale"];
const PERSONAL_HINTS = ["personal", "hobby", "student", "myself", "side project", "individual", "freelance", "learning", "home"];
const BUDGET_HINTS = ["cheap", "free", "budget", "low cost", "affordable", "inexpensive"];

const STOPWORDS = new Set(["the", "a", "an", "for", "and", "or", "to", "of", "in", "on", "with", "is", "are", "i", "my", "we", "our", "best", "which", "what", "should", "use", "need", "want", "me", "it", "that", "this", "can", "do", "good", "top", "vs", "compare"]);

/** Whole-word (or whole-phrase) match, so "art" doesn't fire on "startup". */
function mentions(q: string, hints: string[]) {
  return hints.some((h) => new RegExp(`\\b${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`).test(q));
}

/** Rule-based planner used when no model is configured (and as a safety net). */
export function heuristicPlan(query: string): Plan {
  const q = query.toLowerCase();
  const cats = (Object.keys(CATEGORY_HINTS) as CategoryId[]).filter((c) => mentions(q, CATEGORY_HINTS[c]));
  const enterprise = mentions(q, ENTERPRISE_HINTS);
  const personal = mentions(q, PERSONAL_HINTS);
  return {
    categories: cats.length ? cats.slice(0, 3) : ["llms", "assistants"],
    audience: enterprise && !personal ? "enterprise" : personal && !enterprise ? "personal" : "both",
    maxPriceTier: mentions(q, BUDGET_HINTS) ? 2 : 4,
    needsOpenSource: /open[- ]?(source|weight)|self[- ]?host|on[- ]?prem|local/.test(q),
    keywords: q.split(/[^a-z0-9.+#-]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  };
}

function haystack(item: Item) {
  return [
    item.name,
    item.vendor,
    item.tagline,
    item.pricing,
    ...item.strengths,
    ...item.bestFor,
    ...Object.values(item.specs),
  ]
    .join(" ")
    .toLowerCase();
}

export function scoreItem(item: Item, plan: Plan) {
  const text = haystack(item);
  const keywordHits = plan.keywords.filter((k) => text.includes(k.toLowerCase())).length;
  const fit =
    plan.audience === "personal"
      ? item.personal
      : plan.audience === "enterprise"
        ? item.enterprise
        : (item.personal + item.enterprise) / 2;
  return fit * 2 + keywordHits * 1.5 - (item.priceTier > plan.maxPriceTier ? 4 : 0);
}

export function searchCatalog(plan: Plan, perCategory = 4): Item[] {
  const cats = plan.categories.length ? plan.categories : categories.map((c) => c.id);
  return cats.flatMap((cat) =>
    items
      .filter((i) => i.category === cat && (!plan.needsOpenSource || i.openSource || cat === "platforms"))
      .map((i) => ({ i, s: scoreItem(i, plan) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, perCategory)
      .map(({ i }) => i),
  );
}

/** Compact representation handed to the model as tool output. */
export function summarize(item: Item) {
  return {
    id: item.id,
    name: item.name,
    vendor: item.vendor,
    category: item.category,
    pricing: item.pricing,
    openSource: item.openSource,
    personalFit: item.personal,
    enterpriseFit: item.enterprise,
    strengths: item.strengths,
    watchOuts: item.watchOuts,
    bestFor: item.bestFor,
    specs: item.specs,
  };
}
