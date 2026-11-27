/** Apresentação compartilhada das cartas do Compêndio: a mesma composição na janela de consulta e na página completa. */
import { Fragment, type ReactNode } from 'react';
import { ArrowLeft, Maximize2, X } from 'lucide-react';
import { useNaCarta } from './ConsultaCarta';
import './carta.css';

export type Fato = { k: string; rotulo: string; valor: ReactNode };

export function FatosCarta({ fatos }: { fatos: Fato[] }) {
  return fatos.length ? <dl className="carta-fatos">{fatos.map(f => <Fragment key={f.k}><div><dt>{f.rotulo}</dt><dd>{f.valor}</dd></div></Fragment>)}</dl> : null;
}

export function Carta({ trilha, topo, imagem, formato = 'retrato', nome, alcunha, linha, acoes, rotulo, children }: {
  trilha: string;
  /** Controles extras do cabeçalho (ex.: seletor Mestre/Jogador). */
  topo?: ReactNode;
  imagem?: ReactNode;
  /** `panorama` para locais; `simbolo` para organizações. */
  formato?: 'retrato' | 'panorama' | 'simbolo';
  nome: string; alcunha?: string | null; linha?: ReactNode; acoes?: ReactNode; rotulo?: string; children?: ReactNode;
}) {
  const janela = useNaCarta();
  return <article className="carta" aria-label={rotulo ?? `Detalhes de ${nome}`}>
    <header className="carta-topo">
      {janela?.voltar && <button type="button" className="carta-icone" aria-label="Voltar à carta anterior" title="Voltar" onClick={janela.voltar}><ArrowLeft size={15} aria-hidden="true"/></button>}
      <span className="carta-trilha">{trilha}</span>
      {topo}
      {janela && <>
        <button type="button" className="carta-icone" aria-label="Expandir para página completa" title="Expandir" onClick={janela.expandir}><Maximize2 size={14} aria-hidden="true"/></button>
        <button type="button" className="carta-icone" aria-label="Fechar consulta" title="Fechar" onClick={janela.fechar}><X size={16} aria-hidden="true"/></button>
      </>}
    </header>
    {imagem && <div className="carta-imagem" data-formato={formato}>{imagem}</div>}
    <h1 className="carta-nome">{nome}</h1>
    {alcunha && <p className="carta-alcunha">{alcunha}</p>}
    {linha && <p className="carta-linha">{linha}</p>}
    {acoes && <div className="carta-acoes">{acoes}</div>}
    {children && <div className="carta-corpo">{children}</div>}
  </article>;
}
