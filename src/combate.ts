// Lógica do rastreador de iniciativa e dos encontros preparados: pura, sem cálculo de regras de D&D e sem React; CA é só um dado opcional de exibição.
// Comportamento reaproveitado do Compêndio 1.0 (js/iniciativa.js): ordem por iniciativa, turno e rodada, dano/cura limitados ao PV máximo, remoção e limpeza.
import { lerItensLoot, lerLinhasLoot, lerRecipientes, type ItemLoot, type LinhaLoot, type Recipiente } from "./loot";
export type Lado = "aliado" | "inimigo" | "neutro";
/** Referência opcional a um conteúdo do catálogo ou da campanha (guardada por id estável, nunca por nome). */
/** `npc`: NPC com ficha de criatura (estado persistente na identidade dele). Com ficha de personagem, ele entra como `personagem`. */
export type RefCombate = { tipo: "monstro" | "personagem" | "npc"; id: string };
/** Vínculo estável entre um combatente e a criatura do encontro que o originou (ids, nunca nomes). Um combate pode misturar criaturas de vários encontros. */
export type VinculoEncontro = { encontroId: string; criaturaId: string };
export type Combatente = { id: string; nome: string; iniciativa: number; lado: Lado; pv?: number; pvMax?: number; ca?: number; notas?: string; condicoes?: string[]; ref?: RefCombate; encontro?: VinculoEncontro };
export type EstadoCombate = { combatentes: Combatente[]; turno: string | null; rodada: number };
/** Criatura de um encontro: cópia editável (nome, quantidade, PV, CA, notas); nunca altera o catálogo. `ref` guarda só a origem (Bestiário). */
export type PersonalizacaoCriatura = { nome?: string; pv?: number; ca?: number; notas?: string; loot?: ItemLoot[] };
export type ParticipanteEncontro = { id: string; nome: string; quantidade: number; pv?: number; ca?: number; notas?: string; ref?: RefCombate; loot?: ItemLoot[]; individuais?: Record<string, PersonalizacaoCriatura> };
/** Ciclo de vida do encontro. Ausente em encontros antigos = "preparado". */
export type EstadoEncontro = "preparado" | "em_andamento" | "em_combate" | "concluido";
/** Uma criatura concreta (instância) do estado atual. `id` é estável (`<participanteId>#<n>`) e é o que o combate referencia. */
export type CriaturaAtual = { id: string; participanteId: string; nome: string; pv?: number; pvMax?: number; ca?: number; notas?: string; iniciativa?: number; condicoes?: string[]; situacao: "viva" | "derrotada"; noCombate?: boolean };
/** Estado atual (jogo em andamento), separado da configuração original (`participantes`). A entrega de loot/recipientes acrescenta aqui os campos de itens. */
export type SituacaoAtual = { criaturas: CriaturaAtual[]; loot?: LinhaLoot[] };
/** Configuração original = nome, descrição e `participantes`; estado atual = `estado` e `atual`. Jogar nunca altera a configuração original. */
export type Encontro = { id: string; nome: string; descricao?: string; participantes: ParticipanteEncontro[]; recompensas?: ItemLoot[]; recipientes?: Recipiente[]; estado?: EstadoEncontro; atual?: SituacaoAtual; selecao?: string[] };

export const combateVazio = (): EstadoCombate => ({ combatentes: [], turno: null, rodada: 1 });
export const novoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

/** Maior iniciativa primeiro; empate mantém a ordem em que foram adicionados (sort estável). */
export const ordenar = (c: readonly Combatente[]): Combatente[] => [...c].sort((a, b) => b.iniciativa - a.iniciativa);

