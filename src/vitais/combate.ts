// A Iniciativa NÃO tem PV nem condições próprios para personagens com ficha: mostra e altera os da ficha. Aqui o combate guardado
// (ordem, iniciativa, lado...) é combinado com o estado vital lido da ficha; o que está no combate para esses campos é ignorado.
import { useEffect, useRef, useState } from "react";
import type { Combatente, EstadoCombate } from "../combate";
import type { CharacterDraft } from "../rules/character-domain";
import type { LinhaVital } from "./loja";

export type CombatenteVivo = Combatente & { /** PV temporários da ficha. */ temp?: number; /** Estado vem da ficha (fonte única). */ daFicha?: boolean };
export const idDePersonagem = (c: Combatente) => (c.ref?.tipo === "personagem" ? c.ref.id : null);
export const idsDePersonagens = (e: EstadoCombate) => [...new Set(e.combatentes.flatMap(c => { const id = idDePersonagem(c); return id ? [id] : []; }))];

export function comEstadoDasFichas(e: EstadoCombate, ver: (id: string) => LinhaVital | undefined, maximos: ReadonlyMap<string, number>): EstadoCombate & { combatentes: CombatenteVivo[] } {
  return { ...e, combatentes: e.combatentes.map(c => {
    const id = idDePersonagem(c), l = id ? ver(id) : undefined, max = id ? maximos.get(id) : undefined;
    if (!l || !max) return c;
    return { ...c, pv: Math.min(max, l.pv), pvMax: max, condicoes: l.condicoes, temp: l.temp, daFicha: true };
  }) };
}

/** PV máximo de cada ficha, calculado pelas mesmas regras que a ficha mostra (carregadas sob demanda). Recalcula quando a ficha muda. */
export function useMaximos(linhas: readonly LinhaVital[]): ReadonlyMap<string, number> {
  const [mapa, setMapa] = useState<ReadonlyMap<string, number>>(new Map());
  const calculados = useRef(new Map<string, number>());   // id:revision → máximo
  const chave = linhas.map(l => `${l.id}:${l.revision}`).sort().join("|");
  const atuais = useRef(linhas); atuais.current = linhas;
  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    void import("../criador/regras-2014").then(({ sheet2014 }) => {
      if (!vivo) return;
      const novo = new Map<string, number>();
      for (const l of atuais.current) {
        const k = `${l.id}:${l.revision}`;
        let max = calculados.current.get(k);
        if (max === undefined) { try { max = sheet2014({ ...(l.draft as CharacterDraft), name: l.draft.name || "Sem nome", currentHp: 0 }).maxHp; calculados.current.set(k, max); } catch { continue; } }
        novo.set(l.id, max);
      }
      setMapa(novo);
    });
    return () => { vivo = false; };
  }, [chave]);
  return mapa;
}
