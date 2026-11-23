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
  return <div className="content"><h1>Compêndio</h1>
    {loading ? <p role="status">Verificando sua campanha…</p>
      : error ? <Aviso erro t="Não foi possível verificar sua campanha. Tente novamente para consultar o Compêndio." onRetry={() => void refresh()}/>
      : <><p>Escolha ou entre em uma campanha para consultar o Compêndio.</p>
        <button className="btn-primary" onClick={() => onOpenContent({ kind: "secao", ref: "campanhas" })}>Escolher campanha</button></>}
  </div>;
}

export function CompendioPanel({ onOpenContent }: { onOpenContent: (s: TabSpec) => void }) {
  const unavailable = useCatalogueCampaign(onOpenContent);
  return unavailable ?? <CompendioCatalogo onOpenContent={onOpenContent}/>;
}

/** Aba `item:<id>`: definição completa do item. Também é o destino de "Consultar no Compêndio" no inventário. */
export function ItemPagina({ id, onOpenContent }: { id: string; onOpenContent: (s: TabSpec) => void }) {
  const unavailable = useCatalogueCampaign(onOpenContent);
  if (unavailable) return unavailable;
  const item = srdItem(id);
  if (!item) return <div className="content"><h1>Item</h1><Aviso erro t="Item não encontrado no catálogo desta revisão. O identificador pode ser antigo ou inválido."/></div>;
  return <div className="content item-pagina">
    <div className="eyebrow">COMPÊNDIO · ITEM</div>
    <h1>{item.nome}</h1>
    <p className="muted">{item.en}</p>
    <DetalheItem item={item} onOpenContent={onOpenContent}/>
  </div>;
}
