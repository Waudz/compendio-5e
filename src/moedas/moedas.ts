// Moedas do SRD 5.1 (2014) e a escolha de quais cada campanha usa. As regras gerais continuam com as cinco; a campanha só decide o
// que aparece. Valores guardados em moedas desativadas NÃO são apagados: ficam na ficha, fora da tela e do total.
export const MOEDAS = [
  { chave: "cp", sigla: "PC", nome: "Cobre", valorEmCobre: 1 },
  { chave: "sp", sigla: "PP", nome: "Prata", valorEmCobre: 10 },
  { chave: "ep", sigla: "PE", nome: "Electro", valorEmCobre: 50 },
  { chave: "gp", sigla: "PO", nome: "Ouro", valorEmCobre: 100 },
  { chave: "pp", sigla: "PL", nome: "Platina", valorEmCobre: 1000 },
] as const;
export type ChaveMoeda = (typeof MOEDAS)[number]["chave"];
export const TODAS_AS_MOEDAS: readonly ChaveMoeda[] = MOEDAS.map(m => m.chave);
export type Carteira = Partial<Record<ChaveMoeda, number>>;

/** Leitura segura da configuração: sem nada válido, valem as cinco. A ordem é sempre a das regras. */
export function lerMoedasAtivas(v: unknown): ChaveMoeda[] {
  const lista = Array.isArray(v) ? TODAS_AS_MOEDAS.filter(c => v.includes(c)) : [];
  return lista.length ? lista : [...TODAS_AS_MOEDAS];
}

/** Patrimônio nas moedas ativas, convertido em peças de ouro. */
export const totalEmOuro = (c: Carteira | undefined, ativas: readonly ChaveMoeda[]) =>
  MOEDAS.reduce((soma, m) => (ativas.includes(m.chave) ? soma + (c?.[m.chave] ?? 0) * m.valorEmCobre : soma), 0) / 100;
export const formatarOuro = (po: number) => `${po.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} PO`;

/** Quando um fluxo (equipamento inicial, recompensa, transferência) entrega uma moeda desativada, o MESMO valor é entregue nas moedas
 *  ativas, da maior para a menor. O que não puder ser convertido sem perda permanece na moeda original: nada é arredondado. */
export function entregarNasAtivas(antes: Carteira | undefined, depois: Carteira | undefined, ativas: readonly ChaveMoeda[]): Carteira {
  const resultado: Carteira = { ...depois };
  for (const origem of MOEDAS) {
    const ganho = (depois?.[origem.chave] ?? 0) - (antes?.[origem.chave] ?? 0);
    if (ganho <= 0 || ativas.includes(origem.chave)) continue;
    let resto = ganho * origem.valorEmCobre;
    const partes: Carteira = {};
    for (const m of [...MOEDAS].reverse()) {
      if (!ativas.includes(m.chave)) continue;
      const n = Math.floor(resto / m.valorEmCobre); if (n) { partes[m.chave] = n; resto -= n * m.valorEmCobre; }
    }
    if (resto) continue;   // sem conversão exata: fica como veio
    resultado[origem.chave] = (resultado[origem.chave] ?? 0) - ganho;
    for (const [chave, n] of Object.entries(partes) as [ChaveMoeda, number][]) resultado[chave] = (resultado[chave] ?? 0) + n;
  }
  return resultado;
}
