import { describe, expect, it } from "vitest";
import { canEditNote, canReadNote, type NotePermission, type NoteViewer } from "./notePermissions";
const note: NotePermission = { ownerId: "u1", campaignId: "c1", visibility: "campaign", allowedUserIds: [] };
const viewer: NoteViewer = { userId: "u2", campaignId: "c1", isCampaignMaster: false, isCampaignMember: true };
describe("visibilidade de notas (somente interface)", () => {
  it("bloqueia visitantes e não participantes", () => {
    expect(canReadNote(note, { ...viewer, userId: null })).toBe(false);
    expect(canReadNote(note, { ...viewer, isCampaignMember: false })).toBe(false);
    expect(canReadNote(note, { ...viewer, campaignId: "c2" })).toBe(false);
  });
  it("permite notas da campanha a participantes", () => expect(canReadNote(note, viewer)).toBe(true));
  it("preserva notas privadas mesmo contra mestre da campanha", () => {
    const privateNote = { ...note, visibility: "private" as const };
    expect(canReadNote(privateNote, { ...viewer, isCampaignMaster: true })).toBe(false);
    expect(canReadNote(privateNote, { ...viewer, userId: "u1" })).toBe(true);
  });
  it("restringe notas do mestre a mestres participantes", () => {
    const masterNote = { ...note, visibility: "master" as const };
    expect(canReadNote(masterNote, viewer)).toBe(false);
    expect(canReadNote(masterNote, { ...viewer, isCampaignMaster: true })).toBe(true);
  });
  it("permite seleção explícita somente dentro da campanha", () => {
    const selected = { ...note, visibility: "selected" as const, allowedUserIds: ["u2"] };
    expect(canReadNote(selected, viewer)).toBe(true);
    expect(canReadNote(selected, { ...viewer, isCampaignMember: false })).toBe(false);
    expect(canReadNote(selected, { ...viewer, userId: "u3" })).toBe(false);
  });
  it("somente autor edita; mestre não edita nota de outro", () => {
    expect(canEditNote(note, { ...viewer, isCampaignMaster: true })).toBe(false);
    expect(canEditNote(note, { ...viewer, userId: "u1" })).toBe(true);
  });
});
