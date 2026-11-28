import {VoltarPaginaContext} from "./voltarPagina";
import { RetratoQuadrado } from "./RetratoCombate";
import { registrarTitulo } from "./registrosStore";
import { VoltarCompendio, RegistroCompendioPagina } from "./compendio/Paginas";
import { RegistrarDescoberta } from "./compendio/RegistrosCampanha";
import { Carta } from "./compendio/Carta";
import { FichaMonstro, type AbaExtra } from "./compendio/FichaMonstro";
import { imagemDoItem } from "./ficha/imagensCatalogo";
import type { ReactNode } from "react";
import { VisaoRegistro, ImagemRegistro } from "./compendio/VisaoRegistro";
import { AcoesDefinicao } from "./compendio/EditorDefinicao";
import { EntregarItem } from "./compendio/EntregarItem";
import { carregarDefinicao, useDefinicao, useDefinicoes, type Definicao } from "./compendio/definicoes";
import { PesquisaGlobal } from "./compendio/PesquisaGlobal";
import { ListaCampanha } from "./compendio/ListaCampanha";
import { useNotificacoes } from "./compendio/Notificacoes";
import { useAbrirEmAba, OrigemAbaContext } from "./abrirEmAba";
import { useConhecimento, itemConhecido } from "./compendio/conhecimento";
import { jogadorPodeAdicionar } from "./catalogue/disponibilidade";
import { useAuth } from "./AuthContext";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  Shield,
  Map as MapIcon,
  Flag,
  ScrollText,
  BookOpen,
  Sparkles,
  Backpack,
  Wand,
  ChevronRight,
  Swords,
} from "lucide-react";
import "./compendio/compendio-categorias.css";
// Compêndio: ponto de entrada da seção (painel do catálogo) e da página de item (aba `item:<id>`, aberta pelo inventário do criador e pelos pacotes).
// O painel é o catálogo genérico de `src/compendio/` (itens, magias e monstros de D&D 5e 2014); a página de item reutiliza o mesmo detalhe.
import { Aviso } from "./Diario";
import { useCampaigns } from "./CampaignsContext";
import { srdItem } from "./catalogue/srd-2014-items";
import { CompendioCatalogo } from "./compendio/CompendioCatalogo";
import { DetalheItem, itemSpec } from "./compendio/DetalheItem";
import type { TabSpec } from "./workspace";

export { itemSpec };

/** A campanha vem da lista validada de vínculos, nunca de um ID isolado em localStorage.
 * Este bloqueio de produto não substitui RLS dos dados privados da campanha. */
function useCatalogueCampaign(onOpenContent: (s: TabSpec) => void) {
  const { active, loading, error, refresh } = useCampaigns();
  if (active) return null;
  return (
    <div className="content">
      <h1>Compêndio</h1>
      {loading ? (
        <p role="status">Verificando sua campanha…</p>
      ) : error ? (
        <Aviso
          erro
          t="Não foi possível verificar sua campanha. Tente novamente para consultar o Compêndio."
          onRetry={() => void refresh()}
        />
      ) : (
        <>
          <p>Escolha ou entre em uma campanha para consultar o Compêndio.</p>
          <button
            className="btn-primary"
            onClick={() => onOpenContent({ kind: "secao", ref: "campanhas" })}
          >
            Escolher campanha
          </button>
        </>
      )}
    </div>
  );
}

export function CompendioPanel({
  onOpenContent,
}: {
  onOpenContent: (s: TabSpec) => void;
}) {
  const unavailable = useCatalogueCampaign(onOpenContent);
  const { active } = useCampaigns(),
    { user } = useAuth();
  return (
    unavailable ?? (
      <CompendioInicio
        key={`${user?.id}:${active?.campaign.id}`}
        onOpenContent={onOpenContent}
      />
    )
  );
}

