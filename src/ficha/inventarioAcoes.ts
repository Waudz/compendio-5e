// Consumo e transferência de itens em funções puras: o espelho das funções do banco (`usar_consumivel` e `transferir_item`, migração 0014),
// usado pelo armazenamento local e pela API em memória. Tudo ou nada: em erro, nenhuma ficha muda.
import type { CharacterDraft, InventoryEntry } from "../rules/character-domain";
import { aplicarAcao, comVitais, vitaisDoDraft } from "../vitais/vitais";
import { comEstado, lerEstadoJogo, MAX_CONCEDIDOS, MAX_HISTORICO } from "./estadoJogo";

const falha = (erro: string) => ({ ok: false as const, erro });
const comMovimento = (d: CharacterDraft, texto: string, itemId: string, agora: Date) =>
  comEstado(d, { historico: [{ em: agora.toISOString(), texto, itemId }, ...lerEstadoJogo(d).historico].slice(0, MAX_HISTORICO) });
const trocar = (d: CharacterDraft, id: string, novo: InventoryEntry | null): CharacterDraft => ({ ...d, inventory: d.inventory.flatMap(i => (i.id !== id ? [i] : novo ? [novo] : [])) });

export function consumirItem(draft: CharacterDraft, instancia: string, cura: number, maximo: number, agora = new Date()): { ok: true; draft: CharacterDraft } | { ok: false; erro: string } {
  const item = draft.inventory.find(i => i.id === instancia);
  if (!item) return falha("Este item não está mais no inventário. Nada foi alterado.");
  if (!Number.isSafeInteger(cura) || cura < 0) return falha("Operação inválida. Nada foi alterado.");
  const antes = vitaisDoDraft(draft), depois = cura > 0 ? aplicarAcao(antes, { tipo: "cura", valor: cura, maximo }) : antes;
  const semItem = trocar(draft, instancia, item.quantity > 1 ? { ...item, quantity: item.quantity - 1 } : null);
  const ganho = depois.pv - antes.pv;
  return { ok: true, draft: comMovimento(comVitais(semItem, depois), ganho > 0 ? `Usou {item}: +${ganho} PV` : "Usou {item}", item.itemId, agora) };
}

export function transferirEntre(origem: CharacterDraft, destino: CharacterDraft, instancia: string, quantidade: number, nomeDestino: string, novoId: () => string, agora = new Date()):
  { ok: true; origem: CharacterDraft; destino: CharacterDraft } | { ok: false; erro: string } {
  const item = origem.inventory.find(i => i.id === instancia);
  if (!item) return falha("Este item não está mais no inventário. Nada foi alterado.");
  if (!Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > item.quantity) return falha("Quantidade indisponível. Nada foi alterado.");
  const inteira = quantidade === item.quantity;
  const id = !inteira || destino.inventory.some(i => i.id === instancia) ? novoId() : instancia;
  const concedidos = lerEstadoJogo(origem).concedidos;
  const viajam = inteira ? concedidos.filter(c => c.itemInstancia === instancia).map(c => ({ ...c, itemInstancia: id })) : [];
  const noDestino = lerEstadoJogo(destino).concedidos;
  if (noDestino.length + viajam.length > MAX_CONCEDIDOS) return falha("O destinatário não tem espaço para as concessões deste item. Nada foi alterado.");
  let de = trocar(origem, instancia, inteira ? null : { ...item, quantity: item.quantity - quantidade });
  if (viajam.length) de = comEstado(de, { concedidos: concedidos.filter(c => c.itemInstancia !== instancia) });
  let para: CharacterDraft = { ...destino, inventory: [...destino.inventory, { ...item, id, quantity: quantidade, equipped: false, origin: "acquired" }] };
  if (viajam.length) para = comEstado(para, { concedidos: [...noDestino, ...viajam] });
  return { ok: true,
    origem: comMovimento(de, `Enviou ${quantidade}× {item} para ${nomeDestino}`, item.itemId, agora),
    destino: comMovimento(para, `Recebeu ${quantidade}× {item} de ${origem.name.trim() || "outro personagem"}`, item.itemId, agora) };
}
