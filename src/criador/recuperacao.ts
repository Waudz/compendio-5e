// Cópia de RECUPERAÇÃO local: quando um salvamento no servidor falha (rede, conflito, migração pendente), as alterações não enviadas ficam
// guardadas neste navegador para não se perderem se a aba for fechada ou a página recarregada. Apagada quando o salvamento dá certo, no
// descarte explícito e no logout (a chave contém `:<usuário>:`). Higiene contra perda de dados, NÃO persistência nem segurança.
import { lerPersonagemGuiado, SCHEMA_PERSONAGEM_GUIADO } from "./armazenamento";
import type { EstadoPersonagem } from "./repositorio";

export type Recuperacao = { estado: EstadoPersonagem; baseRevisao: number | null; motivo: string; em: string };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const seguro = (): Store | null => { try { return localStorage; } catch { return null; } };
const ID = /^[\w-]{1,64}$/;
const chave = (user: string, campaign: string, id: string) => {
  if (![user, campaign, id].every(x => ID.test(x))) throw new Error("Identificador inválido para a recuperação.");
  return `compendio5e:experimental:criador-recuperacao:v1:${user}:${campaign}:${id}`;
};

export function gravarRecuperacao(user: string, campaign: string, id: string, r: Recuperacao, store: Store | null = seguro()): boolean {
  try { if (!store) return false; store.setItem(chave(user, campaign, id), JSON.stringify({ ...r, personagem: { schemaVersion: SCHEMA_PERSONAGEM_GUIADO, draft: r.estado.draft, identity: r.estado.identity, savedAt: r.em } })); return true; }
  catch { return false; }   // sem armazenamento: o aviso na tela continua dizendo que as alterações não foram salvas
}
export function lerRecuperacao(user: string, campaign: string, id: string, store: Store | null = seguro()): Recuperacao | null {
  try {
    const raw = store?.getItem(chave(user, campaign, id)); if (!raw) return null;
    const w = JSON.parse(raw) as { baseRevisao?: unknown; motivo?: unknown; em?: unknown; personagem?: unknown };
    const p = lerPersonagemGuiado(JSON.stringify(w.personagem));
    return { estado: { draft: p.draft, identity: p.identity }, baseRevisao: Number.isInteger(w.baseRevisao) ? (w.baseRevisao as number) : null, motivo: typeof w.motivo === "string" ? w.motivo : "", em: typeof w.em === "string" ? w.em : p.savedAt };
  } catch { return null; }   // cópia ilegível não é restaurada (nem derruba a tela)
}
export function limparRecuperacao(user: string, campaign: string, id: string, store: Store | null = seguro()) { try { store?.removeItem(chave(user, campaign, id)); } catch { /* ignora */ } }

/** Aba de personagem NOVO (`criador:novo-<uuid>`): depois do primeiro salvamento o id passa a ser o do servidor. Guardamos o vínculo para a aba
 * reabrir o mesmo personagem depois de recarregar (em vez de parecer inexistente ou criar um duplicado). Apagado no logout (contém `:<usuário>:`). */
const chaveMapa = (user: string, campaign: string, tab: string) => {
  if (![user, campaign, tab].every(x => ID.test(x))) throw new Error("Identificador inválido.");
  return `compendio5e:experimental:criador-aba:v1:${user}:${campaign}:${tab}`;
};
export const ehPersonagemNovo = (tab: string) => tab.startsWith("novo-");
export function gravarMapaAba(user: string, campaign: string, tab: string, idServidor: string, store: Store | null = seguro()) { try { store?.setItem(chaveMapa(user, campaign, tab), idServidor); } catch { /* sem armazenamento */ } }
export function lerMapaAba(user: string, campaign: string, tab: string, store: Store | null = seguro()): string | null {
  try { const v = store?.getItem(chaveMapa(user, campaign, tab)); return v && ID.test(v) ? v : null; } catch { return null; }
}
