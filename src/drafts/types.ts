// Rascunhos locais (proteção contra perda de anotações). O Supabase continua sendo a fonte principal: aqui só entram RASCUNHOS e
// alterações pendentes de itens que o usuário está editando. Nada de cópia do banco.
export type DraftKind = "note" | "entry" | "task";
export const DRAFT_KINDS: readonly DraftKind[] = ["note", "entry", "task"];
/** `pending`: alterações locais ainda não confirmadas pelo servidor · `conflict`: o servidor mudou desde a base do rascunho · `synced`: já salvo (recuperável). */
export type DraftStatus = "pending" | "conflict" | "synced";

export type Draft = {
  key: string;                    // `${userId}|${campaignId}|${kind}|${entityId}`
  scope: string;                  // `${userId}|${campaignId}` (índice: isolamento por usuário e campanha)
  userId: string;
  campaignId: string;             // "_pessoal" para itens sem campanha
  kind: DraftKind;
  entityId: string;               // id do item no servidor (ou id temporário de item novo)
  title?: string;
  content: unknown;               // JSON (blocos, texto): nunca HTML canônico
  baseVersion: number | null;     // versão do servidor em que o rascunho se baseia (null = item novo, ainda não existe)
  status: DraftStatus;
  serverVersionSeen?: number;     // versão do servidor vista quando o conflito foi detectado
  createdAt: number; updatedAt: number; syncedAt?: number;
  bytes: number;                  // tamanho serializado (para limites e aviso de espaço)
};

export type DraftInput = { kind: DraftKind; entityId: string; content: unknown; title?: string; baseVersion?: number | null };

/** Limites configuráveis. Valores iniciais conservadores: pensados para texto de planejamento, não para cópia de dados. */
export type Limits = {
  maxTotalBytes: number;          // todos os rascunhos deste navegador (todas as contas)
  maxBytesPerDraft: number;       // um rascunho (conteúdo estruturado do servidor tem teto de 500 000 bytes)
  maxDrafts: number;              // quantidade total
  warnRatio: number;              // a partir daqui, avisa (0..1)
  syncedRetentionDays: number;    // só rascunhos JÁ SALVOS (recuperáveis) são limpos, e só depois deste prazo
};
export const DEFAULT_LIMITS: Limits = { maxTotalBytes: 20 * 1024 * 1024, maxBytesPerDraft: 600_000, maxDrafts: 300, warnRatio: 0.8, syncedRetentionDays: 7 };

export type SaveResult =
  | { ok: true; draft: Draft; usage: Usage }
  | { ok: false; reason: "invalido" | "segredo" | "rascunho_grande" | "limite" | "quota" | "armazenamento"; message: string };

export type UsageLevel = "ok" | "aviso" | "cheio";
export type Usage = {
  count: number; pendingCount: number; conflictCount: number; syncedCount: number;
  bytes: number; limitBytes: number; ratio: number; level: UsageLevel;
  persistent: boolean;            // false: IndexedDB indisponível (ex.: navegação privada): os rascunhos só vivem na memória desta aba
  browser?: { usage: number; quota: number };   // estimativa do navegador (navigator.storage.estimate), quando existir
};

/** Armazenamento por trás da API; IndexedDB em produção, memória em testes ou quando o IndexedDB não está disponível. */
export interface DraftBackend {
  readonly persistent: boolean;
  get(key: string): Promise<Draft | undefined>;
  put(d: Draft): Promise<void>;
  delete(key: string): Promise<void>;
  listScope(scope: string): Promise<Draft[]>;
  /** Somente metadados de tamanho/estado (para o limite global); não expõe conteúdo de outras contas. */
  meta(): Promise<{ key: string; scope: string; bytes: number; status: DraftStatus }[]>;
  deleteScope(scope: string): Promise<number>;
}

export class DraftStorageError extends Error {
  constructor(public code: "quota" | "indisponivel" | "bloqueado" | "erro", message: string) { super(message); this.name = "DraftStorageError"; }
}
