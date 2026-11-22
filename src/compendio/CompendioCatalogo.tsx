// Compêndio: catálogo de D&D 5e (2014) com itens, magias e monstros. Guiado pelo núcleo genérico (`src/catalogue/nucleo`): a mesma tela serve a qualquer
// categoria de qualquer sistema registrado. Pesquisa sem acento, filtros próprios de cada categoria, lista/grade, detalhe em painel dividido (celular: tela
// cheia com "Voltar") e esqueletos enquanto o pedaço de dados baixa. Não usa abas nem altera a navegação global.
import { ArrowLeft, ExternalLink, LayoutGrid, List, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAbrirEmAba } from "../abrirEmAba";
import { Aviso } from "../Diario";
import { consultar, type Consulta, type Indice } from "../catalogue/nucleo/busca";
import { indiceDisponivel, carregarIndice } from "../catalogue/nucleo/registro";
import type { CategoriaDef } from "../catalogue/nucleo/tipos";
import { garantirSistemaDnd5e2014, sistemaDnd5e2014 } from "../catalogue/sistemas/dnd5e-2014";
import type { Magia, Monstro } from "../catalogue/sistemas/dnd5e-2014/esquemas";
import type { SrdItem } from "../catalogue/item-schema";
import { raridadeRotulo } from "../catalogue/srd-2014-items";
import type { TabSpec } from "../workspace";
import { DetalheItem, itemSpec } from "./DetalheItem";
import { DetalheMagia } from "./DetalheMagia";
import { DetalheMonstro } from "./DetalheMonstro";
import { EsqueletoDetalhe, EsqueletoLista } from "./Esqueleto";

const PAGINA = 60;
type Visao = "lista" | "grade";
type Qualquer = CategoriaDef<unknown>;
type Estado = { status: "carregando" } | { status: "erro"; mensagem: string } | { status: "pronto"; indice: Indice<unknown> };

garantirSistemaDnd5e2014();
const categorias = sistemaDnd5e2014.categorias as unknown as readonly Qualquer[];

/** Estado de carregamento SEMPRE amarrado à categoria a que pertence: ao trocar de categoria nunca se usa o índice da anterior (nem por um render). */
function useIndice(cat: Qualquer): { estado: Estado; tentar: () => void } {
  const [tentativa, setTentativa] = useState(0);
  const calcular = (c: Qualquer): Estado => { const i = indiceDisponivel(c); return i ? { status: "pronto", indice: i } : { status: "carregando" }; };
  const [guardado, setGuardado] = useState<{ cat: Qualquer; estado: Estado }>(() => ({ cat, estado: calcular(cat) }));
  useEffect(() => {
    const pronto = indiceDisponivel(cat); if (pronto) { setGuardado({ cat, estado: { status: "pronto", indice: pronto } }); return; }
    let vivo = true; setGuardado({ cat, estado: { status: "carregando" } });
    carregarIndice(cat).then(indice => { if (vivo) setGuardado({ cat, estado: { status: "pronto", indice } }); },
      () => { if (vivo) setGuardado({ cat, estado: { status: "erro", mensagem: `Não foi possível carregar ${cat.rotulo.toLocaleLowerCase("pt-BR")}. Verifique a conexão e tente de novo.` } }); });
    return () => { vivo = false; };
  }, [cat, tentativa]);
  const estado = guardado.cat === cat ? guardado.estado : calcular(cat);
  return { estado, tentar: () => setTentativa(n => n + 1) };
}

