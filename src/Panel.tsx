import { useContext, useState, useRef, useLayoutEffect, useEffect } from "react";
import { VoltarPaginaContext } from "./voltarPagina";
import { useCampaigns } from "./CampaignsContext";
import { useUnsaved } from "./unsaved";
import { OrigemAbaContext } from "./abrirEmAba";
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
function ConteudoPanel({ kind, entity: id, onOpen, onOpenContent }: {
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
  if (kind === "magia") return <MagiaPagina id={id} onOpenContent={onOpenContent}/>;
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

type PanelProps = Parameters<typeof ConteudoPanel>[0];
export function Panel(props: PanelProps) {
  const {active}=useCampaigns();
  const mobileBack=useContext(VoltarPaginaContext);
  if (mobileBack) return <ConteudoPanel {...props}/>;
  return <CompendioLocal key={`${active?.campaign.id}:${props.kind}:${props.entity}`} {...props}/>;
}
function CompendioLocal(props:PanelProps) {
  const [pages,setPages]=useState<TabSpec[]>([{kind:props.kind,ref:props.entity}]);
  const root=useRef<HTMLDivElement>(null);
  const positions=useRef<number[]>([]);
  const origin=useContext(OrigemAbaContext);
  const unsaved=useUnsaved();
  const page=pages[pages.length-1];
  const scroller=()=>{let el=root.current?.parentElement;while(el){if(/auto|scroll/.test(getComputedStyle(el).overflowY))return el;el=el.parentElement;}return null;};
  useLayoutEffect(()=>{const el=scroller();if(el)el.scrollTop=positions.current[pages.length-1]??0;},[pages]);
  const guard=(fn:()=>void)=>unsaved.guard([origin??"secao:compendio"],fn);
  const back=()=>guard(()=>{if(pages.length>1){positions.current.length=pages.length-1;setPages(p=>p.slice(0,-1));}else if(page.kind!=="secao"){props.onOpenContent({kind:"secao",ref:"compendio"});}});
  const open=(s:TabSpec)=>{
    if(s.kind===page.kind&&s.ref===page.ref)return;
    guard(()=>{positions.current[pages.length-1]=scroller()?.scrollTop??0;setPages(p=>[...p,s]);});
  };
  useEffect(()=>{const listener=(e:Event)=>{const d=(e as CustomEvent<{origem?:string;s:TabSpec}>).detail;if(d?.origem===origin)open(d.s);};window.addEventListener("compendio:abrir-local",listener);return()=>window.removeEventListener("compendio:abrir-local",listener);},[origin,pages,props.onOpenContent]);
  return <div ref={root}><VoltarPaginaContext.Provider value={back}>{pages.map((p,i)=><div key={i+":"+p.kind+":"+p.ref} hidden={i!==pages.length-1}><ConteudoPanel {...props} kind={p.kind} entity={p.ref} onOpenContent={open}/></div>)}</VoltarPaginaContext.Provider></div>;
}
