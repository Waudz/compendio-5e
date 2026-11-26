// Detalhe de um item do catálogo (usado no painel do Compêndio e na aba `item:<id>`). Mesma definição compartilhada com o criador e o inventário.
import { useAbrirEmAba } from "../abrirEmAba";
import { itemFacts, srdItem, srdItemFile, srdItemsCatalogue } from "../catalogue/srd-2014-items";
import type { SrdItem } from "../catalogue/item-schema";
import type { TabSpec } from "../workspace";
import { imagemDoItem } from "../ficha/imagensCatalogo";

export const itemSpec = (id: string, nome: string): TabSpec => ({ kind: "item", ref: id, title: nome });

export function DetalheItem({ item, onOpenContent }: { item: SrdItem; onOpenContent: (s: TabSpec) => void }) {
  const { aoClicarDireito } = useAbrirEmAba();
  const desc = srdItemsCatalogue().definitions.find(d => d.ref.id === item.id)?.description ?? "";
  const arquivo = srdItemFile();
  const imagem = imagemDoItem(item.id);
  return <>
    {imagem && <img className="catalogo-imagem" src={imagem} alt={`Imagem de ${item.nome}`} loading="lazy" onError={e => { e.currentTarget.hidden = true; }}/>}
    <p>{desc}</p>
    <dl className="item-fatos">{itemFacts(item).map(([r, v]) => <div key={r}><dt>{r}</dt><dd>{v}</dd></div>)}</dl>
    {item.pacote && <section aria-label="Conteúdo do pacote"><h2>Conteúdo do pacote</h2>
      <ul>{item.pacote.map(c => { const parte = srdItem(c.id); const s = itemSpec(c.id, parte?.nome ?? c.id);
        return <li key={c.id}>{c.qtd} × <button type="button" className="link" onClick={() => onOpenContent(s)} onContextMenu={e => aoClicarDireito(e, s)}>{parte?.nome ?? c.id}</button></li>; })}</ul></section>}
    <p className="muted fonte">Fonte: {arquivo.source.title}, revisão {arquivo.revision} · identificador <code>{`${arquivo.source.id}:item:${item.id}:${arquivo.revision}`}</code> · licença {arquivo.source.license}. Peso em kg e alcance em metros seguem a convenção do projeto.</p>
    <details className="muted"><summary>Atribuição</summary><p>{arquivo.source.attribution}</p></details>
  </>;
}
