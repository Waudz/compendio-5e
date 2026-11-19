import { describe, expect, it } from "vitest";
import { canDiscoverRecord, decideVersion, recordKey, visibleLinks, type RecordMetadata } from "./records";
const base = { id: "a", kind: "monster" as const, title: "Goblin", version: 1, updatedAt: "2026-11-19T00:00:00Z" };
describe("contratos de registros", () => {
  it("exige login inclusive para conteúdo universal", () => {
    const universal: RecordMetadata = { ...base, scope: { kind: "universal" } };
    expect(canDiscoverRecord(universal, { userId: null, campaignIds: new Set() })).toBe(false);
    expect(canDiscoverRecord(universal, { userId: "jogador", campaignIds: new Set() })).toBe(true);
  });
  it("isola bibliotecas pessoais e campanhas", () => {
    const personal: RecordMetadata = { ...base, scope: { kind: "personal", ownerId: "u1" } };
    const campaign: RecordMetadata = { ...base, scope: { kind: "campaign", campaignId: "c1" } };
    expect(canDiscoverRecord(personal, { userId: "u2", campaignIds: new Set(["c1"]) })).toBe(false);
    expect(canDiscoverRecord(personal, { userId: "u1", campaignIds: new Set() })).toBe(true);
    expect(canDiscoverRecord(campaign, { userId: "u1", campaignIds: new Set() })).toBe(false);
    expect(canDiscoverRecord(campaign, { userId: "u2", campaignIds: new Set(["c1"]) })).toBe(true);
  });
  it("não revela backlinks para registros não visíveis", () => {
    const a = { kind: "note" as const, id: "secret" };
    const b = { kind: "monster" as const, id: "goblin" };
    const links = [{ source: a, target: b, relation: "reference" as const }];
    expect(visibleLinks(links, new Set([recordKey(b)]))).toEqual([]);
    expect(visibleLinks(links, new Set([recordKey(a), recordKey(b)]))).toEqual(links);
  });
  it("rejeita versões divergentes e inválidas", () => {
    expect(decideVersion(3, 3)).toBe("apply");
    expect(decideVersion(2, 3)).toBe("conflict");
    expect(decideVersion(-1, -1)).toBe("conflict");
    expect(decideVersion(Number.NaN, 1)).toBe("conflict");
  });
});
