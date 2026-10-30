import Link from "next/link";
import { categories } from "@/data/catalog";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07071a]/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight text-lg shrink-0">
          <span className="grid place-items-center h-8 w-8 rounded-xl bg-gradient-to-br from-pink-500 via-violet-500 to-sky-400 text-sm">
            ⚡
          </span>
          <span className="text-rainbow hidden min-[380px]:inline">AI Compare Hub</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto text-sm">
          {categories.slice(0, 5).map((c) => (
            <Link
              key={c.id}
              href={`/compare/${c.id}`}
              className="px-3 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 whitespace-nowrap"
            >
              {c.emoji} {c.name}
            </Link>
          ))}
          <Link href="/compare/assistants" className="px-3 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10">
            More…
          </Link>
        </nav>
        <Link
          href="/advisor"
          className="ml-auto shrink-0 rounded-full px-4 py-2 text-sm font-semibold bg-gradient-to-r from-fuchsia-500 via-orange-400 to-yellow-300 text-black shadow-lg shadow-fuchsia-500/30 hover:scale-105 transition"
        >
          ✨ <span className="hidden sm:inline">Ask the AI </span>Advisor
        </Link>
      </div>
    </header>
  );
}
