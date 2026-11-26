import { useEffect, useRef, useState } from "react";
import { Users, Shield, Map, Flag, ScrollText, BookOpen, Sparkles, Backpack, Wand, ChevronRight, Swords } from "lucide-react";
import "./compendio/compendio-categorias.css";
import type { Monstro } from "./catalogue/sistemas/dnd5e-2014/esquemas";
import { DetalheMonstro } from "./compendio/DetalheMonstro";
// Compêndio: ponto de entrada da seção (painel do catálogo) e da página de item (aba `item:<id>`, aberta pelo inventário do criador e pelos pacotes).
// O painel é o catálogo genérico de `src/compendio/` (itens, magias e monstros de D&D 5e 2014); a página de item reutiliza o mesmo detalhe.
import { Aviso } from "./Diario";
import { PersonagensPanel } from "./Personagens";
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
  return <div className="content"><h1>Compêndio</h1>
    {loading ? <p role="status">Verificando sua campanha…</p>
      : error ? <Aviso erro t="Não foi possível verificar sua campanha. Tente novamente para consultar o Compêndio." onRetry={() => void refresh()}/>
      : <><p>Escolha ou entre em uma campanha para consultar o Compêndio.</p>
        <button className="btn-primary" onClick={() => onOpenContent({ kind: "secao", ref: "campanhas" })}>Escolher campanha</button></>}
  </div>;
}

export function CompendioPanel({ onOpenContent }: { onOpenContent: (s: TabSpec) => void }) {
  const unavailable = useCatalogueCampaign(onOpenContent);
  return unavailable ?? <CompendioInicio onOpenContent={onOpenContent}/>;
}

const grupos = {
  Campanha: [
    { id: "personagens", nome: "Personagens", descricao: "Aventureiros e NPCs", Icon: Users },
    { id: "monstros", nome: "Bestiário", descricao: "Criaturas e monstros", Icon: Shield },
    { id: "locais", nome: "Locais", descricao: "Cidades e regiões", Icon: Map },
    { id: "organizacoes", nome: "Organizações", descricao: "Facções e guildas", Icon: Flag },
    { id: "descobertas", nome: "Descobertas", descricao: "Mapas, documentos e artefatos", Icon: ScrollText },
  ],
  Regras: [
    { id: "racas", nome: "Raças", descricao: "Povos e características raciais", Icon: Users },
    { id: "classes", nome: "Classes", descricao: "Classes e progressão", Icon: Swords },
    { id: "origens", nome: "Origens", descricao: "Antecedentes e proficiências", Icon: ScrollText },
    { id: "talentos", nome: "Talentos e habilidades", descricao: "Características e capacidades", Icon: Sparkles },
    { id: "magias", nome: "Magias", descricao: "Truques e círculos de magia", Icon: Wand },
    { id: "itens", nome: "Itens", descricao: "Armas, armaduras e equipamentos", Icon: Backpack },
    { id: "regras", nome: "Regras e condições", descricao: "Mecânicas e consultas rápidas", Icon: BookOpen },
  ],
};
function CompendioInicio({ onOpenContent }: { onOpenContent: (s: TabSpec) => void }) {
  const [grupo, setGrupo] = useState<keyof typeof grupos>("Campanha");
  const [categoria, setCategoria] = useState<string | null>(null);
  const { active } = useCampaigns();
  const toque = useRef<{ x: number; y: number } | null>(null);
  const disponiveis = ["personagens", "racas", "classes", "magias", "itens", ...(active?.role === "mestre" ? ["monstros"] : [])];
  if (categoria === "personagens") return <><button type="button" className="btn-secondary" onClick={() => setCategoria(null)}>Voltar às categorias</button><PersonagensPanel onOpenContent={onOpenContent}/></>;
  if (categoria && disponiveis.includes(categoria)) return <CompendioCatalogo key={categoria} categoriaInicial={categoria} onVoltar={() => setCategoria(null)} ocultarMonstros={active?.role !== "mestre"} onOpenContent={onOpenContent}/>;
  return <div className="content compendio-inicio" onTouchStart={e => { const t = e.touches[0]; toque.current = { x: t.clientX, y: t.clientY }; }} onTouchCancel={() => { toque.current = null; }} onTouchEnd={e => { const inicio = toque.current; toque.current = null; if (!inicio || window.matchMedia("(min-width:701px)").matches) return; const t = e.changedTouches[0]; const dx = t.clientX - inicio.x, dy = t.clientY - inicio.y; if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) setGrupo(dx < 0 ? "Regras" : "Campanha"); }}>
    <h1>Compêndio</h1>
    <div className="cat-categorias" role="group" aria-label="Áreas do Compêndio">
      {(["Campanha", "Regras"] as const).map(g => <button key={g} type="button" aria-pressed={grupo === g} className={grupo === g ? "active" : ""} onClick={() => setGrupo(g)}>{g}</button>)}
    </div>
    <div className="compendio-portais">
      {grupos[grupo].map(({id, nome, descricao, Icon}) => <button key={id} type="button" className="compendio-portal" disabled={!disponiveis.includes(id)} onClick={() => setCategoria(id)}>
        <span><strong>{nome}</strong><small>{descricao}</small>{!disponiveis.includes(id) && <small>Em preparação</small>}</span>
        <Icon className="compendio-portal-arte" aria-hidden="true"/>
        <ChevronRight size={18} aria-hidden="true"/>
      </button>)}
    </div>
  </div>;
}

/** Aba `item:<id>`: definição completa do item. Também é o destino de "Consultar no Compêndio" no inventário. */
export function ItemPagina({ id, onOpenContent }: { id: string; onOpenContent: (s: TabSpec) => void }) {
  const unavailable = useCatalogueCampaign(onOpenContent);
  if (unavailable) return unavailable;
  if (id.startsWith("monstro:")) return <MonstroPagina id={id.slice(8)}/>;
  const item = srdItem(id);
  if (!item) return <div className="content"><h1>Item</h1><Aviso erro t="Item não encontrado no catálogo desta revisão. O identificador pode ser antigo ou inválido."/></div>;
  return <div className="content item-pagina">
    <div className="eyebrow">COMPÊNDIO · ITEM</div>
    <h1>{item.nome}</h1>
    <p className="muted">{item.en}</p>
    <DetalheItem item={item} onOpenContent={onOpenContent}/>
  </div>;
}

function MonstroPagina({ id }: { id: string }) {
  const [dados, setDados] = useState<{ id: string; monstro?: Monstro; erro?: boolean } | null>(null);
  useEffect(() => { let vivo = true; import("./catalogue/contratos").then(c => c.todosOsMonstros()).then(lista => { if (vivo) setDados({ id, monstro: lista.find(m => m.id === id) }); }, () => { if (vivo) setDados({ id, erro: true }); }); return () => { vivo = false; }; }, [id]);
  if (!dados || dados.id !== id) return <p role="status">Carregando ficha…</p>;
  return <div className="content">{dados.monstro ? <><h1>{dados.monstro.nome}</h1><DetalheMonstro monstro={dados.monstro}/></> : <Aviso erro t={dados.erro ? "Não foi possível carregar a ficha." : "Criatura não encontrada."}/>}</div>;
}
