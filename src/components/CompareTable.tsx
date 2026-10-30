"use client";

import { useMemo, useState } from "react";
import type { Category, Item } from "@/data/types";

type Audience = "both" | "personal" | "enterprise";
type SortKey = "fit" | "name" | "price" | "personal" | "enterprise";

const MAX_SELECTED = 4;

function Rating({ value, gradient }: { value: number; gradient: string }) {
  return (
    <div className="flex items-center gap-2" title={`${value} / 5`}>
      <div className="h-2 w-16 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${gradient}`} style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <span className="text-xs tabular-nums text-white/70">{value}</span>
    </div>
  );
}

function PriceTier({ tier }: { tier: number }) {
  return (
    <span className="font-mono text-sm" aria-label={`Price tier ${tier} of 4`}>
      <span className="text-emerald-300">{"$".repeat(tier)}</span>
      <span className="text-white/20">{"$".repeat(4 - tier)}</span>
    </span>
  );
}

export function CompareTable({ category, items }: { category: Category; items: Item[] }) {
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState<Audience>("both");
  const [maxTier, setMaxTier] = useState(4);
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "fit", dir: -1 });
  const [selected, setSelected] = useState<string[]>([]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fit = (i: Item) =>
      audience === "personal" ? i.personal : audience === "enterprise" ? i.enterprise : (i.personal + i.enterprise) / 2;
    const value = (i: Item): number | string => {
      switch (sort.key) {
        case "name":
          return i.name.toLowerCase();
        case "price":
          return i.priceTier;
        case "personal":
          return i.personal;
        case "enterprise":
          return i.enterprise;
        default:
          return fit(i);
      }
    };
    return items
      .filter((i) => i.priceTier <= maxTier && (!openOnly || i.openSource))
      .filter((i) => !q || JSON.stringify(i).toLowerCase().includes(q))
      .sort((a, b) => {
        const va = value(a);
        const vb = value(b);
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
      });
  }, [items, query, audience, maxTier, openOnly, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" || key === "price" ? 1 : -1 }));

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_SELECTED ? [...s, id] : s));

  const picked = items.filter((i) => selected.includes(i.id));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : "");

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="glass rounded-2xl p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${category.name.toLowerCase()}…`}
          className="flex-1 min-w-0 rounded-xl bg-black/30 border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-white/40"
        />
        <div className="flex rounded-xl bg-black/30 border border-white/10 p-1 text-sm">
          {(["both", "personal", "enterprise"] as Audience[]).map((a) => (
            <button
              key={a}
              onClick={() => {
                setAudience(a);
                setSort({ key: "fit", dir: -1 });
              }}
              className={`flex-1 px-3 py-1.5 rounded-lg capitalize transition ${
                audience === a ? `bg-gradient-to-r ${category.gradient} text-black font-semibold` : "text-white/70 hover:text-white"
              }`}
            >
              {a === "both" ? "All uses" : a === "personal" ? "🏠 Personal" : "🏢 Enterprise"}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <select
            value={maxTier}
            onChange={(e) => setMaxTier(Number(e.target.value))}
            className="flex-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm"
            aria-label="Maximum price tier"
          >
            <option value={4}>Any budget</option>
            <option value={3}>Up to $$$</option>
            <option value={2}>Up to $$</option>
            <option value={1}>$ only</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="accent-fuchsia-500" />
            Open source
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="text-left text-white/60 border-b border-white/10">
              <th className="p-3 w-10">
                <span className="sr-only">Select</span>
              </th>
              <th className="p-3 cursor-pointer select-none" onClick={() => toggleSort("name")}>
                Name{arrow("name")}
              </th>
              <th className="p-3 cursor-pointer select-none" onClick={() => toggleSort("price")}>
                Pricing{arrow("price")}
              </th>
              {category.columns.map((c) => (
                <th key={c.key} className="p-3">
                  {c.label}
                </th>
              ))}
              <th className="p-3 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort("personal")}>
                🏠 Personal{arrow("personal")}
              </th>
              <th className="p-3 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort("enterprise")}>
                🏢 Enterprise{arrow("enterprise")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i, idx) => {
              const isSel = selected.includes(i.id);
              return (
                <tr
                  key={i.id}
                  className={`border-b border-white/5 align-top transition ${isSel ? "bg-white/10" : "hover:bg-white/5"}`}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={isSel}
                      disabled={!isSel && selected.length >= MAX_SELECTED}
                      onChange={() => toggleSelect(i.id)}
                      className="accent-fuchsia-500 h-4 w-4"
                      aria-label={`Select ${i.name} to compare`}
                    />
                  </td>
                  <td className="p-3 min-w-[220px]">
                    <div className="flex items-center gap-2">
                      {idx === 0 && sort.key === "fit" && (
                        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 bg-gradient-to-r ${category.gradient} text-black`}>
                          TOP
                        </span>
                      )}
                      <a href={i.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline">
                        {i.name}
                      </a>
                      {i.openSource && <span className="text-[10px] rounded-full bg-emerald-400/20 text-emerald-300 px-2 py-0.5">OSS</span>}
                    </div>
                    <div className="text-xs text-white/50">{i.vendor}</div>
                    <div className="text-xs text-white/70 mt-1 max-w-xs">{i.tagline}</div>
                  </td>
                  <td className="p-3 min-w-[150px]">
                    <PriceTier tier={i.priceTier} />
                    <div className="text-xs text-white/60 mt-1">{i.pricing}</div>
                  </td>
                  {category.columns.map((c) => (
                    <td key={c.key} className="p-3 text-white/80 min-w-[120px]">
                      {i.specs[c.key] ?? "—"}
                    </td>
                  ))}
                  <td className="p-3">
                    <Rating value={i.personal} gradient="from-pink-400 to-orange-300" />
                  </td>
                  <td className="p-3">
                    <Rating value={i.enterprise} gradient="from-sky-400 to-violet-400" />
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={category.columns.length + 5} className="p-10 text-center text-white/50">
                  Nothing matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-white/40">Tick up to {MAX_SELECTED} rows to compare them side by side. Fit ratings are editorial (1–5).</p>

      {/* Side-by-side */}
      {picked.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Side by side</h2>
            <button onClick={() => setSelected([])} className="text-sm text-white/60 hover:text-white">
              Clear
            </button>
          </div>
          <div className={`grid gap-4 sm:grid-cols-2 ${picked.length > 2 ? "xl:grid-cols-4" : ""}`}>
            {picked.map((i) => (
              <article key={i.id} className={`rounded-3xl p-[1.5px] bg-gradient-to-br ${category.gradient}`}>
                <div className="h-full rounded-3xl bg-[#0c0c24]/95 p-5 space-y-4">
                  <div>
                    <h3 className="font-black text-lg">{i.name}</h3>
                    <p className="text-xs text-white/50">{i.vendor}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white/5 p-2">
                      <div className="text-white/50">Personal</div>
                      <Rating value={i.personal} gradient="from-pink-400 to-orange-300" />
                    </div>
                    <div className="rounded-xl bg-white/5 p-2">
                      <div className="text-white/50">Enterprise</div>
                      <Rating value={i.enterprise} gradient="from-sky-400 to-violet-400" />
                    </div>
                  </div>
                  <List title="💪 Strengths" items={i.strengths} color="text-emerald-300" />
                  <List title="⚠️ Watch-outs" items={i.watchOuts} color="text-amber-300" />
                  <List title="🎯 Best for" items={i.bestFor} color="text-sky-300" />
                  <a href={i.url} target="_blank" rel="noreferrer" className={`inline-block text-sm ${category.accent} hover:underline`}>
                    Visit site ↗
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function List({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <div className={`text-xs font-semibold ${color} mb-1`}>{title}</div>
      <ul className="text-sm text-white/80 space-y-1">
        {items.map((s) => (
          <li key={s}>• {s}</li>
        ))}
      </ul>
    </div>
  );
}
