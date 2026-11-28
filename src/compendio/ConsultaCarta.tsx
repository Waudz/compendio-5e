/** Consulta em carta (desktop): janela sobre o conteúdo da própria aba, centralizada no grupo. A página de baixo continua
 *  montada, então filtros e rolagem ficam como estavam. No celular não há hospedeiro: o mesmo conteúdo abre como página. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TabSpec } from '../workspace';
import { ArrowLeft, Maximize2, X } from 'lucide-react';
import { estaVisivel, registrarVoltar } from '../voltarInterno';
import './carta.css';

export type NaCarta = { fechar: () => void; expandir: () => void; voltar?: () => void };
export const NaCartaContext = createContext<NaCarta | null>(null);
export const AbrirCartaContext = createContext<((s: TabSpec) => void) | null>(null);
export const useNaCarta = () => useContext(NaCartaContext);

/** Ficha de criatura (do Bestiário ou de um NPC): ocupa a janela de consulta com barra própria. */
export const ehFichaDeCriatura = (s: TabSpec) => s.kind === 'npc' || s.kind === 'monstro' || (s.kind === 'item' && s.ref.startsWith('monstro:'));
/** Destinos de consulta: abrem no pop-up. A própria ficha de personagem, categorias e editores continuam sendo navegação. */
export const ehConsulta = (s: TabSpec) => ['registro', 'identidade', 'magia', 'regra', 'npc', 'monstro', 'item'].includes(s.kind);

/** Clique normal em um registro: abre a carta quando há hospedeiro; senão navega na própria aba. */
export function useAbrirConsulta(onOpenContent: (s: TabSpec) => void) {
  const abrir = useContext(AbrirCartaContext);
  return useCallback((s: TabSpec) => { if (abrir && ehConsulta(s)) abrir(s); else onOpenContent(s); }, [abrir, onOpenContent]);
}

export function CartaHost({ children, onOpenContent, renderizar }: {
  children: ReactNode;
  /** Navegação da aba que hospeda a carta. */
  onOpenContent: (s: TabSpec) => void;
  renderizar: (s: TabSpec, onOpenContent: (s: TabSpec) => void) => ReactNode;
}) {
  const [pilha, setPilha] = useState<TabSpec[]>([]);
  const topo = pilha[pilha.length - 1];
  const caixa = useRef<HTMLDivElement>(null), origem = useRef<HTMLElement | null>(null);
  const fechar = useCallback(() => setPilha([]), []);
  const abrir = useCallback((s: TabSpec) => {
    origem.current = document.activeElement as HTMLElement | null;
    setPilha([s]);
  }, []);
  /** Dentro da carta: outra consulta empilha; o resto fecha a carta e navega na aba. Voltar ao índice só fecha. */
  const navegar = useCallback((s: TabSpec) => {
    if (ehConsulta(s)) { setPilha(p => [...p, s]); return; }
    setPilha([]);
    if (!(s.kind === 'secao' && s.ref === 'compendio')) onOpenContent(s);
  }, [onOpenContent]);
  const aberta = !!topo, chave = topo ? `${topo.kind}:${topo.ref}` : '';
  useEffect(() => { if (chave) { caixa.current?.focus(); if (caixa.current) caixa.current.scrollTop = 0; } }, [chave]);
  // Voltar do navegador com a carta aberta só fecha a carta: a página de baixo fica onde estava.
  useEffect(() => {
    if (!aberta) return;
    return registrarVoltar(() => {
      if (!estaVisivel(caixa.current)) return false;
      setPilha([]);
      setTimeout(() => window.history.go(1), 0);
      return true;
    });
  }, [aberta]);
  const estava = useRef(false);
  useEffect(() => { if (estava.current && !aberta) origem.current?.focus?.({ preventScroll: true }); estava.current = aberta; }, [aberta]);
  const controles = useMemo<NaCarta | null>(() => topo ? {
    fechar,
    expandir: () => { setPilha([]); onOpenContent(topo); },
    voltar: pilha.length > 1 ? () => setPilha(p => p.slice(0, -1)) : undefined,
  } : null, [topo, pilha.length, fechar, onOpenContent]);
  return <div className="carta-host">
    <AbrirCartaContext.Provider value={abrir}>
      <div className="carta-fundo-conteudo" {...(aberta ? ({ inert: "" } as object) : {})}>{children}</div>
    </AbrirCartaContext.Provider>
    {topo && <div className="carta-camada" onPointerDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={caixa} className={ehFichaDeCriatura(topo) ? 'carta-janela carta-janela-ficha' : 'carta-janela'} role="dialog" aria-label="Consulta do Compêndio" tabIndex={-1}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } }}>
        {ehFichaDeCriatura(topo) && controles && <div className="carta-barra">
          {controles.voltar && <button type="button" className="carta-icone" aria-label="Voltar à consulta anterior" title="Voltar" onClick={controles.voltar}><ArrowLeft size={16}/></button>}
          <span className="carta-barra-titulo">{topo.title}</span>
          <button type="button" className="carta-icone" aria-label="Maximizar" title="Abrir como página" onClick={controles.expandir}><Maximize2 size={15}/></button>
          <button type="button" className="carta-icone" aria-label="Fechar consulta" title="Fechar" onClick={controles.fechar}><X size={16}/></button>
        </div>}
        {/* a ficha usa só a barra acima: a carta narrativa dentro dela não repete os controles */}
        <NaCartaContext.Provider value={ehFichaDeCriatura(topo) ? null : controles}>
          <AbrirCartaContext.Provider value={navegar}>
            <div key={chave}>{renderizar(topo, navegar)}</div>
          </AbrirCartaContext.Provider>
        </NaCartaContext.Provider>
      </div>
    </div>}
  </div>;
}
