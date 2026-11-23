// Lógica do rastreador de iniciativa e dos encontros preparados: pura, independente de sistema de RPG (sem CA, sem regras de D&D) e sem React.
// Comportamento reaproveitado do Compêndio 1.0 (js/iniciativa.js): ordem por iniciativa, turno e rodada, dano/cura limitados ao PV máximo, remoção e limpeza.
export type Lado = "aliado" | "inimigo" | "neutro";
export type Combatente = { id: string; nome: string; iniciativa: number; lado: Lado; pv?: number; pvMax?: number };
export type EstadoCombate = { combatentes: Combatente[]; turno: string | null; rodada: number };
export type ParticipanteEncontro = { id: string; nome: string; quantidade: number; pv?: number };
export type Encontro = { id: string; nome: string; participantes: ParticipanteEncontro[] };

export const combateVazio = (): EstadoCombate => ({ combatentes: [], turno: null, rodada: 1 });
export const novoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

/** Maior iniciativa primeiro; empate mantém a ordem em que foram adicionados (sort estável). */
export const ordenar = (c: readonly Combatente[]): Combatente[] => [...c].sort((a, b) => b.iniciativa - a.iniciativa);

export function adicionar(e: EstadoCombate, c: Omit<Combatente, "id"> & { id?: string }): EstadoCombate {
  const nome = c.nome.trim(); if (!nome) return e;
  if ((c.pvMax !== undefined && (!Number.isSafeInteger(c.pvMax) || c.pvMax < 1)) || (c.pv !== undefined && !Number.isSafeInteger(c.pv)) || (c.id !== undefined && (!c.id.trim() || e.combatentes.some(x => x.id === c.id)))) return e;
  const pvMax = c.pvMax;
  const novo: Combatente = { id: c.id ?? novoId(), nome, iniciativa: Number.isFinite(c.iniciativa) ? c.iniciativa : 0, lado: c.lado, ...(pvMax ? { pv: Math.min(Math.max(0, Math.floor(c.pv ?? pvMax)), pvMax), pvMax } : {}) };
  const primeiroAntes = ordenar(e.combatentes)[0]?.id, combatentes = ordenar([...e.combatentes, novo]);
  // antes de qualquer turno passar (rodada 1, ninguém avançou), o turno acompanha quem tem a maior iniciativa
  const turno = e.turno === null || (e.rodada === 1 && e.turno === primeiroAntes) ? combatentes[0].id : e.turno;
  return { ...e, combatentes, turno };
}
export function remover(e: EstadoCombate, id: string): EstadoCombate {
  const ordem = ordenar(e.combatentes), i = ordem.findIndex(c => c.id === id); if (i < 0) return e;
  const resto = ordem.filter(c => c.id !== id);
  const turno = e.turno !== id ? e.turno : resto.length ? resto[i % resto.length].id : null;
  // Retirar o último no turno consome esse turno e volta ao primeiro da próxima rodada.
  const voltaAoInicio = e.turno === id && resto.length > 0 && i === ordem.length - 1;
  return { ...e, combatentes: resto, turno, rodada: e.rodada + (voltaAoInicio ? 1 : 0) };
}
export function definirIniciativa(e: EstadoCombate, id: string, valor: number): EstadoCombate {
  if (!Number.isFinite(valor)) return e;
  return { ...e, combatentes: ordenar(e.combatentes.map(c => (c.id === id ? { ...c, iniciativa: valor } : c))) };
}
/** `delta` negativo = dano, positivo = cura. O PV fica entre 0 e o máximo. Sem PV cadastrado, não faz nada. */
export function alterarPv(e: EstadoCombate, id: string, delta: number): EstadoCombate {
  if (!Number.isFinite(delta)) return e;
  return { ...e, combatentes: e.combatentes.map(c => (c.id === id && c.pvMax ? { ...c, pv: Math.min(c.pvMax, Math.max(0, (c.pv ?? c.pvMax) + Math.trunc(delta))) } : c)) };
}
/** Passa o turno; ao voltar ao primeiro da ordem, a rodada aumenta. */
export function proximoTurno(e: EstadoCombate): EstadoCombate {
  const ordem = ordenar(e.combatentes); if (!ordem.length) return e;
  const i = ordem.findIndex(c => c.id === e.turno);
  if (i < 0) return { ...e, turno: ordem[0].id };
  return i + 1 >= ordem.length ? { ...e, turno: ordem[0].id, rodada: e.rodada + 1 } : { ...e, turno: ordem[i + 1].id };
}
export const reiniciarRodadas = (e: EstadoCombate): EstadoCombate => ({ ...e, rodada: 1, turno: ordenar(e.combatentes)[0]?.id ?? null });

