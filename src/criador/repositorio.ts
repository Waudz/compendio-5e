// Repositório do personagem guiado: a interface do criador fala com este contrato e não sabe onde os dados ficam.
//   - `servidor`: Supabase (ficha privada em `character_sheets` + identidade pública em `notes`), com revisão otimista. Persistência REAL
//     (usa a migração 0008 existente; status remoto documentado em CRIADOR-2014-EXPANSAO.md).
//   - `local-experimental`: `localStorage` (ver armazenamento.ts). Só para demonstração/offline e para rascunhos antigos; não é segurança.
import type { FichasApi } from "../fichas";
import { ehConflitoDeRevisao } from "../fichas";
import type { CharacterDraft } from "../rules/character-domain";
import { defaultPublicIdentity, type PublicIdentity, type SheetPublicSource } from "../rules/public-identity";
import { SCHEMA_PERSONAGEM_GUIADO, type ArmazenamentoCriador } from "./armazenamento";

export type EstadoPersonagem = { draft: CharacterDraft; identity: PublicIdentity };
export type PersonagemCarregado = EstadoPersonagem & {
  id: string;
  /** Revisão do servidor (null no armazenamento local). */
  revision: number | null;
  /** true quando quem abre NÃO é o dono (mestre): edita a ficha, mas a identidade pública não é dele nem é lida. */
  somenteFicha: boolean;
  /** Ficha de um NPC do Compêndio: sem identidade pública própria e fora do ciclo de vida dos aventureiros. */
  npc?: boolean;
};
export type ArgsSalvar = { id: string; existe: boolean; revisao: number | null; estado: EstadoPersonagem; somenteFicha: boolean; source: SheetPublicSource };

/** Outra gravação aconteceu antes (revisão diferente): nada foi sobrescrito. */
export class ErroConflito extends Error { constructor(m: string) { super(m); this.name = "ErroConflito"; } }

export interface RepositorioPersonagem {
  readonly tipo: "servidor" | "local-experimental";
  /** `null` se não existir (ou sem permissão); lança `Error` com mensagem em português em falha (rede, dado corrompido). */
  carregar(id: string): Promise<PersonagemCarregado | null>;
  salvar(a: ArgsSalvar): Promise<{ id: string; revision: number | null }>;
}

export function repositorioServidor(api: FichasApi, campaignId: string, userId: string): RepositorioPersonagem {
  return {
    tipo: "servidor",
    async carregar(id) {
      const r = await api.carregar(id);
      if (!r.ok) throw new Error(r.error);
      if (!r.data) return null;
      const { ficha, identidade } = r.data;
      if (ficha.campaignId !== campaignId) return null; // nunca abrir uma ficha na campanha errada, mesmo com acesso às duas
      return { id: ficha.id, draft: ficha.draft, identity: identidade?.identity ?? defaultPublicIdentity(), revision: ficha.revision, somenteFicha: !!ficha.npc || ficha.ownerId !== userId, ...(ficha.npc ? { npc: true } : {}) };
    },
    async salvar(a) {
      const ident = a.somenteFicha ? undefined : { identity: a.estado.identity, source: a.source };
      // os nomes em português de raça e classe vão na ficha: o servidor os usa para refazer a apresentação quando o mestre salva
      const draft = { ...a.estado.draft, publicLabels: { race: a.source.race, characterClass: a.source.characterClass } };
      const r = a.existe ? await api.salvar(a.id, a.revisao ?? 0, draft, ident) : await api.criar(campaignId, draft, { identity: a.estado.identity, source: a.source });
      if (!r.ok) throw ehConflitoDeRevisao(r) ? new ErroConflito(r.error) : new Error(r.error);
      return { id: r.data.id, revision: r.data.revision };
    },
  };
}

export function repositorioLocal(store: ArmazenamentoCriador): RepositorioPersonagem {
  return {
    tipo: "local-experimental",
    async carregar(id) {
      const p = store.carregar(id);
      return p ? { id, draft: p.draft, identity: p.identity, revision: null, somenteFicha: false } : null;
    },
    async salvar(a) {
      store.salvar({ schemaVersion: SCHEMA_PERSONAGEM_GUIADO, draft: a.estado.draft, identity: a.estado.identity, savedAt: new Date().toISOString() });
      return { id: a.id, revision: null };
    },
  };
}
