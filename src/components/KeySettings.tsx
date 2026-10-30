"use client";

import { useState } from "react";

export interface GroqSettings {
  key: string;
  model: string;
  models: string[];
  remember: boolean;
}

const STORAGE_KEY = "aich.groq";

/** Reads saved settings: localStorage if "remember" was chosen, else this tab's sessionStorage. */
export function loadGroqSettings(): GroqSettings | null {
  for (const store of ["localStorage", "sessionStorage"] as const) {
    try {
      const raw = window[store].getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as GroqSettings;
    } catch {
      // Storage blocked (private mode etc.) — treat as no saved key.
    }
  }
  return null;
}

function saveGroqSettings(s: GroqSettings | null) {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    if (s) (s.remember ? window.localStorage : window.sessionStorage).setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Still works for this page view via React state.
  }
}

export function KeySettings({
  settings,
  onChange,
  onClose,
}: {
  settings: GroqSettings | null;
  onChange: (s: GroqSettings | null) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [remember, setRemember] = useState(settings?.remember ?? true);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "error"; msg?: string }>({ kind: "idle" });

  const update = (s: GroqSettings | null) => {
    saveGroqSettings(s);
    onChange(s);
  };

  async function verify() {
    const key = draft.trim();
    if (!key) return;
    setStatus({ kind: "busy" });
    try {
      const res = await fetch("/api/groq/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = (await res.json()) as { models?: string[]; default?: string; error?: string };
      if (!res.ok || !data.models) throw new Error(data.error ?? "Verification failed");
      update({ key, models: data.models, model: data.default ?? data.models[0], remember });
      setDraft("");
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({ kind: "error", msg: err instanceof Error ? err.message : "Verification failed" });
    }
  }

  const masked = settings ? `${settings.key.slice(0, 4)}••••••••${settings.key.slice(-4)}` : "";

  return (
    <div className="rounded-3xl p-[1.5px] bg-gradient-to-r from-orange-400 via-pink-500 to-violet-500 mb-6">
      <div className="rounded-3xl bg-[#0c0c24]/95 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-lg">🔑 Bring your own key · Groq</h2>
            <p className="text-xs text-white/60 mt-1">
              Your key stays in this browser and is sent only with your advisor requests, which the server uses to call
              Groq. It is never logged or stored on the server.{" "}
              <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-sky-300 underline">
                Get a Groq key ↗
              </a>
            </p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none" aria-label="Close settings">
            ×
          </button>
        </div>

        {settings ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-400/15 text-emerald-300 px-3 py-1">✓ Connected</span>
              <code className="text-white/70">{masked}</code>
              <span className="text-white/40 text-xs">{settings.remember ? "Remembered on this device" : "This tab only"}</span>
              <button onClick={() => update(null)} className="ml-auto text-sm text-rose-300 hover:text-rose-200">
                Remove key
              </button>
            </div>
            <label className="block text-sm">
              <span className="text-white/60 text-xs">Model</span>
              <select
                value={settings.model}
                onChange={(e) => update({ ...settings, model: e.target.value })}
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm"
              >
                {settings.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-white/40">Pick a model that supports tool calling — the advisor&apos;s agent loop needs it.</span>
            </label>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
            className="space-y-3"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="gsk_…"
                autoComplete="off"
                spellCheck={false}
                className="flex-1 min-w-0 rounded-xl bg-black/30 border border-white/10 px-4 py-2.5 text-sm font-mono outline-none focus:border-white/40"
              />
              <button
                disabled={!draft.trim() || status.kind === "busy"}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-orange-400 to-pink-500 text-black disabled:opacity-40"
              >
                {status.kind === "busy" ? "Verifying…" : "Verify & save"}
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-pink-500" />
              Remember on this device (otherwise cleared when you close the tab)
            </label>
            {status.kind === "error" && <p className="text-sm text-rose-300">⚠️ {status.msg}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
