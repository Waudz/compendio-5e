import { RegistroCompendioPagina, IdentidadePagina, RegraPagina } from "./compendio/Paginas";
import { MonstroPagina } from "./Compendio";
import { BookOpen } from "lucide-react";
import { AccountPanel } from "./AccountPanel";
import type { NavMode } from "./navigation";
import { CampaignsPanel } from "./CampaignPanels";
import { CampaignHome } from "./CampaignHome";
import { PlanningPanel } from "./Planning";
import { DiarioPanel, RegistroPagina } from "./Diario";
import { PersonagensPanel } from "./Personagens";
import { FichaRoteada } from "./FichaRoteada";
import { CompendioPanel, ItemPagina } from "./Compendio";
import { MagiaPagina } from "./compendio/MagiaPagina";
import { CriadorGuiado } from "./criador/CriadorGuiado";
import { EncontrosPanel, IniciativaPanel } from "./Iniciativa";
import { type Kind, type TabSpec, defaultTitle } from "./workspace";

/** Conteúdo provisório de uma aba. Os dados reais entram nas próximas etapas. */
export function Panel({ kind, entity: id, onOpen, onOpenContent }: {
  kind: Kind; entity: string;
  onOpen: (s: TabSpec, mode?: NavMode) => void;   // abertura administrativa/de menu (modo explícito; padrão: reutilizar a aba)
  onOpenContent: (s: TabSpec) => void;            // link interno de conteúdo: sempre aba permanente, sem substituir a origem
}) {
  if (kind === "registro") return <RegistroCompendioPagina id={id} onOpenContent={onOpenContent}/>;
  if (kind === "identidade") return <IdentidadePagina id={id} onOpenContent={onOpenContent}/>;
  if (kind === "monstro") return <MonstroPagina id={id} onOpenContent={onOpenContent}/>;
  if (kind === "regra") return <RegraPagina refId={id} onOpenContent={onOpenContent}/>;
  if (kind === "conta") return <div className="content"><AccountPanel/></div>;
  if (kind === "campanha") return <div className="content"><CampaignHome id={id} onOpen={onOpen} onOpenContent={onOpenContent}/></div>;
  if (kind === "secao" && id === "campanhas") return <div className="content"><CampaignsPanel onOpen={onOpen}/></div>;
  if (kind === "secao" && (id === "planejamento" || id.startsWith("planejamento:"))) return <PlanningPanel initialBoardId={id.startsWith("planejamento:") ? id.slice("planejamento:".length) : undefined} onOpenContent={onOpenContent}/>;
  if (kind === "secao" && id === "diario") return <DiarioPanel onOpenContent={onOpenContent}/>;
  if (kind === "documento") return <RegistroPagina id={id}/>;
  if (kind === "ficha") return <FichaRoteada id={id} onOpenContent={onOpenContent}/>;
  if (kind === "item") return <ItemPagina id={id} onOpenContent={onOpenContent}/>;
  if (kind === "magia") return <MagiaPagina id={id}/>;
  if (kind === "criador") return <CriadorGuiado id={id} onOpenContent={onOpenContent}/>;
  if (kind === "secao" && id === "compendio") return <CompendioPanel onOpenContent={onOpenContent}/>;
  if (kind === "secao" && id === "personagens") return <PersonagensPanel onOpenContent={onOpenContent}/>;
  if (kind === "secao" && id === "iniciativa") return <IniciativaPanel/>;
  if (kind === "secao" && id === "encontros") return <EncontrosPanel/>;
  const title = defaultTitle({ kind, ref: id });
  return <div className="content">
    <div className="eyebrow">COMPÊNDIO 5e</div>
    <h1>{title}</h1>
    <p>Este módulo ainda não foi desenvolvido e <strong>não faz parte da Alpha</strong>.</p>
    <div className="placeholder"><BookOpen size={30}/><strong>{title}</strong><span>Em desenvolvimento: nenhuma funcionalidade disponível aqui ainda.{id === "enciclopedia" ? " Para registros da campanha use o Diário; para suas próprias notas, Anotações." : id === "documentos" ? " Suas notas e planejamentos ficam em Anotações; os registros da campanha, no Diário." : ""}</span></div>
  </div>;
}
