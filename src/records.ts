/** Contratos puros da fundação. Não acessam rede, banco ou armazenamento. */
export type RecordKind = "character" | "monster" | "spell" | "item" | "note" | "npc" | "location" | "encounter";
export type RecordScope =
  | { kind: "universal" }
  | { kind: "personal"; ownerId: string }
  | { kind: "campaign"; campaignId: string };
export type RecordRef = { id: string; kind: RecordKind };
export type RecordMetadata = RecordRef & {
  scope: RecordScope;
  title: string;
  version: number;
  updatedAt: string;
};
export type RecordLink = { source: RecordRef; target: RecordRef; relation: "reference" | "related" };
export type RecordAccess = {
  userId: string | null;
  campaignIds: ReadonlySet<string>;
};
/** Filtro de apresentação apenas: autorização real sempre no servidor/RLS. */
export function canDiscoverRecord(record: RecordMetadata, access: RecordAccess): boolean {
  if (!access.userId) return false;
  if (record.scope.kind === "universal") return true;
  if (record.scope.kind === "personal") return record.scope.ownerId === access.userId;
  return access.campaignIds.has(record.scope.campaignId);
}
export function visibleLinks(
  links: readonly RecordLink[],
  visibleRecordKeys: ReadonlySet<string>,
): RecordLink[] {
  return links.filter(link =>
    visibleRecordKeys.has(recordKey(link.source)) && visibleRecordKeys.has(recordKey(link.target)),
  );
}
export function recordKey(ref: RecordRef): string {
  return `${ref.kind}:${ref.id}`;
}
/** Política de concorrência otimista; não realiza gravações. */
export type VersionDecision = "apply" | "conflict";
export function decideVersion(expected: number, current: number): VersionDecision {
  if (!Number.isSafeInteger(expected) || !Number.isSafeInteger(current) || expected < 0 || current < 0) return "conflict";
  return expected === current ? "apply" : "conflict";
}
export type PendingOperation = {
  operationId: string;
  actorId: string;
  record: RecordRef;
  expectedVersion: number;
  createdAt: string;
  action: "create" | "update" | "delete";
};
