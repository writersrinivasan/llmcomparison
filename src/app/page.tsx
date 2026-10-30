import Link from "next/link";
import { categories, items, itemsFor } from "@/data/catalog";

const QUICK_ASKS = [
  "Best AI coding IDE for a solo developer on a budget",
  "Enterprise LLM platform with strong governance on AWS",
  "Open-source model I can self-host for private RAG",
  "Which agent framework should a TypeScript team pick?",
];

const GRAPH_STEPS = [
  { name: "Planner", desc: "Understands audience, budget & constraints", color: "from-pink-500 to-fuchsia-500" },
  { name: "Retriever", desc: "Ranks the catalog for your needs", color: "from-orange-400 to-amber-400" },
  { name: "Researcher", desc: "Claude reasons over the shortlist", color: "from-violet-500 to-indigo-500" },
  { name: "Tools", desc: "search · compare · list — loops until confident", color: "from-sky-400 to-cyan-400" },
];

export default function Home() {
  const vendors = new Set(items.map((i) => i.vendor)).size;
  return (
    <div className="space-y-20 pt-12">
      {/* Hero */}
      <section className="text-center max-w-4xl mx-auto">
        <p className="inline-block glass rounded-full px-4 py-1 text-xs tracking-wide text-white/80 mb-6">
          🧠 Models · 💻 IDEs · ☁️ Platforms · 🤖 Agents · 🧭 Vector DBs · 🎨 Creative
        </p>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05]">
          Every AI comparison table,
          <br />
          <span className="text-rainbow">in one place.</span>
        </h1>
        <p className="mt-6 text-lg text-white/70 max-w-2xl mx-auto">
          A one-stop shop for picking the right AI stack — for your side project or your entire enterprise. Browse
          colorful side-by-side tables, or let our LangGraph-powered advisor do the research for you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/advisor"
            className="rounded-full px-6 py-3 font-semibold bg-gradient-to-r from-fuchsia-500 via-orange-400 to-yellow-300 text-black shadow-xl shadow-fuchsia-500/30 hover:scale-105 transition"
          >
            ✨ Get a personalized recommendation
          </Link>
          <Link href="/compare/llms" className="rounded-full px-6 py-3 font-semibold glass hover:bg-white/10 transition">
            Browse tables →
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-3 gap-3 max-w-lg mx-auto">
          {[
            { n: items.length, l: "tools compared" },
            { n: categories.length, l: "categories" },
            { n: vendors, l: "vendors" },
          ].map((s) => (
            <div key={s.l} className="glass rounded-2xl py-4">
              <div className="text-3xl font-black text-rainbow">{s.n}</div>
              <div className="text-xs text-white/60">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Pick a comparison table</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {categories.map((c) => {
            const list = itemsFor(c.id);
            return (
              <Link
                key={c.id}
                href={`/compare/${c.id}`}
                className={`group relative rounded-3xl p-[1.5px] bg-gradient-to-br ${c.gradient} hover:scale-[1.03] hover:shadow-2xl transition`}
              >
                <div className="h-full rounded-3xl bg-[#0c0c24]/90 p-5 flex flex-col">
                  <div
                    className={`h-12 w-12 rounded-2xl grid place-items-center text-2xl bg-gradient-to-br ${c.gradient} shadow-lg`}
                  >
                    {c.emoji}
                  </div>
                  <h3 className="mt-4 font-bold text-lg">{c.name}</h3>
                  <p className="text-sm text-white/60 mt-1 flex-1">{c.blurb}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {list.slice(0, 3).map((i) => (
                      <span key={i.id} className="text-[11px] rounded-full bg-white/10 px-2 py-0.5 text-white/80">
                        {i.name}
                      </span>
                    ))}
                    <span className={`text-[11px] px-1 py-0.5 ${c.accent}`}>+{Math.max(0, list.length - 3)} more</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Agent */}
      <section className="glass rounded-3xl p-6 sm:p-10">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-sm font-semibold text-violet-300 uppercase tracking-widest">Agentic AI inside</p>
            <h2 className="text-3xl font-black mt-2">An advisor built on LangGraph</h2>
            <p className="text-white/70 mt-4">
              Describe what you need in plain English. A multi-node LangGraph agent plans, retrieves, and calls catalog
              tools in a loop with Claude until it can give you a grounded, side-by-side recommendation.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {QUICK_ASKS.map((q) => (
                <Link
                  key={q}
                  href={`/advisor?q=${encodeURIComponent(q)}`}
                  className="text-sm rounded-xl px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 transition"
                >
                  💡 {q}
                </Link>
              ))}
            </div>
          </div>
          <ol className="relative space-y-4">
            {GRAPH_STEPS.map((s, i) => (
              <li key={s.name} className="flex items-center gap-4">
                <span
                  className={`h-12 w-12 shrink-0 rounded-2xl grid place-items-center font-black text-black bg-gradient-to-br ${s.color} shadow-lg`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 glass rounded-2xl px-4 py-3">
                  <div className="font-bold">
                    {s.name}
                    {s.name === "Tools" && <span className="ml-2 text-xs text-sky-300">↺ loops back to Researcher</span>}
                  </div>
                  <div className="text-sm text-white/60">{s.desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
