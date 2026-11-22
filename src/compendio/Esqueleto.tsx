// Esqueletos de carregamento do Compêndio: aparecem enquanto o pedaço de dados de uma categoria baixa. Decorativos (aria-hidden); o estado é anunciado por texto.
export function EsqueletoLista({ rotulo, visao }: { rotulo: string; visao: "lista" | "grade" }) {
  return <div aria-busy="true" data-testid="compendio-esqueleto">
    <p role="status" className="sr-only">Carregando {rotulo.toLocaleLowerCase("pt-BR")}…</p>
    <ul className={`compendio-lista ${visao}`} aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <li key={i}><div className="cat-esq-cartao"><span className="cat-esq cat-esq-titulo"/><span className="cat-esq cat-esq-sub"/></div></li>)}</ul>
  </div>;
}
export function EsqueletoDetalhe() {
  return <div aria-busy="true" data-testid="detalhe-esqueleto"><p role="status" className="sr-only">Carregando detalhes…</p>
    <div aria-hidden="true"><span className="cat-esq cat-esq-titulo"/><span className="cat-esq cat-esq-sub"/><span className="cat-esq cat-esq-bloco"/><span className="cat-esq cat-esq-bloco"/></div></div>;
}
