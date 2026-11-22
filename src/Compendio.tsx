// Compêndio: ponto de entrada da seção (painel do catálogo) e da página de item (aba `item:<id>`, aberta pelo inventário do criador e pelos pacotes).
// O painel é o catálogo genérico de `src/compendio/` (itens, magias e monstros de D&D 5e 2014); a página de item reutiliza o mesmo detalhe.
import { Aviso } from "./Diario";
import { srdItem } from "./catalogue/srd-2014-items";
import { CompendioCatalogo } from "./compendio/CompendioCatalogo";
import { DetalheItem, itemSpec } from "./compendio/DetalheItem";
import type { TabSpec } from "./workspace";

export { itemSpec };

export function CompendioPanel({ onOpenContent }: { onOpenContent: (s: TabSpec) => void }) {
  return <CompendioCatalogo onOpenContent={onOpenContent}/>;
}

/** Aba `item:<id>`: definição completa do item. Também é o destino de "Consultar no Compêndio" no inventário. */
export function ItemPagina({ id, onOpenContent }: { id: string; onOpenContent: (s: TabSpec) => void }) {
  const item = srdItem(id);
  if (!item) return <div className="content"><h1>Item</h1><Aviso erro t="Item não encontrado no catálogo desta revisão. O identificador pode ser antigo ou inválido."/></div>;
  return <div className="content item-pagina">
    <div className="eyebrow">COMPÊNDIO · ITEM</div>
    <h1>{item.nome}</h1>
    <p className="muted">{item.en}</p>
    <DetalheItem item={item} onOpenContent={onOpenContent}/>
  </div>;
}
