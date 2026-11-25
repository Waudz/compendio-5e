/** Armazenamento do criador guiado — ADAPTADOR EXPERIMENTAL em localStorage.
 *
 * NÃO é persistência real e NÃO é segurança entre usuários: os dados ficam neste navegador, sem sincronizar entre
 * aparelhos e legíveis por quem usa o mesmo navegador. As chaves são separadas por usuário e campanha e entram na
 * limpeza do logout (`clearUserLocalData`), mas isso é higiene, não controle de acesso. A persistência real depende
 * da API de fichas e da migração 0008 existente (status remoto em `docs/CRIADOR-2014-EXPANSAO.md`).
 * A interface `ArmazenamentoCriador` é o ponto de troca: o adaptador do servidor implementará o mesmo contrato.
 */
import type { CharacterDraft } from '../rules/character-domain';
import { defaultPublicIdentity, isPublicIdentity, type PublicIdentity } from '../rules/public-identity';

export const SCHEMA_PERSONAGEM_GUIADO = 1;
export type PersonagemGuiado = { schemaVersion: typeof SCHEMA_PERSONAGEM_GUIADO; draft: CharacterDraft; identity: PublicIdentity; savedAt: string };
export type ResumoPersonagemGuiado = { id: string; nome: string; nivel: number; classId?: string; atualizadoEm: string };

export interface ArmazenamentoCriador {
  /** Sempre `true` neste adaptador: a interface mostra o aviso de armazenamento experimental. */
  readonly experimental: boolean;
  listar(): ResumoPersonagemGuiado[];
  /** `null` se não existir; lança `Error` se o dado estiver corrompido (a interface oferece descartar). */
  carregar(id: string): PersonagemGuiado | null;
  salvar(personagem: PersonagemGuiado): void;
  excluir(id: string): void;
}

type Store = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const ATRIBUTOS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ID = /^[\w-]{1,64}$/;

function rascunhoValido(v: unknown): v is CharacterDraft {
  if (!isRecord(v) || !Array.isArray(v.decisions) || !Array.isArray(v.inventory) || !isRecord(v.baseAbilities) || !isRecord(v.spentResources)) return false;
  if (typeof v.name !== 'string' || typeof v.id !== 'string' || !ID.test(v.id) || !Number.isInteger(v.level)) return false;
  const base = v.baseAbilities;
  return ATRIBUTOS.every(k => Number.isInteger(base[k]) && Number(base[k]) >= 1 && Number(base[k]) <= 30)
    && v.decisions.every(x => isRecord(x) && typeof x.id === 'string' && Array.isArray(x.optionIds) && x.optionIds.every(i => typeof i === 'string'))
    && v.inventory.every(x => isRecord(x) && typeof x.id === 'string' && typeof x.itemId === 'string' && Number.isInteger(x.quantity) && Number(x.quantity) >= 1
      && typeof x.equipped === 'boolean' && (x.origin === 'starting' || x.origin === 'acquired'));
}
/** Valida (sem consertar) um registro lido do armazenamento. */
export function lerPersonagemGuiado(raw: string): PersonagemGuiado {
  const v: unknown = JSON.parse(raw);
  if (!isRecord(v) || v.schemaVersion !== SCHEMA_PERSONAGEM_GUIADO || !rascunhoValido(v.draft) || typeof v.savedAt !== 'string') throw new Error('Registro do personagem inválido ou de versão desconhecida.');
  return { schemaVersion: SCHEMA_PERSONAGEM_GUIADO, draft: v.draft, identity: isPublicIdentity(v.identity) ? v.identity : defaultPublicIdentity(), savedAt: v.savedAt };
}

const seguro = (): Store | null => { try { return localStorage; } catch { return null; } };

/** Chave: `compendio5e:experimental:criador:v1:<usuário>:<campanha>:<personagem>`; contém `:<usuário>:` e por isso é apagada no logout. */
export function armazenamentoLocalExperimental(userId: string, campaignId: string, store: Store | null = seguro()): ArmazenamentoCriador {
  if (!ID.test(userId) || !ID.test(campaignId)) throw new Error('Usuário ou campanha inválidos para o armazenamento do criador.');
  const prefixo = `compendio5e:experimental:criador:v${SCHEMA_PERSONAGEM_GUIADO}:${userId}:${campaignId}:`;
  const chave = (id: string) => { if (!ID.test(id)) throw new Error('Identificador de personagem inválido.'); return prefixo + id; };
  const chaves = () => { const out: string[] = []; if (store) for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k?.startsWith(prefixo)) out.push(k); } return out; };
  return {
    experimental: true,
    listar() {
      const out: ResumoPersonagemGuiado[] = [];
      for (const k of chaves()) { try { const p = lerPersonagemGuiado(store!.getItem(k) ?? ''); out.push({ id: p.draft.id, nome: p.draft.name.trim() || 'Sem nome', nivel: p.draft.level, ...(p.draft.catalogueVersion === 'character-srd-2014-v2' ? { classId: p.draft.classId } : {}), atualizadoEm: p.savedAt }); } catch { /* corrompido: não aparece na lista */ } }
      return out.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm) || a.nome.localeCompare(b.nome, 'pt-BR'));
    },
    carregar(id) { const raw = store?.getItem(chave(id)); return raw == null ? null : lerPersonagemGuiado(raw); },
    salvar(p) {
      if (!store) throw new Error('Este navegador não permite salvar dados locais.');
      if (!rascunhoValido(p.draft)) throw new Error('Personagem inválido: nada foi salvo.');
      store.setItem(chave(p.draft.id), JSON.stringify(p));
    },
    excluir(id) { store?.removeItem(chave(id)); },
  };
}
