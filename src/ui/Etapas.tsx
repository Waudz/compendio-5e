// Navegação por etapas, compartilhada (criação, edição e subida de nível; reutilizável por outros sistemas): nomes das etapas, situação de
// cada uma, salto direto, progresso e Anterior/Próxima. A composição se adapta à largura do PAINEL: coluna de etapas, conteúdo e resumo
// quando há espaço; uma etapa por vez, com progresso compacto e navegação embaixo, quando não há.
import { AlertCircle, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import "./etapas.css";

export type EtapaInfo<T extends string = string> = { id: T; nome: string; /** Quantas escolhas faltam nesta etapa. */ pendencias?: number; concluida?: boolean };

export function Etapas<T extends string>({ etapas, atual, onIr, rotulo, sequencial = true, resumo, rodape, children }: {
  etapas: EtapaInfo<T>[]; atual: T; onIr: (id: T) => void; rotulo: string;
  /** Mostra Anterior/Próxima e o progresso (criação e subida de nível); na edição as categorias são independentes. */
  sequencial?: boolean; resumo?: ReactNode;
  /** Ação final, na última etapa. */ rodape?: ReactNode; children: ReactNode;
}) {
  const i = Math.max(0, etapas.findIndex(e => e.id === atual)), anterior = etapas[i - 1], proxima = etapas[i + 1];
  const conteudo = useRef<HTMLDivElement>(null), primeira = useRef(true);
  // ao trocar de etapa, o começo dela fica visível (na mesma rolagem do painel)
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    conteudo.current?.scrollIntoView?.({ block: "start" });
    conteudo.current?.focus({ preventScroll: true });
  }, [atual]);
  const marca = (e: EtapaInfo, n: number) => <span className={"etapa-marca" + (e.pendencias ? " pendente" : e.concluida ? " concluida" : "")} aria-hidden="true">{e.pendencias ? <AlertCircle size={13}/> : e.concluida ? <Check size={13}/> : n + 1}</span>;
  return <div className="etapas-raiz">
    <div className="etapas-grade" data-resumo={resumo ? "true" : undefined}>
      <nav className="etapas-nav" aria-label={rotulo}>
        <ol>{etapas.map((e, n) => <li key={e.id}><button type="button" className={e.id === atual ? "atual" : ""} aria-current={e.id === atual ? "step" : undefined} onClick={() => onIr(e.id)}>
          {marca(e, n)}<span className="etapa-nome">{e.nome}</span>{!!e.pendencias && <span className="sr-only">: {e.pendencias} pendência(s)</span>}</button></li>)}</ol>
        <div className="etapas-compacto">
          <label><span>{sequencial ? `Etapa ${i + 1} de ${etapas.length}` : "Categoria"}</span>
            <select aria-label={`${rotulo}: ir para`} value={atual} onChange={e => onIr(e.target.value as T)}>{etapas.map(e => <option key={e.id} value={e.id}>{e.nome}{e.pendencias ? ` (${e.pendencias} pendente)` : ""}</option>)}</select></label>
          {sequencial && <div className="etapas-progresso" role="progressbar" aria-label="Progresso" aria-valuemin={1} aria-valuemax={etapas.length} aria-valuenow={i + 1}><span style={{ width: `${((i + 1) / etapas.length) * 100}%` }}/></div>}
        </div>
      </nav>
      <div ref={conteudo} className="etapas-conteudo" tabIndex={-1} aria-label={etapas[i]?.nome} role="group">
        {children}
        {sequencial && <div className="etapas-passos">
          <button type="button" className="btn-secondary" disabled={!anterior} onClick={() => anterior && onIr(anterior.id)}><ChevronLeft size={15} aria-hidden="true"/> Anterior</button>
          {proxima ? <button type="button" className="btn-primary" onClick={() => onIr(proxima.id)}>Próxima <ChevronRight size={15} aria-hidden="true"/></button> : rodape}
        </div>}
      </div>
      {resumo && <aside className="etapas-resumo" aria-label="Resumo">{resumo}</aside>}
    </div>
  </div>;
}

/** Cartões de escolha única (raça, classe, origem): ícone, nome, resumo e seleção evidente. */
export function CartoesDeEscolha({ rotulo, opcoes, valor, onEscolher }: { rotulo: string; valor: string; onEscolher: (id: string) => void; opcoes: { id: string; nome: string; resumo: string; icone: ReactNode; selo?: string }[] }) {
  return <div className="escolha-cartoes" role="radiogroup" aria-label={rotulo}>{opcoes.map(o => {
    const marcado = o.id === valor;
    return <button key={o.id} type="button" role="radio" aria-checked={marcado} className={"escolha-cartao" + (marcado ? " marcado" : "")} onClick={() => onEscolher(o.id)}>
      <span className="escolha-icone" aria-hidden="true">{o.icone}</span>
      <span className="escolha-texto"><strong>{o.nome}</strong><small>{o.resumo}</small>{o.selo && <small className="escolha-selo">{o.selo}</small>}</span>
      {marcado && <span className="escolha-marcada" aria-hidden="true"><Check size={13}/></span>}
    </button>;
  })}</div>;
}