const grupos = {
  Campanha: [
    {
      id: "personagens",
      nome: "Personagens",
      descricao: "Aventureiros e NPCs",
      Icon: Users,
    },
    {
      id: "monstros",
      nome: "Bestiário",
      descricao: "Criaturas e monstros",
      Icon: Shield,
    },
    {
      id: "locais",
      nome: "Locais",
      descricao: "Cidades e regiões",
      Icon: MapIcon,
    },
    {
      id: "organizacoes",
      nome: "Organizações",
      descricao: "Facções e guildas",
      Icon: Flag,
    },
    {
      id: "descobertas",
      nome: "Descobertas",
      descricao: "Mapas, documentos e artefatos",
      Icon: ScrollText,
    },
  ],
  Regras: [
    {
      id: "racas",
      nome: "Raças",
      descricao: "Povos e características raciais",
      Icon: Users,
    },
    {
      id: "classes",
      nome: "Classes",
      descricao: "Classes e progressão",
      Icon: Swords,
    },
    {
      id: "origens",
      nome: "Origens",
      descricao: "Antecedentes e proficiências",
      Icon: ScrollText,
    },
    {
      id: "talentos",
      nome: "Talentos e habilidades",
      descricao: "Características e capacidades",
      Icon: Sparkles,
    },
    {
      id: "magias",
      nome: "Magias",
      descricao: "Truques e círculos de magia",
      Icon: Wand,
    },
    {
      id: "itens",
      nome: "Itens",
      descricao: "Armas, armaduras e equipamentos",
      Icon: Backpack,
    },
    {
      id: "regras",
      nome: "Regras e condições",
      descricao: "Mecânicas e consultas rápidas",
      Icon: BookOpen,
    },
  ],
};
const sessoes = new WeakMap<
  object,
  Map<string, { grupo: keyof typeof grupos; query?:string }>