// ---------------------------------------------------------------- encontros
export function adicionarParticipante(enc: Encontro, p: { nome: string; quantidade: number; pv?: number }): Encontro {
  const nome = p.nome.trim(); if (!nome) return enc;
  if (!Number.isSafeInteger(p.quantidade) || p.quantidade < 1 || p.quantidade > 50 || (p.pv !== undefined && (!Number.isSafeInteger(p.pv) || p.pv < 1))) return enc;
  const quantidade = p.quantidade;
  return { ...enc, participantes: [...enc.participantes, { id: novoId(), nome, quantidade, ...(p.pv && p.pv > 0 ? { pv: Math.floor(p.pv) } : {}) }] };
}
/** Leva os participantes do encontro para o combate como inimigos, numerando quando há mais de um ("Goblin 1", "Goblin 2"). Iniciativa 0 até o mestre informar. */
export function enviarParaCombate(e: EstadoCombate, enc: Encontro): EstadoCombate {
  let r = e;
  for (const p of enc.participantes) for (let i = 1; i <= p.quantidade; i++) r = adicionar(r, { nome: p.quantidade > 1 ? `${p.nome} ${i}` : p.nome, iniciativa: 0, lado: "inimigo", ...(p.pv ? { pv: p.pv, pvMax: p.pv } : {}) });
  return r;
}

// ---------------------------------------------------------------- leitura segura do armazenamento (dado de fora nunca é confiável)
const lados: readonly string[] = ["aliado", "inimigo", "neutro"];
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export function lerCombate(bruto: string | null): EstadoCombate {
  if (bruto === null) return combateVazio();
  const v: unknown = JSON.parse(bruto);
  if (!obj(v) || !Array.isArray(v.combatentes) || typeof v.rodada !== "number" || !Number.isSafeInteger(v.rodada) || v.rodada < 1) throw new Error("estado de combate inválido");
  const combatentes = v.combatentes.map((c): Combatente => {
    if (!obj(c) || typeof c.id !== "string" || !c.id.trim() || typeof c.nome !== "string" || !c.nome.trim() || typeof c.iniciativa !== "number" || !Number.isFinite(c.iniciativa) || typeof c.lado !== "string" || !lados.includes(c.lado)) throw new Error("combatente inválido");
    if (c.pvMax !== undefined && (typeof c.pvMax !== "number" || !Number.isSafeInteger(c.pvMax) || c.pvMax < 1)) throw new Error("PV máximo inválido");
    if (c.pv !== undefined && (typeof c.pv !== "number" || !Number.isSafeInteger(c.pv) || c.pv < 0 || c.pvMax === undefined || c.pv > (c.pvMax as number))) throw new Error("PV inválido");
    const pvMax = c.pvMax as number | undefined;
    return { id: c.id, nome: c.nome, iniciativa: c.iniciativa, lado: c.lado as Lado, ...(pvMax ? { pvMax, pv: typeof c.pv === "number" ? Math.min(pvMax, Math.max(0, c.pv)) : pvMax } : {}) };
  });
  if (new Set(combatentes.map(c => c.id)).size !== combatentes.length) throw new Error("ids repetidos");
  const turno = typeof v.turno === "string" && combatentes.some(c => c.id === v.turno) ? v.turno : combatentes.length ? ordenar(combatentes)[0].id : null;
  return { combatentes: ordenar(combatentes), turno, rodada: v.rodada };
}
export function lerEncontros(bruto: string | null): Encontro[] {
  if (bruto === null) return [];
  const v: unknown = JSON.parse(bruto);
  if (!Array.isArray(v)) throw new Error("lista de encontros inválida");
  return v.map((e): Encontro => {
    if (!obj(e) || typeof e.id !== "string" || typeof e.nome !== "string" || !Array.isArray(e.participantes)) throw new Error("encontro inválido");
    return { id: e.id, nome: e.nome, participantes: e.participantes.map((p): ParticipanteEncontro => {
      if (!obj(p) || typeof p.id !== "string" || typeof p.nome !== "string" || typeof p.quantidade !== "number" || !Number.isSafeInteger(p.quantidade) || p.quantidade < 1 || p.quantidade > 50) throw new Error("participante inválido");
      if (p.pv !== undefined && (typeof p.pv !== "number" || !Number.isSafeInteger(p.pv) || p.pv < 1)) throw new Error("PV inválido");
      return { id: p.id, nome: p.nome, quantidade: p.quantidade, ...(typeof p.pv === "number" && p.pv > 0 ? { pv: p.pv } : {}) };
    }) };
  });
}
export const chaveCombate = (userId: string, campaignId: string) => `compendio5e:iniciativa:${userId}:${campaignId}`;
export const chaveEncontros = (userId: string, campaignId: string) => `compendio5e:encontros:${userId}:${campaignId}`;
