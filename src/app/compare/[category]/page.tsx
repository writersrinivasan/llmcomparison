import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareTable } from "@/components/CompareTable";
import { categories, getCategory, itemsFor } from "@/data/catalog";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const cat = getCategory((await params).category);
  return { title: cat ? `${cat.name} comparison — AI Compare Hub` : "AI Compare Hub" };
}

export default async function ComparePage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) notFound();

  return (
    <div className="pt-8 space-y-8">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/compare/${c.id}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              c.id === cat.id ? `bg-gradient-to-r ${c.gradient} text-black shadow-lg` : "glass text-white/70 hover:text-white"
            }`}
          >
            {c.emoji} {c.name}
          </Link>
        ))}
      </div>

      <header className={`rounded-3xl p-[1.5px] bg-gradient-to-r ${cat.gradient}`}>
        <div className="rounded-3xl bg-[#0c0c24]/85 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className={`h-16 w-16 rounded-2xl grid place-items-center text-4xl bg-gradient-to-br ${cat.gradient}`}>
            {cat.emoji}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-black">{cat.name}</h1>
            <p className="text-white/70 mt-1">{cat.blurb}</p>
          </div>
          <Link
            href={`/advisor?q=${encodeURIComponent(`Help me choose among ${cat.name.toLowerCase()}`)}`}
            className="self-start sm:self-center rounded-full px-5 py-2.5 text-sm font-semibold bg-white text-black hover:scale-105 transition"
          >
            ✨ Ask advisor
          </Link>
        </div>
      </header>

      <CompareTable category={cat} items={itemsFor(cat.id)} />
    </div>
  );
}
