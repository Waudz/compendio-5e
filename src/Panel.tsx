import { BookOpen } from "lucide-react";
import { AccountPanel } from "./AccountPanel";
import type { NavMode } from "./navigation";
import { CampaignsPanel } from "./CampaignPanels";
import { CampaignHome } from "./CampaignHome";
import { PlanningPanel } from "./Planning";
import { DiarioPanel, RegistroPagina } from "./Diario";
import { FichaPagina, PersonagensPanel } from "./Personagens";
import { type Kind, type TabSpec, defaultTitle } from "./workspace";

/** Conteúdo provisório de uma aba. Os dados reais entram nas próximas etapas. */
export function Panel({ kind, entity: id, onOpen, onOpenContent }: {
  kind: Kind; entity: string;
  onOpen: (s: TabSpec, mode?: NavMode) => void;   // abertura administrativa/de menu (modo explícito; padrão: reutilizar a aba)
  onOpenContent: (s: TabSpec) => void;            // link interno de conteúdo: sempre aba permanente, sem substituir a origem
}) {
  if (kind === "conta") return <div className="content"><AccountPanel/></div>;
  if (kind === "campanha") return <div className="content"><CampaignHome id={id} onOpen={onOpen} onOpenContent={onOpenContent}/></div>;
  if (kind === "secao" && id === "campanhas") return <div className="content"><CampaignsPanel onOpen={onOpen}/></div>;
  if (kind === "secao" && id === "planejamento") return <PlanningPanel onOpenContent={onOpenContent}/>;
  if (kind === "secao" && id === "diario") return <DiarioPanel onOpenContent={onOpenContent}/>;
  if (kind === "documento") return <RegistroPagina id={id}/>;
  if (kind === "ficha") return <FichaPagina id={id}/>;
  if (kind === "secao" && id === "personagens") return <PersonagensPanel onOpenContent={onOpenContent}/>;
  const title = defaultTitle({ kind, ref: id });
  return <div className="content">
    <div className="eyebrow">COMPÊNDIO 5e</div>
    <h1>{title}</h1>
    <p>Este módulo ainda não foi desenvolvido.</p>
    <div className="placeholder"><BookOpen size={30}/><strong>{title}</strong><span>Em desenvolvimento: nenhuma funcionalidade disponível aqui ainda.</span></div>
  </div>;
}
