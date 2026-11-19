// Estado de salvamento mostrado ao usuário: Salvo, Salvando, Pendente de sincronização, Offline, Conflito (+ aviso de espaço).
import { AlertTriangle, CheckCircle2, CloudOff, Loader2, RefreshCw } from "lucide-react";
import type { Draft, Usage } from "./types";

export type SyncState = "saved" | "saving" | "pending" | "offline" | "conflict";
export const SYNC_LABEL: Record<SyncState, string> = { saved: "Salvo", saving: "Salvando…", pending: "Pendente de sincronização", offline: "Offline", conflict: "Conflito" };
export const SYNC_HELP: Record<SyncState, string> = {
  saved: "Tudo salvo no servidor.",
  saving: "Enviando as alterações ao servidor.",
  pending: "As alterações estão guardadas neste aparelho e ainda não foram enviadas ao servidor.",
  offline: "Sem conexão. As alterações ficam guardadas neste aparelho e serão enviadas quando voltar.",
  conflict: "O servidor tem uma versão mais nova. Nada foi sobrescrito: escolha manter a sua, usar a do servidor ou salvar como cópia.",
};

/** Prioridade: conflito > salvando > offline (com ou sem pendência) > pendente > salvo. */
export function deriveSyncState(a: { draft?: Pick<Draft, "status">; online: boolean; inflight?: boolean }): SyncState {
  if (a.draft?.status === "conflict") return "conflict";
  if (a.inflight) return "saving";
  if (!a.online) return "offline";
  if (a.draft?.status === "pending") return "pending";
  return "saved";
}

export function usageMessage(u: Usage): string | null {
  if (!u.persistent) return "Armazenamento local indisponível (navegação privada ou bloqueio): os rascunhos só duram até fechar esta aba.";
  if (u.level === "cheio") return "Armazenamento local cheio. Nada foi descartado: exporte os rascunhos pendentes e libere espaço.";
  if (u.level === "aviso") return `Armazenamento local quase cheio (${Math.round(u.ratio * 100)}% do limite). Exporte os rascunhos pendentes se precisar.`;
  return null;
}

const ICON = { saved: CheckCircle2, saving: Loader2, pending: RefreshCw, offline: CloudOff, conflict: AlertTriangle } as const;
export function SyncStatus({ state, usage }: { state: SyncState; usage?: Usage }) {
  const Icon = ICON[state], aviso = usage ? usageMessage(usage) : null;
  return <span className={`sync-status sync-${state}`}>
    <span role="status" title={SYNC_HELP[state]}><Icon size={14} aria-hidden="true"/> {SYNC_LABEL[state]}</span>
    {aviso && <span role="alert" className="sync-warning">{aviso}</span>}
  </span>;
}
