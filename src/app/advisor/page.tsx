import { Suspense } from "react";
import { Advisor } from "@/components/Advisor";
import { describeLLM, resolveLLM } from "@/lib/agent/graph";

export const metadata = { title: "AI Advisor — AI Compare Hub" };

type SearchParams = Promise<{ q?: string | string[] }>;

async function AdvisorWithQuery({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  return <Advisor initialQuestion={typeof q === "string" ? q : undefined} serverModel={describeLLM(resolveLLM())} />;
}

export default function AdvisorPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="pt-24 text-center text-white/50 animate-pulse">Loading advisor…</div>}>
      <AdvisorWithQuery searchParams={searchParams} />
    </Suspense>
  );
}
