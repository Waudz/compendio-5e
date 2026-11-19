// Aviso simples de "registros mudaram" para as telas abertas (ex.: Início atualiza a prévia do Diário ao salvar/publicar).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { dataSessao, ordenarDiario, publicado, type Registro, type RegistrosApi } from "./registros";
import type { EntradaDiario, FonteDiario } from "./inicio";
import type { Res, Role } from "./campaigns";

/** Títulos conhecidos dos registros abertos nesta sessão (só em memória): os layouts salvos guardam apenas ids, nunca títulos. */
const titulos = new Map<string, string>();
export const registrarTitulo = (id: string, titulo: string) => { if (titulos.get(id) !== titulo) { titulos.set(id, titulo); avisarRegistros(); } };
export const tituloDe = (id: string) => titulos.get(id);
let versao = 0; const ouvintes = new Set<() => void>();
export const avisarRegistros = () => { versao++; ouvintes.forEach(f => f()); };
export const useVersaoRegistros = () => useSyncExternalStore(f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => versao);

export const paraEntrada = (r: Registro): EntradaDiario => ({ id: r.id, titulo: r.title, dataSessao: dataSessao(r), publicada: publicado(r), atualizadaEm: r.updatedAt, conteudo: r.content });

/** Fonte do Início: o registro mais recente que o papel pode ver. Jogador: só publicados (a RLS já filtra; aqui é defesa extra). */
export const fonteDiario = (api: RegistrosApi): FonteDiario => ({
  maisRecente: async (campanhaId: string, papel: Role): Promise<Res<EntradaDiario | null>> => {
    const r = await api.list(campanhaId, "diary");
    if (!r.ok) return r;
    const visiveis = ordenarDiario(r.data).filter(x => papel === "mestre" || publicado(x));
    return { ok: true, data: visiveis[0] ? paraEntrada(visiveis[0]) : null };
  },
});

// ---------------------------------------------------------------- sincronização entre abas e grupos (mesmo navegador)
// Quem salva ou exclui PUBLICA o registro resultante; as telas abertas do mesmo registro (outro grupo, cartão do Planejamento, lista) recebem o dado
// pronto: sem nova requisição, sem F5, sem recriar abas. Cada editor tem uma origem para ignorar os próprios eventos. Não cruza navegadores nem aparelhos.
export type EventoRegistro = { id: string; registro: Registro | null; origem: string };
const ouvintesReg = new Set<(e: EventoRegistro) => void>();
let seqOrigem = 0;
export const novaOrigem = () => "o" + Date.now().toString(36) + (seqOrigem++).toString(36) + Math.random().toString(36).slice(2, 6);
export const publicarRegistro = (registro: Registro, origem: string) => {
  titulos.set(registro.id, registro.title);
  ouvintesReg.forEach(f => f({ id: registro.id, registro, origem }));
  avisarRegistros();   // listas e o Início recarregam uma vez
};
export const publicarExclusao = (id: string, origem: string) => { ouvintesReg.forEach(f => f({ id, registro: null, origem })); avisarRegistros(); };
/** Recebe os eventos de UM registro. O callback pode mudar a cada render. */
export function useAssinaturaRegistro(id: string, aoMudar: (e: EventoRegistro) => void) {
  const ref = useRef(aoMudar); ref.current = aoMudar;
  useEffect(() => { const f = (e: EventoRegistro) => { if (e.id === id) ref.current(e); }; ouvintesReg.add(f); return () => { ouvintesReg.delete(f); }; }, [id]);
}

export type Conflito = { registro: Registro | null };
/**
 * Mantém uma edição em dia com o que foi salvo em outro lugar. Sem alterações locais: aplica a versão nova na hora. Com alterações locais:
 * NÃO toca no que o usuário digitou e expõe um conflito para ele resolver ("usar a versão mais recente" ou "manter as minhas").
 */
export function useSincronia(o: { id: string; versao: number; sujo: boolean; origem: string; aoRemoto: (r: Registro) => void; aoExcluido: () => void; aoManter: (r: Registro) => void }) {
  const [conflito, setConflito] = useState<Conflito | null>(null);
  const est = useRef(o); est.current = o;
  useAssinaturaRegistro(o.id, e => {
    const x = est.current;
    if (e.origem === x.origem) return;
    if (e.registro && e.registro.version <= x.versao) return;   // já tenho essa versão (ou mais nova)
    if (!x.sujo) { setConflito(null); if (e.registro) x.aoRemoto(e.registro); else x.aoExcluido(); }
    else setConflito({ registro: e.registro });
  });
  useEffect(() => { if (!o.sujo) setConflito(null); }, [o.sujo]);   // salvou ou descartou: o aviso perde o sentido
  const usarRemoto = useCallback(() => { setConflito(c => { if (c) { if (c.registro) est.current.aoRemoto(c.registro); else est.current.aoExcluido(); } return null; }); }, []);
  const manterMinhas = useCallback(() => { setConflito(c => { if (c?.registro) est.current.aoManter(c.registro); return null; }); }, []);
  const descartarAviso = useCallback(() => setConflito(null), []);
  return { conflito, sinalizar: (r: Registro | null) => setConflito({ registro: r }), usarRemoto, manterMinhas, descartarAviso };
}
/** Recebe os eventos de TODOS os registros (ex.: o Planejamento acompanha os cartões que mostra). */
export function useAssinaturaGeral(aoMudar: (e: EventoRegistro) => void) {
  const ref = useRef(aoMudar); ref.current = aoMudar;
  useEffect(() => { const f = (e: EventoRegistro) => ref.current(e); ouvintesReg.add(f); return () => { ouvintesReg.delete(f); }; }, []);
}
