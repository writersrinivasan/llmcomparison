export type CategoryId =
  | "llms"
  | "open-models"
  | "ides"
  | "platforms"
  | "agent-frameworks"
  | "vector-dbs"
  | "assistants"
  | "creative";

export interface Column {
  key: string;
  label: string;
}

export interface Category {
  id: CategoryId;
  name: string;
  emoji: string;
  blurb: string;
  /** Tailwind gradient classes, e.g. "from-fuchsia-500 to-orange-400" */
  gradient: string;
  /** Accent text color class */
  accent: string;
  columns: Column[];
}

export interface Item {
  id: string;
  name: string;
  vendor: string;
  category: CategoryId;
  tagline: string;
  pricing: string;
  /** 1 = free/cheap … 4 = premium */
  priceTier: 1 | 2 | 3 | 4;
  openSource: boolean;
  /** Editorial fit ratings, 1–5 */
  personal: number;
  enterprise: number;
  strengths: string[];
  watchOuts: string[];
  bestFor: string[];
  url: string;
  specs: Record<string, string>;
}
