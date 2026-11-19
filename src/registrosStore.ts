// Aviso simples de "registros mudaram" para as telas abertas (ex.: Início atualiza a prévia do Diário ao salvar/publicar).
import { useSyncExternalStore } from "react";
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
