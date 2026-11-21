// Compêndio: seção com busca, filtros e visualização em lista/grade, e página de cada item (aba `item:<id>`).
// Lê o catálogo canônico (`src/catalogue`), a MESMA definição usada pelo criador e pelo inventário. Hoje só há itens;
// as demais categorias (classes, magias, criaturas...) entram quando o catálogo delas existir.
import { LayoutGrid, List } from "lucide-react";
import { useMemo, useState } from "react";
import { useAbrirEmAba } from "./abrirEmAba";
import { categoriaDoItemRotulo, itemFacts, raridadeRotulo, srdItem, srdItemFile, srdItemsCatalogue } from "./catalogue/srd-2014-items";
import { categoriasDeItem, raridades, type SrdItem } from "./catalogue/item-schema";
import { Aviso } from "./Diario";
import { searchCompendium } from "./rules/compendium-query";
import type { TabSpec } from "./workspace";

const PAGINA = 60;
type Visao = "lista" | "grade";

export const itemSpec = (id: string, nome: string): TabSpec => ({ kind: "item", ref: id, title: nome });

export function CompendioPanel({ onOpenContent }: { onOpenContent: (s: TabSpec) => void }) {
  const { aoClicarDireito } = useAbrirEmAba();
  const [texto, setTexto] = useState(""), [categoria, setCategoria] = useState<SrdItem["categoria"] | "">(""), [raridade, setRaridade] = useState<SrdItem["raridade"] | "">("");
  const [visao, setVisao] = useState<Visao>("lista"), [limite, setLimite] = useState(PAGINA);
  const resultado = useMemo(() => {
    const linhas = searchCompendium(srdItemsCatalogue(), { kind: "item", text: texto });
    return linhas.filter(l => { const i = srdItem(l.ref.id); return !!i && (!categoria || i.categoria === categoria) && (!raridade || i.raridade === raridade); });
  }, [texto, categoria, raridade]);
  const mostrados = resultado.slice(0, limite);
  const mudar = <T,>(set: (v: T) => void) => (v: T) => { set(v); setLimite(PAGINA); };
  return <div className="content compendio">
    <div className="eyebrow">COMPÊNDIO 5e · SRD 5.1 (2014)</div>
    <h1>Compêndio</h1>
    <p className="muted">Itens do SRD 5.1. Classes, magias e criaturas entrarão quando o catálogo delas estiver pronto.</p>
    <div className="compendio-filtros">
      <label>Pesquisar<input type="search" aria-label="Pesquisar no Compêndio" value={texto} placeholder="Nome em português ou inglês" onChange={e => mudar(setTexto)(e.target.value)}/></label>
      <label>Categoria<select aria-label="Filtrar por categoria" value={categoria} onChange={e => mudar(setCategoria)(e.target.value as SrdItem["categoria"] | "")}>
        <option value="">Todas</option>{categoriasDeItem.map(c => <option key={c} value={c}>{categoriaDoItemRotulo(c)}</option>)}</select></label>
      <label>Raridade<select aria-label="Filtrar por raridade" value={raridade} onChange={e => mudar(setRaridade)(e.target.value as SrdItem["raridade"] | "")}>
        <option value="">Todas</option>{raridades.map(r => <option key={r} value={r}>{raridadeRotulo(r)}</option>)}</select></label>
      <div className="compendio-visao" role="group" aria-label="Visualização">
        <button type="button" aria-pressed={visao === "lista"} className={visao === "lista" ? "active" : ""} onClick={() => setVisao("lista")}><List size={16} aria-hidden="true"/> Lista</button>
        <button type="button" aria-pressed={visao === "grade"} className={visao === "grade" ? "active" : ""} onClick={() => setVisao("grade")}><LayoutGrid size={16} aria-hidden="true"/> Grade</button>
      </div>
    </div>
    <p role="status" className="muted">{resultado.length} {resultado.length === 1 ? "resultado" : "resultados"}{resultado.length > mostrados.length ? ` (mostrando ${mostrados.length})` : ""}</p>
    {resultado.length === 0 && <p className="muted" data-testid="compendio-vazio">Nada encontrado. Tente outro termo ou limpe os filtros.</p>}
    <ul className={`compendio-lista ${visao}`} aria-label="Resultados do Compêndio" data-view={visao}>
      {mostrados.map(l => { const s = itemSpec(l.ref.id, l.name); const i = srdItem(l.ref.id)!;
        return <li key={l.key}><button type="button" className="compendio-item" aria-label={`Abrir ${l.name}`} onClick={() => onOpenContent(s)} onContextMenu={e => aoClicarDireito(e, s)}>
          <strong>{l.name}</strong><small>{categoriaDoItemRotulo(i.categoria)}{i.raridade !== "mundano" ? ` · ${raridadeRotulo(i.raridade)}` : ""}</small>
          {visao === "grade" && <span className="muted">{l.description}</span>}</button></li>; })}
    </ul>
    {resultado.length > mostrados.length && <button type="button" className="btn-secondary" onClick={() => setLimite(n => n + PAGINA)}>Mostrar mais</button>}
  </div>;
}

/** Aba `item:<id>`: definição completa do item. Também é o destino de "Consultar no Compêndio" no inventário. */
export function ItemPagina({ id, onOpenContent }: { id: string; onOpenContent: (s: TabSpec) => void }) {
  const { aoClicarDireito } = useAbrirEmAba();
  const item = srdItem(id);
  if (!item) return <div className="content"><h1>Item</h1><Aviso erro t="Item não encontrado no catálogo desta revisão. O identificador pode ser antigo ou inválido."/></div>;
  const desc = srdItemsCatalogue().definitions.find(d => d.ref.id === item.id)?.description ?? "";
  const arquivo = srdItemFile();
  return <div className="content item-pagina">
    <div className="eyebrow">COMPÊNDIO · ITEM</div>
    <h1>{item.nome}</h1>
    <p className="muted">{item.en}</p>
    <p>{desc}</p>
    <dl className="item-fatos">{itemFacts(item).map(([r, v]) => <div key={r}><dt>{r}</dt><dd>{v}</dd></div>)}</dl>
    {item.pacote && <section aria-label="Conteúdo do pacote"><h2>Conteúdo do pacote</h2>
      <ul>{item.pacote.map(c => { const parte = srdItem(c.id); const s = itemSpec(c.id, parte?.nome ?? c.id);
        return <li key={c.id}>{c.qtd} × <button type="button" className="link" onClick={() => onOpenContent(s)} onContextMenu={e => aoClicarDireito(e, s)}>{parte?.nome ?? c.id}</button></li>; })}</ul></section>}
    <p className="muted fonte">Fonte: {arquivo.source.title}, revisão {arquivo.revision} · identificador <code>{`${arquivo.source.id}:item:${item.id}:${arquivo.revision}`}</code> · licença {arquivo.source.license}. Peso em kg e alcance em metros seguem a convenção do projeto.</p>
    <details className="muted"><summary>Atribuição</summary><p>{arquivo.source.attribution}</p></details>
  </div>;
}
