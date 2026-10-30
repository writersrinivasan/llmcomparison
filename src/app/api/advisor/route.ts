import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { items } from "@/data/catalog";
import { buildAdvisorGraph, describeLLM, resolveLLM, type BYOK, type LLMConfig } from "@/lib/agent/graph";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type AdvisorEvent =
  | { type: "step"; node: string; detail: string }
  | { type: "answer"; text: string; itemIds: string[]; mode: "llm" | "offline"; model: string | null }
  | { type: "error"; message: string };

/** Map bolded product names in the answer to catalog ids (longest name wins per bold segment). */
function mentionedItemIds(text: string) {
  const ids = new Set<string>();
  for (const [, segment] of text.matchAll(/\*\*(.+?)\*\*/g)) {
    const lower = segment.toLowerCase();
    const best = items
      .filter((i) => lower.includes(i.name.toLowerCase()))
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (best) ids.add(best.id);
  }
  return [...ids];
}

/** Turn provider failures into actionable messages, and never echo the key back. */
function friendlyError(err: unknown, llm: LLMConfig | null) {
  const status = (err as { status?: number })?.status;
  const raw = err instanceof Error ? err.message : "Advisor failed";
  const name = llm?.provider === "groq" ? "Groq" : "Anthropic";
  let message = raw;
  if (status === 401 || status === 403) message = `${name} rejected the API key. Check it in the 🔑 settings.`;
  else if (status === 429) message = `${name} rate limit reached — wait a moment and try again.`;
  else if (status === 404 || /model.*(not found|does not exist|decommissioned)/i.test(raw))
    message = `Model "${llm?.model}" isn't available on ${name}. Pick another model in the 🔑 settings.`;
  else if (/recursion/i.test(raw)) message = "The agent looped too long without an answer — try a more specific question.";
  return llm?.provider === "groq" ? message.replaceAll(llm.apiKey, "***") : message;
}

function describe(node: string, update: Record<string, unknown>): string {
  switch (node) {
    case "planner": {
      const plan = update.plan as { categories: string[]; audience: string; needsOpenSource: boolean } | undefined;
      return plan
        ? `Understood: ${plan.audience} · ${plan.categories.join(", ")}${plan.needsOpenSource ? " · open-source" : ""}`
        : "Planning";
    }
    case "retrieve": {
      const list = (update.shortlist as { name: string }[] | undefined) ?? [];
      return `Shortlisted ${list.length}: ${list.map((i) => i.name).join(", ")}`;
    }
    case "researcher": {
      const msg = (update.messages as AIMessage[] | undefined)?.at(-1);
      const calls = msg?.tool_calls ?? [];
      return calls.length ? `Calling ${calls.map((c) => c.name).join(", ")}` : "Writing recommendation";
    }
    case "tools":
      return "Read catalog results";
    case "compose_offline":
      return "Composed offline recommendation";
    default:
      return node;
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { messages?: ChatTurn[]; byok?: BYOK } | null;
  const turns = (body?.messages ?? []).filter((t) => t.content?.trim()).slice(-12);
  if (!turns.length || turns.at(-1)!.role !== "user") {
    return Response.json({ error: "Send at least one user message." }, { status: 400 });
  }

  const messages: BaseMessage[] = turns.map((t) =>
    t.role === "user" ? new HumanMessage(t.content) : new AIMessage(t.content),
  );

  const llm = resolveLLM(body?.byok);
  const graph = buildAdvisorGraph(llm);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AdvisorEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let finalText = "";
      let shortlistIds: string[] = [];
      let mode: "llm" | "offline" = llm ? "llm" : "offline";
      try {
        const updates = await graph.stream({ messages }, { streamMode: "updates", recursionLimit: 14 });
        for await (const chunk of updates) {
          for (const [node, update] of Object.entries(chunk as Record<string, Record<string, unknown>>)) {
            if (!update) continue;
            send({ type: "step", node, detail: describe(node, update) });
            if (update.mode) mode = update.mode as "llm" | "offline";
            if (update.shortlist) shortlistIds = (update.shortlist as { id: string }[]).map((i) => i.id);
            const last = (update.messages as AIMessage[] | undefined)?.at(-1);
            if (last && (node === "researcher" || node === "compose_offline") && !last.tool_calls?.length) {
              finalText = last.text;
            }
          }
        }
        const mentioned = mentionedItemIds(finalText);
        const itemIds = (mentioned.length ? mentioned : shortlistIds).slice(0, 8);
        send({ type: "answer", text: finalText || "I couldn't produce an answer — try rephrasing.", itemIds, mode, model: describeLLM(llm) });
      } catch (err) {
        const message = friendlyError(err, llm);
        console.error("[advisor]", message);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
