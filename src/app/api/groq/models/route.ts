import { DEFAULT_GROQ_MODEL } from "@/lib/agent/graph";

// Audio, safety and embedding models can't drive the tool-calling advisor.
const NON_CHAT = /whisper|tts|playai|guard|embed|distil|orpheus|prompt-guard|safeguard/i;

/** Validates a user's Groq key and lists the chat models it can use. The key arrives in the body, never the URL. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { apiKey?: string } | null;
  const apiKey = body?.apiKey?.trim();
  if (!apiKey) return Response.json({ error: "Missing API key." }, { status: 400 });

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "Couldn't reach Groq. Check your connection." }, { status: 502 });
  }
  if (res.status === 401 || res.status === 403) return Response.json({ error: "Groq rejected this API key." }, { status: 401 });
  if (!res.ok) return Response.json({ error: `Groq returned ${res.status}.` }, { status: 502 });

  const data = (await res.json()) as { data?: { id: string; active?: boolean }[] };
  const models = (data.data ?? [])
    .filter((m) => m.active !== false && !NON_CHAT.test(m.id))
    .map((m) => m.id)
    .sort();
  const preferred = [DEFAULT_GROQ_MODEL, "openai/gpt-oss-120b", "llama-3.3-70b-versatile", "moonshotai/kimi-k2-instruct"];
  const fallback = preferred.find((m) => models.includes(m)) ?? models[0] ?? DEFAULT_GROQ_MODEL;
  return Response.json({ models, default: fallback });
}