export function CompendioCatalogo({ onOpenContent }: { onOpenContent: (s: TabSpec) => void }) {
  const [catId, setCatId] = useState(categorias[0].id);
  const cat = categorias.find(c => c.id === catId) ?? categorias[0];
  const { estado, tentar } = useIndice(cat);
  const [texto, setTexto] = useState(""), [filtros, setFiltros] = useState<Record<string, string | boolean>>({}), [ordenar, setOrdenar] = useState("");
  const [visao, setVisao] = useState<Visao>("lista"), [limite, setLimite] = useState(PAGINA), [aberto, setAberto] = useState<string | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const trocarCategoria = (id: string) => { setCatId(id); setTexto(""); setFiltros({}); setOrdenar(""); setLimite(PAGINA); setAberto(null); };
  const ativos = Object.values(filtros).filter(v => v !== "" && v !== false && v !== undefined).length;
  const resultado = useMemo(() => estado.status === "pronto" ? consultar(estado.indice, { texto, filtros, ordenar: ordenar || undefined } as Consulta) : [], [estado, texto, filtros, ordenar]);
  const mostrados = resultado.slice(0, limite);
  const itemAberto = useMemo(() => (estado.status === "pronto" && aberto !== null ? estado.indice.itens.find(i => cat.idDe(i) === aberto) : undefined), [estado, aberto, cat]);
  const reiniciar = useCallback(() => setLimite(PAGINA), []);
  const mudarFiltro = (id: string, v: string | boolean) => { setFiltros(f => ({ ...f, [id]: v })); reiniciar(); };

  return <div className={`content compendio cat${itemAberto ? " com-detalhe" : ""}`}>
    <div className="eyebrow">COMPÊNDIO 5e · {sistemaDnd5e2014.fonte.titulo.toLocaleUpperCase("pt-BR")}</div>
    <h1>Compêndio</h1>
    <div className="cat-categorias" role="group" aria-label="Categorias do Compêndio">
      {categorias.map(c => <button key={c.id} type="button" aria-pressed={c.id === cat.id} className={c.id === cat.id ? "active" : ""} onClick={() => trocarCategoria(c.id)}>{c.rotulo}</button>)}
    </div>
    <div className={`cat-corpo${itemAberto ? " com-detalhe" : ""}`}>
      <div className="cat-lista-area">
        <div className="compendio-filtros">
          <label>Pesquisar<input type="search" aria-label="Pesquisar no Compêndio" value={texto} placeholder="Nome em português ou inglês, ou palavras do texto" onChange={e => { setTexto(e.target.value); reiniciar(); }}/></label>
          <label>Ordenar por<select aria-label="Ordenar por" value={ordenar} onChange={e => { setOrdenar(e.target.value); reiniciar(); }}>
            <option value="">{texto.trim() ? "Relevância" : "Padrão"}</option>{cat.ordenacoes.map(o => <option key={o.id} value={o.id}>{o.rotulo}</option>)}</select></label>
          <div className="compendio-visao" role="group" aria-label="Visualização">
            <button type="button" aria-pressed={visao === "lista"} className={visao === "lista" ? "active" : ""} onClick={() => setVisao("lista")}><List size={16} aria-hidden="true"/> Lista</button>
            <button type="button" aria-pressed={visao === "grade"} className={visao === "grade" ? "active" : ""} onClick={() => setVisao("grade")}><LayoutGrid size={16} aria-hidden="true"/> Grade</button>
          </div>
        </div>
        <details className="cat-filtros" open={filtrosAbertos} onToggle={e => setFiltrosAbertos((e.target as HTMLDetailsElement).open)}>
          <summary>Filtros{ativos > 0 ? ` (${ativos} ativo${ativos > 1 ? "s" : ""})` : ""}</summary>
          <div className="cat-filtros-grade">
            {cat.filtros.map(f => f.tipo === "selecao"
              ? <label key={f.id}>{f.rotulo}<select aria-label={`Filtrar por ${f.rotulo.toLocaleLowerCase("pt-BR")}`} value={String(filtros[f.id] ?? "")} onChange={e => mudarFiltro(f.id, e.target.value)}>
                <option value="">Todos</option>{f.opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}</select></label>
              : <label key={f.id} className="check"><input type="checkbox" checked={filtros[f.id] === true} onChange={e => mudarFiltro(f.id, e.target.checked)}/> {f.rotulo}</label>)}
          </div>
          {ativos > 0 && <button type="button" className="btn-secondary" onClick={() => { setFiltros({}); reiniciar(); }}>Limpar filtros</button>}
        </details>

        {estado.status === "carregando" && <EsqueletoLista rotulo={cat.rotulo} visao={visao}/>}
        {estado.status === "erro" && <Aviso erro t={estado.mensagem} onRetry={tentar}/>}
        {estado.status === "pronto" && <>
          <p role="status" className="muted">{resultado.length} {resultado.length === 1 ? "resultado" : "resultados"}{resultado.length > mostrados.length ? ` (mostrando ${mostrados.length})` : ""}</p>
          {resultado.length === 0 && <p className="muted" data-testid="compendio-vazio">Nada encontrado. Tente outro termo ou limpe os filtros.</p>}
          <ul className={`compendio-lista ${visao}`} aria-label="Resultados do Compêndio" data-view={visao}>
            {mostrados.map(i => <Cartao key={cat.idDe(i)} cat={cat} item={i} visao={visao} ativo={cat.idDe(i) === aberto} onAbrir={() => setAberto(cat.idDe(i))}/>)}
          </ul>
          {resultado.length > mostrados.length && <button type="button" className="btn-secondary" onClick={() => setLimite(n => n + PAGINA)}>Mostrar mais</button>}
        </>}
      </div>

      {aberto !== null && <aside className="cat-detalhe" aria-label="Detalhes">
        {estado.status === "carregando" && <EsqueletoDetalhe/>}
        {itemAberto !== undefined && <Detalhe cat={cat} item={itemAberto} onFechar={() => setAberto(null)} onOpenContent={onOpenContent}/>}
        {estado.status === "pronto" && itemAberto === undefined && <><button type="button" className="btn-secondary cat-voltar" onClick={() => setAberto(null)}><ArrowLeft size={15} aria-hidden="true"/> Voltar à lista</button><Aviso t="Entrada não encontrada nesta revisão do catálogo."/></>}
      </aside>}
    </div>
  </div>;
}

