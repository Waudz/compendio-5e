// Ficha de EXEMPLO da demonstração (`?demo=jogador&fichas=1&exemplo=1`): serve para aprovar o visual sem montar um personagem. Dados
// fictícios, só no navegador, criados apenas quando ainda não há fichas de demonstração. Não entra no build oficial.
const item = (id: string, itemId: string, quantity = 1, equipped = false) => ({ id, itemId, quantity, equipped, origin: "acquired" });
const mago = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, ruleset: "5e-2014", catalogueVersion: "character-srd-2014-v2", baseAbilities: { str: 10, dex: 13, con: 13, int: 15, wis: 11, cha: 8 }, raceId: "human", backgroundId: "sage", classId: "wizard", level: 3,
  decisions: [{ id: "cantrips", optionIds: ["fire-bolt", "light", "mage-hand"] }, { id: "spells-known", optionIds: ["magic-missile", "shield", "mage-armor"] }, { id: "spells-prepared", optionIds: ["magic-missile", "shield"] }, { id: "spellbook-level-3", optionIds: ["misty-step"] }],
  currentHp: 18, temporaryHp: 0, spentResources: { "spell-slot-1": 2 }, currency: { cp: 12, sp: 35, gp: 80 }, inventory: [] as unknown[], ...extra,
});

export function semearFichaExemplo(campaignId: string, chaveFichas: string, chaveRegistros: string, registrosAtuais: unknown[]) {
  try {
    if (localStorage.getItem(chaveFichas)) return;
    const agora = new Date().toISOString(), real = { mode: "real" };
    const fichas = [
      mago("pj-caleb", "Caleb Hawke", { nickname: "O Corvo Cinzento",
        inventory: [item("a", "dagger", 1, true), item("b", "quarterstaff"), item("c", "potion-of-healing-common", 3), item("d", "leather-armor"), item("e", "wand-of-magic-missiles"), item("f", "ring-of-protection"), item("g", "backpack")],
        play: { favoritos: ["magia:fire-bolt", "magia:magic-missile"], defesas: [{ id: "1", tipo: "resistencia", texto: "fogo" }, { id: "2", tipo: "resistencia", texto: "frio" }],
          historico: [{ em: agora, texto: "Usou {item}: +7 PV", itemId: "potion-of-healing-common" }, { em: agora, texto: "Enviou 2× {item} para Lydia", itemId: "torch" }] } }),
      mago("pj-lydia", "Lydia"),
    ];
    const linhas = fichas.map(draft => ({ id: draft.id, campaignId, ownerId: "demo-jogador", revision: 1, updatedAt: agora, draft }));
    const notas = fichas.map(d => ({ id: d.id, kind: "character", campaignId, ownerId: "demo-jogador", title: d.name, content: [], visibility: "campaign", version: 1, createdAt: agora, updatedAt: agora,
      meta: { guiado: true, identidadePublica: { settings: { imageUrl: null, title: "", name: real, surname: real, race: real, characterClass: real, level: real, description: "" }, card: { imageUrl: null, title: "", name: d.name, surname: null, race: "Humano", characterClass: "Mago", level: "3", description: "" } } } }));
    localStorage.setItem(chaveFichas, JSON.stringify({ fichas: linhas }));
    localStorage.setItem(chaveRegistros, JSON.stringify([...registrosAtuais, ...notas]));
    localStorage.setItem("demo:moedas:v1", JSON.stringify(["cp", "sp", "gp"]));
  } catch { /* sem armazenamento: a demonstração segue sem o exemplo */ }
}
