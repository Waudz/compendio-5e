import { BookOpen } from "lucide-react";
import { AccountPanel } from "./AccountPanel";
import type { NavMode } from "./navigation";
import { CampaignPanel, CampaignsPanel } from "./CampaignPanels";
import { type Kind, type TabSpec, defaultTitle } from "./workspace";

const demo: Partial<Record<string, TabSpec[]>> = {
  personagens: [{ kind: "ficha", ref: "lydia", title: "Ficha: Lydia" }, { kind: "ficha", ref: "sabine", title: "Ficha: Sabine" }],
  enciclopedia: [{ kind: "npc", ref: "sabine", title: "NPC: Sabine" }, { kind: "npc", ref: "toran", title: "NPC: Toran" }],
  documentos: [{ kind: "documento", ref: "diario", title: "Diário da campanha" }],
};

/** Conteúdo provisório de uma aba. Os dados reais entram nas próximas etapas. */
export function Panel({ kind, entity: id, onOpen }: { kind: Kind; entity: string; onOpen: (s: TabSpec, mode?: NavMode) => void }) {
  if (kind === "conta") return <div className="content"><AccountPanel/></div>;
  if (kind === "campanha") return <div className="content"><CampaignPanel id={id} onOpen={onOpen}/></div>;
  if (kind === "secao" && id === "campanhas") return <div className="content"><CampaignsPanel onOpen={onOpen}/></div>;
  const title = defaultTitle({ kind, ref: id });
  const items = kind === "secao" ? demo[id] : undefined;
  return <div className="content">
    <div className="eyebrow">COMPÊNDIO 5e / DEMONSTRAÇÃO</div>
    <h1>{title}</h1>
    <p>Estrutura inicial. Os dados reais serão integrados nas próximas etapas.</p>
    {items && <div className="demo-actions">{items.map(s => <button key={`${s.kind}:${s.ref}`} onClick={() => onOpen(s)}>Abrir {s.title}</button>)}</div>}
    <div className="placeholder"><BookOpen size={30}/><strong>{title}</strong><span>Área reservada para a funcionalidade.</span></div>
  </div>;
}