function Cartao({ cat, item, visao, ativo, onAbrir }: { cat: Qualquer; item: unknown; visao: Visao; ativo: boolean; onAbrir: () => void }) {
  const { aoClicarDireito } = useAbrirEmAba();
  const nome = cat.nomeDe(item);
  const spec: TabSpec | null = cat.id === "itens" ? itemSpec(cat.idDe(item), nome) : null;
  // Sem aria-label: o nome acessível É o texto visível (nome + subtítulo [+ resumo]), como pede a WCAG 2.5.3 (rótulo no nome).
  return <li><button type="button" className={`compendio-item${ativo ? " ativo" : ""}`} aria-current={ativo ? "true" : undefined} onClick={onAbrir} onContextMenu={spec ? e => aoClicarDireito(e, spec) : undefined}>
    <strong>{nome}</strong>{" "}<small>{cat.subtituloDe(item)}</small>{visao === "grade" && cat.resumoDe && <>{" "}<span className="muted">{cat.resumoDe(item)}</span></>}</button></li>;
}

function Detalhe({ cat, item, onFechar, onOpenContent }: { cat: Qualquer; item: unknown; onFechar: () => void; onOpenContent: (s: TabSpec) => void }) {
  const nome = cat.nomeDe(item);
  return <article className="cat-detalhe-conteudo" aria-label={`Detalhes de ${nome}`}>
    <div className="cat-detalhe-topo">
      <button type="button" className="btn-secondary cat-voltar" onClick={onFechar}><ArrowLeft size={15} aria-hidden="true"/> Voltar à lista</button>
      <button type="button" className="cat-fechar" onClick={onFechar} aria-label="Fechar detalhes"><X size={18} aria-hidden="true"/></button>
    </div>
    <div className="eyebrow">{cat.rotuloItem.toLocaleUpperCase("pt-BR")}</div>
    <h2 className="cat-titulo">{nome}</h2>
    {cat.id === "magias" && <DetalheMagia magia={item as Magia}/>}
    {cat.id === "monstros" && <DetalheMonstro monstro={item as Monstro}/>}
    {cat.id === "itens" && <>
      <DetalheItem item={item as SrdItem} onOpenContent={onOpenContent}/>
      <p><button type="button" className="btn-secondary" onClick={() => onOpenContent(itemSpec(cat.idDe(item), nome))}><ExternalLink size={14} aria-hidden="true"/> Abrir em nova aba</button></p>
    </>}
  </article>;
}

export { raridadeRotulo };