export function adicionar(e: EstadoCombate, c: Omit<Combatente, "id"> & { id?: string }): EstadoCombate {
  const nome = c.nome.trim(); if (!nome) return e;
  if ((c.pvMax !== undefined && (!Number.isSafeInteger(c.pvMax) || c.pvMax < 1)) || (c.pv !== undefined && !Number.isSafeInteger(c.pv)) || (c.id !== undefined && (!c.id.trim() || e.combatentes.some(x => x.id === c.id)))) return e;
  const pvMax = c.pvMax;
  const novo: Combatente = { id: c.id ?? novoId(), nome, iniciativa: Number.isFinite(c.iniciativa) ? c.iniciativa : 0, lado: c.lado, ...(pvMax ? { pv: Math.min(Math.max(0, Math.floor(c.pv ?? pvMax)), pvMax), pvMax } : {}), ...(c.ca ? { ca: c.ca } : {}), ...(c.notas ? { notas: c.notas } : {}), ...(c.condicoes?.length ? { condicoes: [...c.condicoes] } : {}), ...(c.ref ? { ref: c.ref } : {}), ...(c.encontro ? { encontro: c.encontro } : {}) };
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
/** Volta ao turno anterior; ao recuar do primeiro da ordem, vai ao último e a rodada diminui (nunca abaixo de 1). */
export function turnoAnterior(e: EstadoCombate): EstadoCombate {
  const ordem = ordenar(e.combatentes); if (!ordem.length) return e;
  const i = ordem.findIndex(c => c.id === e.turno);
  if (i < 0) return { ...e, turno: ordem[0].id };
  if (i > 0) return { ...e, turno: ordem[i - 1].id };
  return e.rodada > 1 ? { ...e, turno: ordem[ordem.length - 1].id, rodada: e.rodada - 1 } : e;
}
/** Liga/desliga uma condição (texto livre curto, sem repetição). A lista de condições de cada sistema fica na interface, não aqui. */
export function alternarCondicao(e: EstadoCombate, id: string, condicao: string): EstadoCombate {
  const nome = condicao.trim(); if (!nome || nome.length > 40) return e;
  return { ...e, combatentes: e.combatentes.map(c => {
    if (c.id !== id) return c;
    const atuais = c.condicoes ?? [];
    const novas = atuais.includes(nome) ? atuais.filter(x => x !== nome) : atuais.length >= 16 ? atuais : [...atuais, nome];
    const { condicoes: _antigas, ...resto } = c; void _antigas;
    return novas.length ? { ...resto, condicoes: novas } : resto;
  }) };
}
/** Resultado de uma rolagem de d20 com modificador (para mostrar ao mestre: dado, modificador e total). */
export type Rolagem = { dado: number; modificador: number; total: number };
export function rolarD20(modificador = 0, aleatorio: () => number = Math.random): Rolagem {
  const dado = 1 + Math.floor(aleatorio() * 20), m = Number.isFinite(modificador) ? Math.trunc(modificador) : 0;
  return { dado, modificador: m, total: dado + m };
}
/** "d20 15 + 2 = 17" / "d20 15 − 1 = 14" / "d20 15 = 15". */
export const textoRolagem = (r: Rolagem) => `d20 ${r.dado}${r.modificador ? ` ${r.modificador > 0 ? "+" : "−"} ${Math.abs(r.modificador)}` : ""} = ${r.total}`;
/** Rola 1d20 + modificador para quem ainda não tem a iniciativa definida (ou para qualquer um). `aleatorio` é injetável para teste. */
export function rolarIniciativa(e: EstadoCombate, id: string, modificador = 0, aleatorio: () => number = Math.random): EstadoCombate {
  return definirIniciativa(e, id, rolarD20(modificador, aleatorio).total);
}
export const reiniciarRodadas = (e: EstadoCombate): EstadoCombate => ({ ...e, rodada: 1, turno: ordenar(e.combatentes)[0]?.id ?? null });

// ---------------------------------------------------------------- encontros
export function adicionarParticipante(enc: Encontro, p: { nome: string; quantidade: number; pv?: number; ca?: number; notas?: string; ref?: RefCombate }): Encontro {
  const nome = p.nome.trim(); if (!nome) return enc;
  if (!Number.isSafeInteger(p.quantidade) || p.quantidade < 1 || p.quantidade > 50 || (p.pv !== undefined && (!Number.isSafeInteger(p.pv) || p.pv < 1))) return enc;
  const quantidade = p.quantidade;
  return { ...enc, participantes: [...enc.participantes, { id: novoId(), nome, quantidade, ...(p.pv && p.pv > 0 ? { pv: Math.floor(p.pv) } : {}), ...(p.ca && Number.isSafeInteger(p.ca) && p.ca > 0 && p.ca <= 40 ? { ca: p.ca } : {}), ...(textoOpc(p.notas, 500) ? { notas: textoOpc(p.notas, 500) } : {}), ...(p.ref ? { ref: p.ref } : {}) }] };
}
const textoOpc = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
/** Edita uma criatura do encontro (só a cópia do encontro). Valores inválidos mantêm o encontro como estava. `pv`/`ca` vazios (null) removem o campo. */
export type EdicaoParticipante = { nome?: string; quantidade?: number; pv?: number | null; ca?: number | null; notas?: string };
export function editarParticipante(enc: Encontro, id: string, e: EdicaoParticipante): Encontro {
  const p = enc.participantes.find(x => x.id === id); if (!p) return enc;
  const nome = e.nome === undefined ? p.nome : e.nome.trim();
  if (!nome || nome.length > 60) return enc;
  const quantidade = e.quantidade ?? p.quantidade; if (!Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 50) return enc;
  const pv = e.pv === undefined ? p.pv : e.pv; if (pv != null && (!Number.isSafeInteger(pv) || pv < 1)) return enc;
  const ca = e.ca === undefined ? p.ca : e.ca; if (ca != null && (!Number.isSafeInteger(ca) || ca < 1 || ca > 40)) return enc;
  const notas = e.notas === undefined ? p.notas : textoOpc(e.notas, 500);
  const novo: ParticipanteEncontro = { ...(p.individuais ? { individuais: p.individuais } : {}), id: p.id, nome, quantidade, ...(pv != null ? { pv } : {}), ...(ca != null ? { ca } : {}), ...(notas ? { notas } : {}), ...(p.ref ? { ref: p.ref } : {}), ...(p.loot?.length ? { loot: p.loot } : {}) };
  return { ...enc, participantes: enc.participantes.map(x => (x.id === id ? novo : x)) };
}
export const removerParticipante = (enc: Encontro, id: string): Encontro => ({ ...enc, participantes: enc.participantes.filter(x => x.id !== id) });
/** Descrição livre do encontro (até 2000 caracteres); vazia remove o campo. */
export function definirDescricao(enc: Encontro, descricao: string): Encontro {
  const { descricao: _antiga, ...resto } = enc; void _antiga;
  const d = textoOpc(descricao, 2000); return d ? { ...resto, descricao: d } : resto;
}
/** Cópia independente (novos ids) com nome "… (cópia)". */
export const duplicarEncontro = (enc: Encontro): Encontro => ({ id: novoId(), nome: `${enc.nome} (cópia)`.slice(0, 80), ...(enc.descricao ? { descricao: enc.descricao } : {}), ...(enc.recompensas?.length ? { recompensas: enc.recompensas.map(i => ({ ...i })) } : {}), ...(enc.recipientes?.length ? { recipientes: enc.recipientes.map(r => ({ ...r, id: novoId(), itens: r.itens.map(i => ({ ...i })) })) } : {}), participantes: enc.participantes.map(p => ({ ...structuredClone(p), id: novoId() })) });
export function renomearEncontro(enc: Encontro, nome: string): Encontro { const n = nome.trim(); return n && n.length <= 80 ? { ...enc, nome: n } : enc; }
/** Configuração efetiva de uma instância; o número permanece estável dentro do grupo. */
export function configurarCriatura(p: ParticipanteEncontro, n: number): PersonalizacaoCriatura {
  return { nome: p.quantidade > 1 ? `${p.nome} ${n}` : p.nome, pv: p.pv, ca: p.ca, notas: p.notas, loot: p.loot, ...p.individuais?.[String(n)] };
}
export function personalizarCriatura(enc: Encontro, id: string, n: number, valores: PersonalizacaoCriatura): Encontro {
  const p = enc.participantes.find(x => x.id === id);
  if (!p || !Number.isInteger(n) || n < 1 || n > p.quantidade) return enc;
  const nome = textoOpc(valores.nome, 60), notas = textoOpc(valores.notas, 500);
  const pv = valores.pv, ca = valores.ca;
  if (pv !== undefined && (!Number.isSafeInteger(pv) || pv < 1)) return enc;
  if (ca !== undefined && (!Number.isSafeInteger(ca) || ca < 1 || ca > 40)) return enc;
  const individual = { ...(nome ? { nome } : {}), ...(pv !== undefined ? { pv } : {}), ...(ca !== undefined ? { ca } : {}), ...(notas ? { notas } : {}), ...(valores.loot !== undefined ? { loot: valores.loot } : {}) };
  return { ...enc, participantes: enc.participantes.map(x => x.id === id ? { ...x, individuais: { ...x.individuais, [String(n)]: individual } } : x) };
}
/** Instância concreta de uma criatura de encontro, pronta para entrar no combate. */
export type InstanciaEncontro = { criaturaId: string; participanteId: string; nome: string; pv?: number; pvMax?: number; ca?: number; notas?: string; iniciativa?: number; condicoes?: string[]; ref?: RefCombate };
/** Quem entra no combate: se o encontro já tem estado atual, as criaturas vivas e fora do combate (com os PV atuais); senão, a configuração original expandida em ids estáveis (`<participante>#<n>`). */
export function instanciasParaEnviar(enc: Encontro): InstanciaEncontro[] {
  return enc.participantes.flatMap(p => {
    const doEstado = enc.atual?.criaturas.filter(c => c.participanteId === p.id) ?? [];
    // Recupera instâncias ausentes de encontros gravados antes da correção do envio parcial.
    if (enc.atual) for (let n = 1; n <= p.quantidade; n++) {
      const id = `${p.id}#${n}`, config = configurarCriatura(p, n);
      if (!doEstado.some(c => c.id === id)) doEstado.push({ id, participanteId: p.id, nome: config.nome ?? p.nome, ...(config.pv ? { pv: config.pv, pvMax: config.pv } : {}), situacao: "viva" });
    }
    const candidatos: InstanciaEncontro[] = doEstado.length
      ? doEstado.filter(c => c.situacao === "viva" && !c.noCombate).map(c => {
        const n = Number(c.id.slice(c.id.lastIndexOf("#") + 1)), config = configurarCriatura(p, n);
        return { criaturaId: c.id, participanteId: p.id, nome: c.nome, ...(c.pvMax ? { pv: c.pv ?? c.pvMax, pvMax: c.pvMax } : {}), ca: c.ca ?? config.ca, notas: c.notas ?? config.notas, iniciativa: c.iniciativa, condicoes: c.condicoes, ...(p.ref ? { ref: p.ref } : {}) };
      })
      : Array.from({ length: p.quantidade }, (_, i) => { const config = configurarCriatura(p, i + 1); return { criaturaId: `${p.id}#${i + 1}`, participanteId: p.id, nome: config.nome ?? p.nome, ...(config.pv ? { pv: config.pv, pvMax: config.pv } : {}), ca: config.ca, notas: config.notas, ...(p.ref ? { ref: p.ref } : {}) }; });
    return candidatos.filter(c => !enc.selecao || enc.selecao.includes(c.criaturaId)).slice(0, p.quantidade);
  });
}
/** Leva as criaturas do encontro para o combate como inimigos (iniciativa 0 até o mestre informar). Preserva quem já está no combate e NUNCA duplica uma criatura já presente (vínculo por ids). */
export function nomeCombatenteDisponivel(e: EstadoCombate, nome: string): string {
  const usados = new Set(e.combatentes.map(c => c.nome.trim().toLocaleLowerCase("pt-BR")));
  if (!usados.has(nome.toLocaleLowerCase("pt-BR"))) return nome;
  const base = nome.replace(/ \d+$/, "");
  let n = 1;
  while (usados.has(`${base} ${n}`.toLocaleLowerCase("pt-BR"))) n++;
  return `${base} ${n}`;
}
export function enviarParaCombate(e: EstadoCombate, enc: Encontro): EstadoCombate {
  let r = e;
  for (const i of instanciasParaEnviar(enc)) {
    if (r.combatentes.some(c => c.encontro?.encontroId === enc.id && c.encontro.criaturaId === i.criaturaId)) continue;
    // uma ficha permanente (personagem ou NPC) não entra duas vezes no mesmo combate
    if (i.ref && i.ref.tipo !== "monstro" && r.combatentes.some(c => c.ref?.tipo === i.ref!.tipo && c.ref.id === i.ref!.id)) continue;
    r = adicionar(r, { nome: nomeCombatenteDisponivel(r, i.nome), iniciativa: i.iniciativa ?? 0, lado: "inimigo", ca: i.ca, notas: i.notas, condicoes: i.condicoes, ...(i.pvMax ? { pv: i.pv, pvMax: i.pvMax } : {}), ...(i.ref ? { ref: i.ref } : {}), encontro: { encontroId: enc.id, criaturaId: i.criaturaId } });
  }
  return r;
}

// ---------------------------------------------------------------- leitura segura do armazenamento (dado de fora nunca é confiável)
const lados: readonly string[] = ["aliado", "inimigo", "neutro"];
function lerVinculo(v: unknown): VinculoEncontro | undefined { return obj(v) && typeof v.encontroId === "string" && v.encontroId && typeof v.criaturaId === "string" && v.criaturaId ? { encontroId: v.encontroId, criaturaId: v.criaturaId } : undefined; }
function lerRef(v: unknown): RefCombate | undefined {
  if (v === undefined) return undefined;
  if (!obj(v) || (v.tipo !== "monstro" && v.tipo !== "personagem" && v.tipo !== "npc") || typeof v.id !== "string" || !v.id.trim() || v.id.length > 128) throw new Error("referência inválida");
  return { tipo: v.tipo, id: v.id };
}
function lerCondicoes(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > 16 || v.some(x => typeof x !== "string" || !x.trim() || x.length > 40) || new Set(v).size !== v.length) throw new Error("condições inválidas");
  return v.length ? (v as string[]) : undefined;
}
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
    return { id: c.id, nome: c.nome, iniciativa: c.iniciativa, lado: c.lado as Lado, ...(pvMax ? { pvMax, pv: typeof c.pv === "number" ? Math.min(pvMax, Math.max(0, c.pv)) : pvMax } : {}), ...(typeof c.ca === "number" && Number.isSafeInteger(c.ca) && c.ca > 0 && c.ca <= 40 ? { ca: c.ca } : {}), ...(textoOpc(c.notas, 500) ? { notas: textoOpc(c.notas, 500) } : {}), ...(lerCondicoes(c.condicoes) ? { condicoes: lerCondicoes(c.condicoes) } : {}), ...(lerRef(c.ref) ? { ref: lerRef(c.ref) } : {}), ...(lerVinculo(c.encontro) ? { encontro: lerVinculo(c.encontro) } : {}) };
  });
  if (new Set(combatentes.map(c => c.id)).size !== combatentes.length) throw new Error("ids repetidos");
  const turno = typeof v.turno === "string" && combatentes.some(c => c.id === v.turno) ? v.turno : combatentes.length ? ordenar(combatentes)[0].id : null;
  return { combatentes: ordenar(combatentes), turno, rodada: v.rodada };
}
function lerIndividuais(v: unknown): Record<string, PersonalizacaoCriatura> | undefined {
  if (!obj(v)) return undefined;
  const resultado: Record<string, PersonalizacaoCriatura> = {};
  for (const [k, x] of Object.entries(v)) {
    if (!/^(?:[1-9]|[1-4][0-9]|50)$/.test(k) || !obj(x)) continue;
    const nome = textoOpc(x.nome, 60), notas = textoOpc(x.notas, 500);
    resultado[k] = { ...(nome ? { nome } : {}), ...(notas ? { notas } : {}), ...(typeof x.pv === "number" && Number.isSafeInteger(x.pv) && x.pv > 0 ? { pv: x.pv } : {}), ...(typeof x.ca === "number" && Number.isSafeInteger(x.ca) && x.ca > 0 && x.ca <= 40 ? { ca: x.ca } : {}), ...(Array.isArray(x.loot) ? { loot: lerItensLoot(x.loot) ?? [] } : {}) };
  }
  return resultado;
}
const estadosEncontro: readonly string[] = ["preparado", "em_andamento", "em_combate", "concluido"];
function lerAtual(v: unknown): SituacaoAtual | undefined {
  if (v === undefined) return undefined;
  if (!obj(v) || !Array.isArray(v.criaturas)) throw new Error("estado atual inválido");
  const criaturas = v.criaturas.map((c): CriaturaAtual => {
    if (!obj(c) || typeof c.id !== "string" || !c.id || typeof c.participanteId !== "string" || typeof c.nome !== "string" || !c.nome.trim() || (c.situacao !== "viva" && c.situacao !== "derrotada")) throw new Error("criatura do estado atual inválida");
    const pvMax = typeof c.pvMax === "number" && Number.isSafeInteger(c.pvMax) && c.pvMax > 0 ? c.pvMax : undefined;
    const pv = pvMax && typeof c.pv === "number" && Number.isSafeInteger(c.pv) ? Math.min(pvMax, Math.max(0, c.pv)) : undefined;
    return { id: c.id, participanteId: c.participanteId, nome: c.nome, ...(typeof c.iniciativa === "number" && Number.isFinite(c.iniciativa) ? { iniciativa: c.iniciativa } : {}), ...(lerCondicoes(c.condicoes) ? { condicoes: lerCondicoes(c.condicoes) } : {}), ...(typeof c.ca === "number" && Number.isSafeInteger(c.ca) && c.ca > 0 && c.ca <= 40 ? { ca: c.ca } : {}), ...(textoOpc(c.notas, 500) ? { notas: textoOpc(c.notas, 500) } : {}), ...(pvMax ? { pvMax } : {}), ...(pv !== undefined ? { pv } : {}), situacao: c.situacao, ...(c.noCombate === true ? { noCombate: true } : {}) };
  });
  if (new Set(criaturas.map(c => c.id)).size !== criaturas.length) throw new Error("criaturas repetidas");
  const loot = lerLinhasLoot(v.loot);
  return { criaturas, ...(loot ? { loot } : {}) };
}
export function lerEncontros(bruto: string | null): Encontro[] {
  if (bruto === null) return [];
  const v: unknown = JSON.parse(bruto);
  if (!Array.isArray(v)) throw new Error("lista de encontros inválida");
  return v.map((e): Encontro => {
    if (!obj(e) || typeof e.id !== "string" || typeof e.nome !== "string" || !Array.isArray(e.participantes)) throw new Error("encontro inválido");
    const estado = estadosEncontro.includes(e.estado as string) ? (e.estado as EstadoEncontro) : undefined, atual = lerAtual(e.atual);
    const recompensas = lerItensLoot(e.recompensas), recipientes = lerRecipientes(e.recipientes);
    return { id: e.id, nome: e.nome, ...(recompensas?.length ? { recompensas } : {}), ...(recipientes?.length ? { recipientes } : {}), ...(estado ? { estado } : {}), ...(atual ? { atual } : {}), ...(textoOpc(e.descricao, 2000) ? { descricao: textoOpc(e.descricao, 2000) } : {}), participantes: e.participantes.map((p): ParticipanteEncontro => {
      if (!obj(p) || typeof p.id !== "string" || typeof p.nome !== "string" || typeof p.quantidade !== "number" || !Number.isSafeInteger(p.quantidade) || p.quantidade < 1 || p.quantidade > 50) throw new Error("participante inválido");
      if (p.pv !== undefined && (typeof p.pv !== "number" || !Number.isSafeInteger(p.pv) || p.pv < 1)) throw new Error("PV inválido");
      return { ...(lerIndividuais(p.individuais) ? { individuais: lerIndividuais(p.individuais) } : {}), id: p.id, nome: p.nome, quantidade: p.quantidade, ...(typeof p.pv === "number" && p.pv > 0 ? { pv: p.pv } : {}), ...(lerItensLoot(p.loot)?.length ? { loot: lerItensLoot(p.loot) } : {}), ...(typeof p.ca === "number" && Number.isSafeInteger(p.ca) && p.ca > 0 && p.ca <= 40 ? { ca: p.ca } : {}), ...(textoOpc(p.notas, 500) ? { notas: textoOpc(p.notas, 500) } : {}), ...(lerRef(p.ref) ? { ref: lerRef(p.ref) } : {}) };
    }) };
  });
}
export const chaveCombate = (userId: string, campaignId: string) => `compendio5e:iniciativa:${userId}:${campaignId}`;
export const chaveEncontros = (userId: string, campaignId: string) => `compendio5e:encontros:${userId}:${campaignId}`;
