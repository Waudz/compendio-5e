// Fila única do estado vital por API de fichas: a ficha e a iniciativa leem e operam pelo MESMO lugar. A fila vive fora das telas (trocar de
// aba não perde nada), envia uma operação por vez e na ordem, repete com o MESMO identificador quando a rede falha (o servidor ignora
// repetições) e a tela mostra o confirmado com as operações pendentes aplicadas por cima.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CharacterDraft } from "../rules/character-domain";
import type { FichasApi } from "../fichas";
import { aplicarAcao, novaOperacao, type AcaoVital, type EstadoVital, type Vitais } from "./vitais";

export type LinhaVital = EstadoVital & { draft: CharacterDraft };
type Pendente = { id: string; acao: AcaoVital; operacao: string };
export const ERRO_REDE = "Sem conexão com o servidor.";

export type LojaVitais = ReturnType<typeof criarLoja>;
export function criarLoja(api: FichasApi, atrasoBase = 1500) {
  const linhas = new Map<string, LinhaVital>(), ouvintes = new Set<() => void>();
  let fila: Pendente[] = [], enviando = false, erroEnvio: string | null = null, erroLeitura: string | null = null, versao = 0, tentativas = 0, timer: ReturnType<typeof setTimeout> | null = null;
  const avisar = () => { versao++; ouvintes.forEach(f => f()); };

  /** Aceita só o que não é mais antigo que o já conhecido (respostas e avisos podem chegar fora de ordem). */
  const receber = (e: EstadoVital, draft?: CharacterDraft) => {
    const atual = linhas.get(e.id);
    if (atual && (e.versao < atual.versao || (e.versao === atual.versao && e.revision < atual.revision))) return;
    const base = draft ?? atual?.draft;
    if (!base) return;
    linhas.set(e.id, { id: e.id, versao: e.versao, revision: e.revision, pv: e.pv, temp: e.temp, condicoes: e.condicoes, morte: e.morte, draft: base });
  };

  const ler = async (ids: readonly string[]) => {
    if (!ids.length) return;
    const r = await api.lerVitais([...ids]);
    if (!r.ok) { if (r.error !== erroLeitura) { erroLeitura = r.error; avisar(); } return; }
    for (const l of r.data) receber(l, l.draft);
    erroLeitura = null;
    avisar();
  };

  const drenar = async () => {
    if (enviando) return;
    enviando = true;
    try {
      while (fila.length) {
        const p = fila[0];
        const r = await api.alterarVitais(p.id, p.acao, p.operacao).catch(() => ({ ok: false as const, error: ERRO_REDE }));
        if (r.ok) { receber(r.data); fila = fila.slice(1); erroEnvio = null; tentativas = 0; avisar(); continue; }
        erroEnvio = r.error;
        if (r.error === ERRO_REDE) {
          avisar();
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => { timer = null; void drenar(); }, Math.min(20000, atrasoBase * 2 ** tentativas++));
          return;
        }
        fila = fila.slice(1); avisar();   // recusada pelo servidor: não insiste; a tela volta ao valor confirmado
        void ler([p.id]);
      }
    } finally { enviando = false; }
  };

  const aoSair = (e: BeforeUnloadEvent) => { if (fila.length) { e.preventDefault(); e.returnValue = ""; } };
  if (typeof window !== "undefined") window.addEventListener("beforeunload", aoSair);

  return {
    api,
    assinar: (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    instantaneo: () => versao,
    erro: () => erroEnvio ?? erroLeitura,
    pendentes: (id?: string) => fila.filter(p => !id || p.id === id).length,
    /** O que mostrar: o confirmado pelo servidor + as operações que ainda estão a caminho. */
    ver(id: string): LinhaVital | undefined {
      const l = linhas.get(id); if (!l) return undefined;
      const v = fila.filter(p => p.id === id).reduce<Vitais>((acc, p) => aplicarAcao(acc, p.acao), l);
      return { ...l, ...v };
    },
    enviar(id: string, acao: AcaoVital) { fila = [...fila, { id, acao, operacao: novaOperacao() }]; avisar(); void drenar(); },
    tentar() { tentativas = 0; if (timer) { clearTimeout(timer); timer = null; } void drenar(); },
    receber(e: EstadoVital, draft?: CharacterDraft) { receber(e, draft); avisar(); },
    ler,
  };
}

const lojas = new WeakMap<FichasApi, LojaVitais>();
export function lojaDeVitais(api: FichasApi): LojaVitais {
  let l = lojas.get(api);
  if (!l) { l = criarLoja(api); lojas.set(api, l); }
  return l;
}

/** Reserva do tempo real: se o aviso do servidor não chegar (rede, Realtime desligado), relê periodicamente enquanto a tela está visível. */
export const INTERVALO_LEITURA = 7000;

/** Acompanha o estado vital de um personagem (ficha) ou de vários (iniciativa), em tempo real. */
export function useVitais(api: FichasApi | null | undefined, ids: readonly string[], campaignId: string | null) {
  const loja = useMemo(() => (api ? lojaDeVitais(api) : null), [api]);
  const chave = [...new Set(ids)].sort().join("|");
  useSyncExternalStore(loja?.assinar ?? semAssinatura, loja?.instantaneo ?? zero);
  const [lido, setLido] = useState<string | null>(null);
  useEffect(() => {
    if (!loja || !chave || !campaignId) return;
    const lista = chave.split("|");
    let vivo = true;
    const ler = () => loja.ler(lista).then(() => { if (vivo) setLido(chave); }, () => {});
    const cancelar = loja.api.assinar(lista.length === 1 ? { characterId: lista[0] } : { campaignId }, () => void ler());
    void ler();
    const t = setInterval(() => { if (document.visibilityState !== "hidden") void ler(); }, INTERVALO_LEITURA);
    const aoVoltar = () => { if (document.visibilityState !== "hidden") { loja.tentar(); void ler(); } };
    window.addEventListener("focus", aoVoltar); window.addEventListener("online", aoVoltar); document.addEventListener("visibilitychange", aoVoltar);
    return () => { vivo = false; cancelar(); clearInterval(t); window.removeEventListener("focus", aoVoltar); window.removeEventListener("online", aoVoltar); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [loja, chave, campaignId]);
  return { loja, carregado: !chave || lido === chave, ver: (id: string) => loja?.ver(id), erro: loja?.erro() ?? null, pendentes: loja?.pendentes() ?? 0 };
}
const semAssinatura = () => () => {}, zero = () => 0;
