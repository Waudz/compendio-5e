// Proteção local de rascunhos (infraestrutura). Ainda NÃO está ligada ao aplicativo nem ao Supabase.
export { openBackend, openIdbBackend, memoryBackend } from "./backend";
export { createDraftStore, containsSecret, PERSONAL, type DraftStore } from "./store";
export { flushPending, type SyncAdapter, type PushResult, type FlushSummary } from "./sync";
export { SyncStatus, deriveSyncState, usageMessage, SYNC_LABEL, SYNC_HELP, type SyncState } from "./status";
export { downloadPending, exportFileName } from "./exportar";
export { DEFAULT_LIMITS, DRAFT_KINDS, DraftStorageError, type Draft, type DraftBackend, type DraftInput, type DraftKind, type DraftStatus, type Limits, type SaveResult, type Usage } from "./types";
