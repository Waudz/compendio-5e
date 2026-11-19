import { BookOpen, FileText, ScrollText, Shield, Swords, Users } from "lucide-react";

export type Page = "personagens" | "iniciativa" | "encontros" | "enciclopedia" | "compendio" | "documentos";
export type Tab = { id: string; page: Page; title: string };
export type Column = { id: string; tabs: Tab[]; active: string; width: number };
export type Workspace = { columns: Column[]; focused: string };
export const sections: { page: Page; title: string; icon: typeof Users }[] = [
  { page: "personagens", title: "Personagens", icon: Users },
  { page: "iniciativa", title: "Iniciativa", icon: Swords },
  { page: "encontros", title: "Encontros", icon: Shield },
  { page: "enciclopedia", title: "Enciclopédia", icon: BookOpen },
  { page: "compendio", title: "Compêndio", icon: ScrollText },
  { page: "documentos", title: "Documentos", icon: FileText },
];
export const key = "compendio5e:workspace:columns:v1";
export const first: Workspace = { columns: [{ id: "col-1", tabs: [{ id: "personagens", page: "personagens", title: "Personagens" }], active: "personagens", width: 100 }], focused: "col-1" };
const makeId = () => crypto.randomUUID();
export function restore(): Workspace {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (!data || typeof data !== "object" || !("columns" in data) || !Array.isArray(data.columns) || data.columns.length < 1 || data.columns.length > 3) return first;
    const columns: Column[] = [];
    for (const col of data.columns) {
      if (!col || typeof col.id !== "string" || !Array.isArray(col.tabs) || !Number.isFinite(col.width) || col.width <= 0) return first;
      const tabs: Tab[] = [];
      for (const t of col.tabs) {
        const section = sections.find(s => s.page === t?.page);
        if (!section || typeof t.id !== "string" || t.id !== t.page || tabs.some(x => x.id === t.id)) return first;
        tabs.push({ id: t.id, page: t.page, title: section.title });
      }
      
      columns.push({ id: col.id, tabs, active: tabs.some(t => t.id === col.active) ? col.active : (tabs[0]?.id || ""), width: col.width });
    }
    if (new Set(columns.flatMap(c => c.tabs.map(t => t.id))).size !== columns.reduce((n,c) => n+c.tabs.length,0)) return first;
    const sum = columns.reduce((n,c) => n+c.width,0);
    return { columns: columns.map(c => ({ ...c, width: c.width * 100 / sum })), focused: columns.some(c => c.id === (data as Workspace).focused) ? (data as Workspace).focused : columns[0].id };
  } catch { return first; }
}
