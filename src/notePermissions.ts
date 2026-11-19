/** Contratos de visibilidade de notas. O banco/RLS é a autoridade final. */
export type NoteVisibility = "private" | "master" | "campaign" | "selected";
export type NotePermission = {
  ownerId: string;
  campaignId: string | null;
  visibility: NoteVisibility;
  allowedUserIds: readonly string[];
};
export type NoteViewer = {
  userId: string | null;
  campaignId: string | null;
  isCampaignMaster: boolean;
  isCampaignMember: boolean;
};
/** Predicado somente para renderização; jamais utilizar como autorização de API. */
export function canReadNote(note: NotePermission, viewer: NoteViewer): boolean {
  if (!viewer.userId) return false;
  if (viewer.userId === note.ownerId) return true;
  if (!note.campaignId || note.campaignId !== viewer.campaignId || !viewer.isCampaignMember) return false;
  if (note.visibility === "private") return false;
  if (note.visibility === "master") return viewer.isCampaignMaster;
  if (note.visibility === "campaign") return true;
  return note.allowedUserIds.includes(viewer.userId);
}
/** O mestre gerencia compartilhamento, mas não ganha acesso automático a notas privadas de outro autor. */
export function canEditNote(note: NotePermission, viewer: NoteViewer): boolean {
  return viewer.userId !== null && viewer.userId === note.ownerId;
}
