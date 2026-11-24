// Ciclo de vida do encontro (funções puras): configuração original x estado atual, vínculo com o combate, conclusão, restauração e duplicação.
// A configuração original (`participantes`, nome, descrição) nunca é alterada pelo jogo; o que acontece fica em `estado` e `atual`.
import { duplicarEncontro, instanciasParaEnviar, novoId, type CriaturaAtual, type Encontro, type EstadoCombate, type EstadoEncontro } from "./combate";

export const ROTULO_ESTADO: Record<EstadoEncontro, string> = { preparado: "Preparado", em_andamento: "Em andamento", em_combate: "Em combate", concluido: "Concluído" };
/** Encontros antigos não têm o campo: contam como preparados. */
export const estadoDe = (enc: Encontro): EstadoEncontro => enc.estado ?? "preparado";

/** Pendências que impedem a conclusão automática (hoje: criaturas vivas; a entrega de loot acrescenta itens não resolvidos aqui). */
export function pendencias(enc: Encontro): string[] {
  const vivas = enc.atual?.criaturas.filter(c => c.situacao === "viva").length ?? 0;
  return vivas ? [`${vivas} criatura(s) viva(s)`] : [];
}

/** Estado atual novo, a partir da configuração original: todas vivas, com ids estáveis. */
function criaturasIniciais(enc: Encontro): CriaturaAtual[] {
  return instanciasParaEnviar({ ...enc, atual: undefined }).map(i => ({ id: i.criaturaId, participanteId: i.participanteId, nome: i.nome, ...(i.pvMax ? { pv: i.pvMax, pvMax: i.pvMax } : {}), situacao: "viva" as const }));
}

/** Registra no encontro o que foi enviado ao combate (criaturas marcadas "no combate") e o põe "em combate". `selecionado` é o encontro filtrado que foi enviado. */
export function marcarEnviado(enc: Encontro, selecionado: Encontro): Encontro {
  const novas = instanciasParaEnviar({ ...selecionado, atual: enc.atual });
  if (!novas.length) return enc;
  const criaturas = [...(enc.atual?.criaturas ?? [])];
  for (const i of novas) {
    const k = criaturas.findIndex(c => c.id === i.criaturaId);
    if (k >= 0) criaturas[k] = { ...criaturas[k], noCombate: true };
    else criaturas.push({ id: i.criaturaId, participanteId: i.participanteId, nome: i.nome, ...(i.pvMax ? { pv: i.pv ?? i.pvMax, pvMax: i.pvMax } : {}), situacao: "viva", noCombate: true });
  }
  return { ...enc, estado: "em_combate", atual: { criaturas } };
}

/** Atualiza o estado atual a partir do combate (PV, derrotados, quem saiu). Com `encerrado`, o combate acabou: ninguém continua "no combate".
 *  Conclui sozinho só se não restar pendência; senão fica "em andamento". Nunca mexe na configuração original. */
export function sincronizarComCombate(enc: Encontro, combate: EstadoCombate, encerrado = false): Encontro {
  if (!enc.atual) return enc;
  const criaturas = enc.atual.criaturas.map((c): CriaturaAtual => {
    const { noCombate: _n, ...base } = c; void _n;
    const k = combate.combatentes.find(x => x.encontro?.encontroId === enc.id && x.encontro.criaturaId === c.id);
    if (!k) return base;
    const pvMax = k.pvMax ?? c.pvMax, pv = k.pv ?? c.pv;
    return { ...base, ...(pvMax ? { pvMax } : {}), ...(pv !== undefined ? { pv } : {}), situacao: pvMax && pv === 0 ? "derrotada" : "viva", ...(encerrado ? {} : { noCombate: true as const }) };
  });
  const novo: Encontro = { ...enc, atual: { criaturas } };
  if (estadoDe(enc) !== "em_combate" || criaturas.some(c => c.noCombate)) return novo;
  return { ...novo, estado: pendencias(novo).length ? "em_andamento" : "concluido" };
}

/** Começa o encontro sem combate (sala, exploração, armadilha, cena narrativa). */
export function iniciarSemCombate(enc: Encontro): Encontro {
  return estadoDe(enc) === "preparado" ? { ...enc, estado: "em_andamento", atual: enc.atual ?? { criaturas: criaturasIniciais(enc) } } : enc;
}
/** Conclusão manual (com ou sem combate). Bloqueada durante combate ativo. */
export const concluirEncontro = (enc: Encontro): Encontro => (estadoDe(enc) === "em_combate" ? enc : { ...enc, estado: "concluido" });
/** Reabre um encontro concluído como "em andamento" (o estado atual é mantido). */
export const reabrirEncontro = (enc: Encontro): Encontro => (estadoDe(enc) === "concluido" ? { ...enc, estado: "em_andamento", atual: enc.atual ?? { criaturas: criaturasIniciais(enc) } } : enc);
/** Volta ao estado original: descarta só o estado atual. Bloqueada durante combate ativo. (Itens já entregues a personagens não são desfeitos.) */
export function restaurarOriginal(enc: Encontro): Encontro {
  if (estadoDe(enc) === "em_combate") return enc;
  const { atual: _a, estado: _e, ...resto } = enc; void _a; void _e;
  return { ...resto, estado: "preparado" };
}
export const podeRestaurar = (enc: Encontro) => estadoDe(enc) !== "em_combate" && (estadoDe(enc) !== "preparado" || !!enc.atual);

/** Cópia do estado atual: novos ids de encontro, participantes e criaturas (as referências internas são remapeadas); nunca "em combate". */
export function duplicarEstadoAtual(enc: Encontro): Encontro {
  if (!enc.atual) return duplicarEncontro(enc);
  const ids = new Map(enc.participantes.map(p => [p.id, novoId()] as const));
  const criaturas = enc.atual.criaturas.map((c): CriaturaAtual => {
    const antigo = c.participanteId, novo = ids.get(antigo) ?? novoId();
    const { noCombate: _n, ...resto } = c; void _n;
    return { ...resto, participanteId: novo, id: c.id.startsWith(`${antigo}#`) ? `${novo}${c.id.slice(antigo.length)}` : novoId() };
  });
  const estado: EstadoEncontro = estadoDe(enc) === "concluido" ? "concluido" : "em_andamento";
  return { ...enc, id: novoId(), nome: `${enc.nome} (estado atual)`.slice(0, 80), estado, participantes: enc.participantes.map(p => ({ ...p, id: ids.get(p.id)! })), atual: { criaturas } };
}
