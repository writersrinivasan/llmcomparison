"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getCategory, getItem } from "@/data/catalog";
import type { AdvisorEvent } from "@/app/api/advisor/route";
import { KeySettings, loadGroqSettings, type GroqSettings } from "./KeySettings";

interface Turn {
  role: "user" | "assistant";
  content: string;
  steps?: { node: string; detail: string }[];
  itemIds?: string[];
  error?: boolean;
}

const NODE_STYLE: Record<string, string> = {
  planner: "from-pink-500 to-fuchsia-500",
  retrieve: "from-orange-400 to-amber-300",
  researcher: "from-violet-500 to-indigo-400",
  tools: "from-sky-400 to-cyan-300",
  compose_offline: "from-emerald-400 to-teal-300",
};

const SUGGESTIONS = [
  "I'm a student — cheapest way to get a great AI coding setup?",
  "We're a 500-person bank on Azure. Which LLM platform and assistant?",
  "Compare Pinecone vs pgvector vs Qdrant for a startup RAG app",
  "Best open-weight model to run locally on a laptop",
  "Which agent framework for a Python team building production agents?",
  "Image generation tool for marketing with commercial rights",
];

export function Advisor({ initialQuestion, serverModel }: { initialQuestion?: string; serverModel: string | null }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [groq, setGroq] = useState<GroqSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    // Browser storage is only readable after hydration.
    setGroq(loadGroqSettings());
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    const history = [...turns.filter((t) => !t.error), { role: "user" as const, content: q }];
    setTurns([...history, { role: "assistant", content: "", steps: [] }]);

    const patchLast = (fn: (t: Turn) => Turn) =>
      setTurns((ts) => [...ts.slice(0, -1), fn(ts[ts.length - 1])]);

    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          byok: groq ? { groqKey: groq.key, groqModel: groq.model } : undefined,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AdvisorEvent;
          if (event.type === "step") patchLast((t) => ({ ...t, steps: [...(t.steps ?? []), { node: event.node, detail: event.detail }] }));
          else if (event.type === "answer") patchLast((t) => ({ ...t, content: event.text, itemIds: event.itemIds }));
          else patchLast((t) => ({ ...t, content: `⚠️ ${event.message}`, error: true }));
        }
      }
    } catch (err) {
      patchLast((t) => ({ ...t, content: `⚠️ ${err instanceof Error ? err.message : "Something went wrong"}`, error: true }));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Wait for saved BYOK settings so the first question uses the user's key.
    if (initialQuestion && settingsLoaded && !sentInitial.current) {
      sentInitial.current = true;
      void ask(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, settingsLoaded]);

  const activeModel = groq ? `Groq · ${groq.model} (your key)` : serverModel;

  return (
    <div className="pt-8 max-w-4xl mx-auto flex flex-col min-h-[calc(100vh-10rem)]">
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-black">
          <span className="text-rainbow">AI Advisor</span> ✨
        </h1>
        <p className="text-white/60 mt-2 text-sm">
          A LangGraph agent: planner → retriever → researcher ⇄ catalog tools.{" "}
          {activeModel ? (
            <span className="text-emerald-300">Live · {activeModel}</span>
          ) : (
            <span className="text-amber-300">Offline mode — add your Groq key for AI-powered analysis</span>
          )}
        </p>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            groq ? "glass text-emerald-300 hover:bg-white/10" : "bg-gradient-to-r from-orange-400 to-pink-500 text-black hover:scale-105"
          }`}
        >
          🔑 {groq ? "Groq key connected" : "Use my Groq API key"}
        </button>
      </div>

      {showSettings && <KeySettings settings={groq} onChange={setGroq} onClose={() => setShowSettings(false)} />}

      <div className="flex-1 space-y-6">
        {turns.length === 0 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="text-left text-sm glass rounded-2xl p-4 hover:bg-white/10 hover:scale-[1.02] transition"
              >
                💡 {s}
              </button>
            ))}
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-3xl rounded-br-md px-5 py-3 bg-gradient-to-r from-fuchsia-500 to-orange-400 text-black font-medium">
                {t.content}
              </div>
            </div>
          ) : (
            <div key={i} className="space-y-3">
              {!!t.steps?.length && (
                <ol className="flex flex-wrap gap-2">
                  {t.steps.map((s, j) => (
                    <li
                      key={j}
                      className={`text-xs rounded-full pl-1 pr-3 py-1 bg-white/5 border border-white/10 flex items-center gap-2 max-w-full`}
                    >
                      <span className={`rounded-full px-2 py-0.5 font-bold text-black bg-gradient-to-r ${NODE_STYLE[s.node] ?? "from-white to-white"}`}>
                        {s.node}
                      </span>
                      <span className="text-white/70 truncate">{s.detail}</span>
                    </li>
                  ))}
                  {busy && i === turns.length - 1 && !t.content && (
                    <li className="text-xs rounded-full px-3 py-1 bg-white/5 border border-white/10 animate-pulse">thinking…</li>
                  )}
                </ol>
              )}
              {t.content ? (
                <div className={`glass rounded-3xl rounded-tl-md p-5 prose-advisor text-[15px] leading-relaxed ${t.error ? "border-red-400/50" : ""}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.content}</ReactMarkdown>
                </div>
              ) : (
                !t.steps?.length && <div className="glass rounded-3xl p-5 animate-pulse text-white/50">Starting the graph…</div>
              )}
              {!!t.itemIds?.length && (
                <div className="flex flex-wrap gap-2">
                  {t.itemIds.map((id) => {
                    const item = getItem(id);
                    const cat = item && getCategory(item.category);
                    if (!item || !cat) return null;
                    return (
                      <Link
                        key={id}
                        href={`/compare/${cat.id}`}
                        className={`text-xs rounded-full p-[1px] bg-gradient-to-r ${cat.gradient} hover:scale-105 transition`}
                      >
                        <span className="block rounded-full bg-[#0c0c24] px-3 py-1">
                          {cat.emoji} {item.name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="sticky bottom-4 mt-8 glass rounded-full p-2 flex gap-2 shadow-2xl shadow-violet-500/20"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your use case, budget, team size, constraints…"
          className="flex-1 min-w-0 bg-transparent px-4 outline-none text-sm"
          disabled={busy}
        />
        <button
          disabled={busy || !input.trim()}
          className="rounded-full px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400 disabled:opacity-40 transition"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
