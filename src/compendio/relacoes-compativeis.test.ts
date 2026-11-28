// Só as relações que fazem sentido entre as categorias são oferecidas; o inverso sai automaticamente.
import { describe, expect, it } from "vitest";
import { montarRelacao, opcoesDeRelacao } from "./relacoes";

const nomes = (a?: string, b?: string) => opcoesDeRelacao(a, b).map(o => o.rotulo);
describe("relações compatíveis", () => {
  it("pessoa e local", () => {
    expect(nomes("npc", "location")).toEqual(["Líder de", "Fundador de", "Proprietário de", "Antigo proprietário de", "Reside em", "Nasceu em", "Relacionado"]);
    expect(nomes("location", "npc")).toEqual(["Liderado por", "Fundado por", "Propriedade de", "Antigo proprietário", "Habitante", "Natural de", "Relacionado"]);
  });
  it("local contém local; organização tem sede; descoberta é descoberta em um local", () => {
    expect(nomes("location", "location")).toEqual(["Localizado em", "Contém", "Relacionado"]);
    expect(nomes("organization", "location")).toContain("Possui sede em");
    expect(nomes("organization", "location")).not.toContain("Habitante");
    expect(nomes("discovery", "location")).toContain("Descoberta em");
    expect(nomes("npc", "organization")).toEqual(["Membro de", "Líder de", "Fundador de", "Relacionado"]);
  });
  it("monta o par com o inverso, nos dois sentidos", () => {
    const vazio = { ida: "", volta: "" };
    expect(montarRelacao("originates:a", "p", "l", vazio, { atual: "npc", alvo: "location" })).toEqual({ source: "p", target: "l", kind: "originates", label: "Nasceu em", inverse: "Natural de" });
    expect(montarRelacao("resident:b", "l", "p", vazio, { atual: "location", alvo: "npc" })).toMatchObject({ source: "p", target: "l", label: "Reside em", inverse: "Habitante" });
    expect(montarRelacao("located:a", "d", "l", vazio, { atual: "discovery", alvo: "location" })).toMatchObject({ label: "Descoberta em", inverse: "Local da descoberta" });
  });
});