>();
function CompendioInicio({
  onOpenContent,
}: {
  onOpenContent: (s: TabSpec) => void;
}) {
  const { active } = useCampaigns(),
    { user, client } = useAuth();
  const navegacao = useMemo(() => {
    if (!client)
      return new Map<
        string,
        { grupo: keyof typeof grupos; query?:string }
      >();
    let n = sessoes.get(client);
    if (!n) {
      n = new Map();
      sessoes.set(client, n);
    }
    return n;
  }, [client]);
  const tabOrigin=useContext(OrigemAbaContext);
  const scope = `${user?.id}:${active?.campaign.id}:${tabOrigin}`;
  const inicial = navegacao.get(scope);
  const [grupo, setGrupo] = useState<keyof typeof grupos>(
    inicial?.grupo ?? "Campanha",
  );
  const links=useAbrirEmAba();
  const categoriaSpec=(id:string):TabSpec=>({kind:"categoria",ref:id,title:tituloCategoria(id)});
  const toque = useRef<{x:number;y:number}|null>(null), root=useRef<HTMLDivElement>(null);
  const [wide,setWide]=useState(false),[query,setQuery]=useState(inicial&&'query' in inicial?String(inicial.query??''):'');
  const notices=useNotificacoes();
  useEffect(()=>{const el=root.current;if(!el||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(entries=>setWide((entries[0]?.contentRect.width??0)>=760));observer.observe(el);return()=>observer.disconnect();},[]);
  useEffect(()=>{navegacao.set(scope,{grupo,query});},[scope,grupo,query]);
  return <div className="content compendio-inicio cd-home" ref={root} data-wide={wide} onTouchStart={e=>{if((e.target as HTMLElement).closest('input,textarea,select'))return;const t=e.touches[0];toque.current={x:t.clientX,y:t.clientY};}} onTouchCancel={()=>{toque.current=null;}} onTouchEnd={e=>{const start=toque.current;toque.current=null;if(!start||wide)return;const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;if(Math.abs(dx)>65&&Math.abs(dx)>1.4*Math.abs(dy))setGrupo(dx<0?'Regras':'Campanha');}}>
   <h1>Compêndio</h1><PesquisaGlobal query={query} onQuery={setQuery} onOpenContent={onOpenContent}/>
   {!query.trim()&&<>{!wide&&<div className="cat-categorias" role="group" aria-label="Áreas do Compêndio">{(['Campanha','Regras'] as const).map(g=><button key={g} aria-pressed={grupo===g} onClick={()=>setGrupo(g)}>{g}</button>)}</div>}
   <div className="cd-home-groups">{(wide?['Campanha','Regras'] as const:[grupo]).map(g=><section key={g} aria-label={g}><h2>{g}</h2><div className="compendio-portais">{grupos[g].map(({id,nome,descricao,Icon})=><button key={id} className="compendio-portal" onClick={e=>{const s=categoriaSpec(id);if(!links.aoClicar(e,s))onOpenContent(s);}} onAuxClick={e=>links.aoBotaoDoMeio(e,categoriaSpec(id))} onContextMenu={e=>links.aoClicarDireito(e,categoriaSpec(id))}><span><strong>{nome}{id==='descobertas'&&notices.feed.discoveries>0&&<span className="cd-badge">{notices.feed.discoveries}<span className="sr-only"> {notices.feed.discoveries===1?'novidade':'novidades'}</span></span>}</strong>{' '}<small>{descricao}</small></span><Icon className="compendio-portal-arte" aria-hidden="true"/><ChevronRight size={18} aria-hidden="true"/></button>)}</div></section>)}</div></>}
  </div>;
}

/** Aba `item:<id>`: definição completa do item. Também é o destino de "Consultar no Compêndio" no inventário. */
export function ItemPagina({
  id,
  onOpenContent,
}: {
  id: string;
  onOpenContent: (s: TabSpec) => void;
}) {
  const unavailable = useCatalogueCampaign(onOpenContent);
  const { active } = useCampaigns(),
    { items, loading, error } = useConhecimento();
  const definicoes = useDefinicoes();
  const definicao = useDefinicao("item", unavailable || id.startsWith("monstro:") ? undefined : id);
  useEffect(() => { if (definicao?.campanha) registrarTitulo(id, definicao.nome); }, [id, definicao?.nome]);
  if (unavailable) return unavailable;
  if (active?.role !== "mestre") {
    if (id.startsWith("monstro:")) {
      const e = items.find(
        (x) =>
          x.category === "monster" &&
          x.definitionId === id.slice(8),
      );
      return (
        <div className="content">
          {e ? (
            <VisaoRegistro entry={e} mostrarPosse={false} links={[]} rows={[]} onOpenContent={onOpenContent} />
          ) : (
            <p>
              {loading
                ? "Verificando conhecimento…"
                : "Conteúdo não revelado nesta campanha."}
            </p>
          )}
        </div>
      );
    }
    if (!jogadorPodeAdicionar(id) && !itemConhecido(items, id))
      return (
        <div className="content">
          <Aviso
            t={
              loading
                ? "Verificando conhecimento…"
                : (error ?? "Item não descoberto nesta campanha.")
            }
          />
        </div>
      );
  }
  if (id.startsWith("monstro:")) return <MonstroPagina id={id.slice(8)} onOpenContent={onOpenContent}/>;
  const efetiva = definicao?.kind === "item" ? definicao : undefined;
  const item = efetiva?.item ?? srdItem(id);
  if (!item && (definicoes.carregando || (id.startsWith("custom-") && definicoes.lista.some((d) => d.definitionId === id))))
    return <div className="content"><p role="status">Carregando item…</p></div>;
  if (!item)
    return (
      <div className="content">
        <h1>Item</h1>
        <Aviso
          erro
          t="Item não encontrado no catálogo desta revisão. O identificador pode ser antigo ou inválido."
        />
      </div>
    );
  return (
    <div className="content cd-page item-pagina"><VoltarCompendio onOpenContent={onOpenContent}/>
      <Carta trilha="Regras / Item" nome={item.nome} linha={item.en} rotulo={`Detalhes de ${item.nome}`}
        imagem={imagemDoItem(id) ? <RetratoQuadrado src={imagemDoItem(id)} tipo="avulso" tamanho={200} ampliar={item.nome}/> : undefined}
        acoes={active?.role === "mestre" ? <><RegistrarDescoberta category="item" id={id} onOpenContent={onOpenContent}/><EntregarItem definitionId={id} nome={item.nome}/></> : undefined}>
        <DetalheItem item={item} descricao={efetiva?.descricao} personalizado={!!efetiva?.campanha} onOpenContent={onOpenContent} mostrarImagem={false}/>
        {efetiva && <AcoesDefinicao definicao={efetiva} onOpenContent={onOpenContent}/>}
      </Carta>
    </div>
  );
}

/** Ficha técnica de uma criatura: exclusiva do mestre. Os jogadores conhecem criaturas somente pela carta narrativa. */
export function MonstroPagina({id,onOpenContent}:{id:string;onOpenContent:(s:TabSpec)=>void}){
 const {active}=useCampaigns(),knowledge=useConhecimento();const master=active?.role==='mestre';
 const registro=knowledge.items.find(x=>x.systemId==='dnd5e-2014'&&x.category==='monster'&&x.definitionId===id&&x.registered!==false);
 return <PaginaFichaTecnica definitionId={master?id:undefined} memoria={`${active?.campaign.id}:${id}`} onOpenContent={onOpenContent}
  terceira={{id:'bestiario',rotulo:'Bestiário',conteudo:registro
    ?<div className="ficha-embutida"><RegistroCompendioPagina id={registro.id} onOpenContent={onOpenContent} semFicha/></div>
    :<section className="ficha-bloco"><p className="muted">Esta criatura ainda não tem história registrada na campanha.</p><RegistrarDescoberta category="monster" id={id} onOpenContent={onOpenContent}/></section>}}/>;
}

/** Ficha de combate de um NPC: o mesmo modelo de criatura, com a identidade narrativa do próprio NPC. */
export function NpcFichaPagina({id,onOpenContent}:{id:string;onOpenContent:(s:TabSpec)=>void}){
 const {active}=useCampaigns(),knowledge=useConhecimento();const master=active?.role==='mestre';
 const npc=knowledge.items.find(x=>x.id===id&&x.category==='npc');
 if(master&&!knowledge.loading&&!npc?.combatDefinitionId)return <div className="content cd-page"><VoltarCompendio onOpenContent={onOpenContent}/><Aviso t="Este NPC não tem ficha de combate vinculada."/></div>;
 return <PaginaFichaTecnica definitionId={master?npc?.combatDefinitionId:undefined} nome={npc?.title} retrato={npc?<ImagemRegistro entry={npc} tamanho={104} ampliar/>:undefined} carregando={knowledge.loading}
  memoria={`${active?.campaign.id}:npc:${id}`} onOpenContent={onOpenContent} semAcoes
  terceira={{id:'identidade',rotulo:'Identidade',conteudo:<div className="ficha-embutida"><RegistroCompendioPagina id={id} onOpenContent={onOpenContent} semFicha/></div>}}/>;
}

function PaginaFichaTecnica({definitionId,nome,retrato,memoria,terceira,carregando=false,semAcoes=false,onOpenContent}:{definitionId?:string;nome?:string;retrato?:ReactNode;memoria:string;terceira:AbaExtra;carregando?:boolean;semAcoes?:boolean;onOpenContent:(s:TabSpec)=>void}){
 const {active}=useCampaigns(),voltar=useContext(VoltarPaginaContext),definicoes=useDefinicoes();
 const [data,setData]=useState<{id:string;definicao?:Definicao;error?:string}>();
 useEffect(()=>{let alive=true;if(definitionId&&!definicoes.carregando)void carregarDefinicao('monster',definitionId,definicoes.lista).then(definicao=>{if(alive){setData({id:definitionId,definicao});if(definicao&&!nome)registrarTitulo(definitionId,definicao.nome);}},()=>{if(alive)setData({id:definitionId,error:'Não foi possível carregar a criatura.'});});return()=>{alive=false;};},[definitionId,definicoes.lista,definicoes.carregando]);
 if(active&&active.role!=='mestre')return <div className="content cd-page"><VoltarCompendio onOpenContent={onOpenContent}/><Aviso t="A ficha técnica é exclusiva do mestre. Consulte o que seu grupo conhece em Bestiário."/></div>;
 const atual=data&&data.id===definitionId?data:undefined,efetiva=atual?.definicao?.kind==='monster'?atual.definicao:undefined;
 if(!efetiva)return <div className="content cd-page">{voltar&&<VoltarCompendio onOpenContent={onOpenContent} label="Voltar"/>}{atual?<Aviso erro t={atual.error??'Criatura não encontrada.'}/>:<p role="status">{carregando?'Carregando registro…':'Carregando criatura…'}</p>}</div>;
 return <FichaMonstro key={memoria} monstro={efetiva.monstro} nome={nome} retrato={retrato} personalizado={!!efetiva.campanha} memoria={memoria} terceira={terceira}
  acoes={semAcoes?undefined:<AcoesDefinicao definicao={efetiva} onOpenContent={onOpenContent}/>}
  onAbrirMagia={ref=>onOpenContent({kind:'magia',ref})}/>;
}

/** Categorias são destinos do mesmo histórico, não páginas escondidas dentro do índice. */
export function CategoriaCompendio({id,onOpenContent}:{id:string;onOpenContent:(s:TabSpec)=>void}){
 const {active}=useCampaigns(),back=useContext(VoltarPaginaContext);
 const gate=useCatalogueCampaign(onOpenContent);if(gate)return gate;
 const definition=Object.values(grupos).flat().find(c=>c.id===id);
 if(!definition)return <div className="content"><Aviso t="Categoria indisponível."/></div>;
 const voltar=()=>back?back():onOpenContent({kind:"secao",ref:"compendio"});
 return ['personagens','locais','organizacoes','descobertas'].includes(id)||(id==='monstros'&&active?.role!=='mestre')
  ?<ListaCampanha category={id} onBack={voltar} onOpenContent={onOpenContent}/>
  :<CompendioCatalogo categoriaInicial={id} onVoltar={voltar} onOpenContent={onOpenContent}/>;
}

export const tituloCategoria=(id:string)=>Object.values(grupos).flat().find(c=>c.id===id)?.nome??"Compêndio";
