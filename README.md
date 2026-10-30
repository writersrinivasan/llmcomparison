# AI Compare Hub

One-stop, colorful comparison tables for the whole AI stack: frontier LLMs, open-weight models, AI IDEs and coding agents, cloud platforms, agent frameworks, vector databases, chat assistants, and image/video tools. Every table can be filtered for personal or enterprise use. An AI Advisor built on **LangGraph** gives tailored recommendations.

## Run it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for the Claude-powered advisor
npm run dev                  # http://localhost:3000
```

Without an API key the advisor still works in **offline mode** (rule-based planning and ranking).

### Bring your own key (Groq)

On `/advisor`, click **🔑 Use my Groq API key**, paste a key from https://console.groq.com/keys, then click **Verify & save** and pick a model that supports tool calling.

- The key is saved in your browser: in localStorage if you choose "Remember on this device", otherwise in sessionStorage for that tab only.
- It is sent in the request body only with your advisor requests. The server uses it for that one request and does not store or log it.
- The graph is built for each request with the key held inside it, instead of passing the key through LangGraph's `configurable`, so it never reaches traces.

Which provider answers: your own Groq key first, then the server's `ANTHROPIC_API_KEY`, then the server's `GROQ_API_KEY`, and otherwise offline mode.

## How the advisor works

`src/lib/agent/graph.ts` builds a LangGraph `StateGraph`:

```
START → planner → retrieve ─┬─ (live)    → researcher ⇄ tools → END
                            └─ (offline) → compose_offline   → END
```

| Node | What it does |
| --- | --- |
| `planner` | Claude (structured JSON output) works out the categories, audience, budget and open-source needs. Falls back to rules if there's no key or the call fails. |
| `retrieve` | Ranks the catalog for that plan, with no LLM involved. |
| `researcher` | Claude, with adaptive thinking and tools bound, writes the recommendation. |
| `tools` | `ToolNode` running `search_catalog`, `compare_items` and `list_items`, looping back to the researcher. |

`POST /api/advisor` streams each graph step as NDJSON, so the UI can show the agent's progress live.

Model: `claude-opus-5-5` by default (override with `ANTHROPIC_MODEL`). It runs with adaptive thinking and server-side refusal fallback (`fallbacks: "default"`), which is only enabled for the models that support it.

## Editing the data

Everything lives in `src/data/catalog.ts`. To add a category, add an entry to `categories` with its own `columns`. To add a tool, add an `Item` whose `specs` keys match those columns. The ratings are editorial, so update `SNAPSHOT_DATE` whenever you refresh the data.
