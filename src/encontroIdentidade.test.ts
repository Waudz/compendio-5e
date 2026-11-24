import { describe, expect, it } from "vitest";
import { adicionar, alterarPv, alternarCondicao, combateVazio, configurarCriatura, definirIniciativa, duplicarEncontro, editarParticipante, enviarParaCombate, instanciasParaEnviar, lerCombate, lerEncontros, personalizarCriatura, remover, type Encontro } from "./combate";
import { iniciarSemCombate, marcarEnviado, sincronizarComCombate } from "./estadoEncontro";

describe("#138: identidade individual e retomada", () => {
  const base = (): Encontro => ({ id: "covil", nome: "Cinco goblins", participantes: [{ id: "g", nome: "Goblin", quantidade: 5, pv: 7, ca: 15, notas: "Patrulha", loot: [{ id: "adaga", nome: "Adaga", quantidade: 1 }] }] });
  const lider = () => personalizarCriatura(base(), "g", 3, { nome: "Líder", pv: 20, ca: 17, notas: "Chave do portão", loot: [{ id: "chave", nome: "Chave", quantidade: 1 }] });
  it("envia quatro específicos, depois o restante, remove ferido e reinsere após recarga sem perder estado nem duplicar", () => {
    let enc = lider();
    const parcial = { ...enc, selecao: ["g#1", "g#2", "g#3", "g#4"] };
    let combate = enviarParaCombate(combateVazio(), parcial); enc = marcarEnviado(enc, parcial);
    expect(combate.combatentes).toHaveLength(4); expect(enc.atual!.criaturas).toHaveLength(5);
    expect(combate.combatentes.find(c => c.encontro?.criaturaId === "g#3")).toMatchObject({ nome: "Líder", pv: 20, ca: 17, notas: "Chave do portão" });
    const ultimo = { ...enc, selecao: ["g#5"] }; combate = enviarParaCombate(combate, ultimo); enc = marcarEnviado(enc, ultimo);
    expect(combate.combatentes).toHaveLength(5);
    const id = combate.combatentes.find(c => c.encontro?.criaturaId === "g#3")!.id;
    combate = alternarCondicao(definirIniciativa(alterarPv(combate, id, -6), id, 18), id, "Envenenado");
    enc = sincronizarComCombate(enc, combate); combate = remover(combate, id); enc = sincronizarComCombate(enc, combate);
    enc = lerEncontros(JSON.stringify([enc]))[0]; combate = lerCombate(JSON.stringify(combate));
    expect(instanciasParaEnviar(enc).map(c => c.criaturaId)).toEqual(["g#3"]);
    combate = enviarParaCombate(combate, enc); enc = marcarEnviado(enc, enc);
    expect(combate.combatentes).toHaveLength(5);
    expect(combate.combatentes.find(c => c.encontro?.criaturaId === "g#3")).toMatchObject({ nome: "Líder", pv: 14, pvMax: 20, ca: 17, iniciativa: 18, condicoes: ["Envenenado"] });
    expect(enviarParaCombate(combate, enc).combatentes).toHaveLength(5);
    expect(enc.atual!.loot!.filter(l => l.origem.tipo === "criatura" && l.origem.criaturaId === "g#3").map(l => l.nome)).toEqual(["Chave"]);
  });
  it("edição coletiva preserva as escolhas do líder e a cópia não compartilha objetos mutáveis", () => {
    const original = lider(), editado = editarParticipante(original, "g", { pv: 9, ca: 16, notas: "Padrão novo" });
    expect(configurarCriatura(editado.participantes[0], 3)).toMatchObject({ nome: "Líder", pv: 20, ca: 17, notas: "Chave do portão" });
    expect(configurarCriatura(editado.participantes[0], 2)).toMatchObject({ pv: 9, ca: 16 });
    const copia = duplicarEncontro(original); copia.participantes[0].individuais!["3"].nome = "Outro";
    expect(original.participantes[0].individuais!["3"].nome).toBe("Líder");
  });
  it("loot vazio individual substitui o grupo; colisões entre avulsos e encontros não afetam o vínculo", () => {
    const enc = personalizarCriatura(base(), "g", 3, { loot: [] });
    const jogo = iniciarSemCombate(enc);
    expect(jogo.atual!.loot!.some(l => l.origem.tipo === "criatura" && l.origem.criaturaId === "g#3")).toBe(false);
    const combate = enviarParaCombate(adicionar(combateVazio(), { nome: "Goblin 1", iniciativa: 2, lado: "inimigo" }), enc);
    expect(new Set(combate.combatentes.map(c => c.nome)).size).toBe(6);
    expect(new Set(combate.combatentes.flatMap(c => c.encontro ? [c.encontro.criaturaId] : [])).size).toBe(5);
  });
});
