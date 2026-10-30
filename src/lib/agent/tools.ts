import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { categories, getItem, items } from "@/data/catalog";
import type { CategoryId } from "@/data/types";
import { searchCatalog, summarize } from "@/lib/search";

const categoryIds = categories.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export const searchCatalogTool = tool(
  async ({ categories: cats, audience, maxPriceTier, needsOpenSource, keywords }) => {
    const found = searchCatalog({ categories: cats, audience, maxPriceTier, needsOpenSource, keywords }, 5);
    return JSON.stringify(found.map(summarize));
  },
  {
    name: "search_catalog",
    description:
      "Search the comparison catalog (LLMs, open models, AI IDEs, cloud platforms, agent frameworks, vector DBs, chat assistants, image/video tools). Returns ranked items with pricing, fit scores, strengths and watch-outs.",
    schema: z.object({
      categories: z.array(z.enum(categoryIds)).describe("Categories to search; empty array searches all."),
      audience: z.enum(["personal", "enterprise", "both"]),
      maxPriceTier: z.number().describe("1 = free/cheap, 4 = premium. Use 4 when budget is unconstrained."),
      needsOpenSource: z.boolean(),
      keywords: z.array(z.string()).describe("Lowercase keywords describing the need, e.g. ['rag', 'python', 'hipaa']."),
    }),
  },
);

export const compareItemsTool = tool(
  async ({ ids }) => {
    const rows = ids.map((id) => getItem(id)).filter((i) => i !== undefined);
    if (!rows.length) return "No matching ids. Call list_items or search_catalog first to get valid ids.";
    return JSON.stringify(rows.map(summarize));
  },
  {
    name: "compare_items",
    description: "Fetch full side-by-side details for specific catalog item ids.",
    schema: z.object({ ids: z.array(z.string()).describe("Catalog item ids, e.g. ['cursor', 'claude-code'].") }),
  },
);

export const listItemsTool = tool(
  async ({ category }) =>
    JSON.stringify(items.filter((i) => i.category === category).map((i) => ({ id: i.id, name: i.name, vendor: i.vendor }))),
  {
    name: "list_items",
    description: "List every item id and name in one category.",
    schema: z.object({ category: z.enum(categoryIds) }),
  },
);

export const advisorTools = [searchCatalogTool, compareItemsTool, listItemsTool];
