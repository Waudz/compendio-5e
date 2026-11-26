import { RetratoQuadrado } from "./RetratoCombate";
import { imagemDoMonstro } from "./ficha/imagensCatalogo";
import { registrarTitulo } from "./registrosStore";
import { VoltarCompendio } from "./compendio/Paginas";
import { RevelarReferencia } from "./compendio/RegistrosCampanha";
import { PesquisaGlobal } from "./compendio/PesquisaGlobal";
import { ListaCampanha } from "./compendio/ListaCampanha";
import { useNotificacoes } from "./compendio/Notificacoes";
import { useUnsaved } from "./unsaved";
import { OrigemAbaContext } from "./abrirEmAba";
import {
  DetalheConhecido,
} from "./compendio/RegistrosCampanha";
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
import type { Monstro } from "./catalogue/sistemas/dnd5e-2014/esquemas";
import { DetalheMonstro } from "./compendio/DetalheMonstro";
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
  Map<string, { grupo: keyof typeof grupos; categoria: string | null; query?:string }>
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
        { grupo: keyof typeof grupos; categoria: string | null; query?:string }
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
  const [categoria, setCategoria] = useState<string | null>(
    inicial?.categoria ?? null,
  );
  useEffect(() => {
    navegacao.set(scope, { grupo, categoria });
  }, [scope, grupo, categoria]);
  const unsaved = useUnsaved(),
    origin = useContext(OrigemAbaContext);
  const voltar = () =>
    unsaved.guard([origin ?? "secao:compendio"], () => setCategoria(null));
  const abrir = (id: string) => setCategoria(id);
  const toque = useRef<{x:number;y:number}|null>(null), root=useRef<HTMLDivElement>(null);
  const [wide,setWide]=useState(false),[query,setQuery]=useState(inicial&&'query' in inicial?String(inicial.query??''):'');
  const notices=useNotificacoes();
  useEffect(()=>{const el=root.current;if(!el||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(entries=>setWide((entries[0]?.contentRect.width??0)>=760));observer.observe(el);return()=>observer.disconnect();},[categoria]);
  useEffect(()=>{navegacao.set(scope,{grupo,categoria,query});},[scope,grupo,categoria,query]);
  if(categoria)return ['personagens','locais','organizacoes','descobertas'].includes(categoria)||(categoria==='monstros'&&active?.role!=='mestre')?<ListaCampanha key={`${scope}:${categoria}`} category={categoria} onBack={voltar} onOpenContent={onOpenContent}/>:<CompendioCatalogo key={`${scope}:${categoria}`} categoriaInicial={categoria} onVoltar={voltar} onOpenContent={onOpenContent}/>;
  return <div className="content compendio-inicio cd-home" ref={root} data-wide={wide} onTouchStart={e=>{if((e.target as HTMLElement).closest('input,textarea,select'))return;const t=e.touches[0];toque.current={x:t.clientX,y:t.clientY};}} onTouchCancel={()=>{toque.current=null;}} onTouchEnd={e=>{const start=toque.current;toque.current=null;if(!start||wide)return;const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;if(Math.abs(dx)>65&&Math.abs(dx)>1.4*Math.abs(dy))setGrupo(dx<0?'Regras':'Campanha');}}>
   <h1>Compêndio</h1><PesquisaGlobal query={query} onQuery={setQuery} onOpenContent={onOpenContent}/>
   {!query.trim()&&<>{!wide&&<div className="cat-categorias" role="group" aria-label="Áreas do Compêndio">{(['Campanha','Regras'] as const).map(g=><button key={g} aria-pressed={grupo===g} onClick={()=>setGrupo(g)}>{g}</button>)}</div>}
   <div className="cd-home-groups">{(wide?['Campanha','Regras'] as const:[grupo]).map(g=><section key={g} aria-label={g}><h2>{g}</h2><div className="compendio-portais">{grupos[g].map(({id,nome,descricao,Icon})=><button key={id} className="compendio-portal" onClick={()=>abrir(id)}><span><strong>{nome}{id==='descobertas'&&notices.feed.discoveries>0&&<span className="cd-badge">{notices.feed.discoveries}<span className="sr-only"> {notices.feed.discoveries===1?'novidade':'novidades'}</span></span>}</strong>{' '}<small>{descricao}</small></span><Icon className="compendio-portal-arte" aria-hidden="true"/><ChevronRight size={18} aria-hidden="true"/></button>)}</div></section>)}</div></>}
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
  if (unavailable) return unavailable;
  if (active?.role !== "mestre") {
    if (id.startsWith("monstro:")) {
      const e = items.find(
        (x) =>
          x.category === "monster" &&
          x.definitionId === id.slice(8) &&
          x.knowledge === 4,
      );
      return (
        <div className="content">
          {e ? (
            <DetalheConhecido entry={e} onOpenContent={onOpenContent} />
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
  const item = srdItem(id);
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
    <div className="content cd-page item-pagina"><VoltarCompendio onOpenContent={onOpenContent}/><article aria-label={`Detalhes de ${item.nome}`}>
      <div className="eyebrow">COMPÊNDIO · ITEM</div>
      <h1>{item.nome}</h1>
      <p className="muted">{item.en}</p>
      <RevelarReferencia category="item" id={id} nome={item.nome}/>
      <DetalheItem item={item} onOpenContent={onOpenContent} /></article>
    </div>
  );
}

export function MonstroPagina({id,onOpenContent}:{id:string;onOpenContent:(s:TabSpec)=>void}){
 const {active}=useCampaigns(),knowledge=useConhecimento();const allowed=active?.role==='mestre'||knowledge.items.some(x=>x.systemId==='dnd5e-2014'&&x.category==='monster'&&x.definitionId===id&&x.knowledge===4);
 const [data,setData]=useState<{id:string;monster?:Monstro;error?:string}>();
 useEffect(()=>{let alive=true;if(allowed)void import('./catalogue/contratos').then(c=>c.todosOsMonstros()).then(ms=>{const monster=ms.find(m=>m.id===id);if(alive){setData({id,monster});if(monster)registrarTitulo(id,monster.nome);}},()=>{if(alive)setData({id,error:'Não foi possível carregar a criatura.'});});return()=>{alive=false;};},[id,allowed]);
 if(!allowed)return <div className="content cd-page"><VoltarCompendio onOpenContent={onOpenContent}/><Aviso t={knowledge.loading?'Verificando conhecimento…':'Criatura não revelada com informações completas nesta campanha.'}/></div>;
 const m=data?.id===id?data.monster:undefined;
 return <div className="content cd-page cd-monster-page"><VoltarCompendio onOpenContent={onOpenContent}/>{m?<><header className="cd-identity"><RetratoQuadrado src={imagemDoMonstro(id)} tipo="monstro" tamanho={120}/><div><h1>{m.nome}</h1><p className="muted">{m.en}</p><RevelarReferencia category="monster" id={id} nome={m.nome}/></div></header><article aria-label={`Detalhes de ${m.nome}`}><DetalheMonstro monstro={m} mostrarImagem={false} onAbrirMagia={ref=>onOpenContent({kind:'magia',ref})}/></article></>:data?.id===id?<Aviso erro t={data.error??'Criatura não encontrada.'}/>:<p role="status">Carregando criatura…</p>}</div>;
}
