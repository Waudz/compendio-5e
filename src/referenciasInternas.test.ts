import { describe, expect, it } from "vitest";
import { criarLinkInterno, lerLinkInterno } from "./referenciasInternas";

describe("referências internas", () => {
  it("preserva o tipo e o identificador sem depender do título", () => {
    const ref = { tipo: "monstro" as const, id: "dragão branco 01" };
    expect(lerLinkInterno(criarLinkInterno(ref))).toEqual(ref);
  });
  it("rejeita endereços externos, tipos desconhecidos e codificação inválida", () => {
    expect(lerLinkInterno("javascript:alert(1)")).toBeNull();
    expect(lerLinkInterno("compendio://referencia/externo/123")).toBeNull();
    expect(lerLinkInterno("compendio://referencia/monstro/%XX")).toBeNull();
  });
});
