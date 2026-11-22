import { createHash } from 'node:crypto';
/** Completa textos de monstros que o tradutor do Compêndio 1.0 deixou pela metade (estrutura do ataque em português, efeito em inglês).
 *  Memória de tradução por FRASE: a frase em inglês, com os números trocados por `#`, tem a tradução em `traducoes-frases.json`
 *  (`{1}`, `{2}`… = n-ésimo número da frase original; dados "2d6 + 4" contam como um número). O que não tem frase cadastrada é listado e o build falha. */

/** Palavras que só existem em inglês e denunciam uma frase não traduzida (a fronteira de palavra considera letras acentuadas: "até" não contém "at"). */
const PALAVRAS = ['the', 'and', 'its', 'with', 'can', 'has', 'must', 'damage', 'feet', 'foot', 'ft', 'hit points?', 'saving throws?', 'if', 'is', 'are', 'until', 'target', 'targets', 'takes?', 'one',
  'on', 'or', 'of', 'in', 'to', 'it', 'at', 'from', 'by', 'that', 'each', 'any', 'all', 'while', 'when', 'then', 'but', 'not', 'than', 'also', 'creatures?', 'ends?', 'success', 'successful',
  'failure', 'fail', 'failed', 'you', 'your', 'within', 'range', 'melee', 'ranged', 'weapon', 'spell', 'an', 'he', 'she', 'they', 'his', 'her', 'their', 'which', 'who', 'whose', 'up', 'out', 'hit'];
const MARCAS = new RegExp(`(?<![\\p{L}])(?:${PALAVRAS.join('|')})(?![\\p{L}])`, 'iu');
const NUMERO = /\d+d\d+(?:\s*[+-]\s*\d+)?|\d+(?:,\d+)?/g;
export const temIngles = (s) => MARCAS.test(s);

/** Divide em [frase, separador] preservando tudo (a soma das partes é o texto original). */
function frases(t) {
  const partes = []; const re = /([\s\S]*?)((?:[.!?](?=\s))\s+|\n+|$)/g; let m;
  while ((m = re.exec(t)) && (m[1] !== '' || m[2] !== '')) { partes.push([m[1], m[2]]); if (m[0] === '') break; }
  return partes;
}

/** Títulos dos sopros dos dragões, que o legado deixa em inglês no meio do texto. */
const SOPROS = { 'Lightning Breath': 'Sopro de Relâmpago', 'Repulsion Breath': 'Sopro de Repulsão', 'Acid Breath': 'Sopro Ácido', 'Slowing Breath': 'Sopro de Lentidão', 'Cold Breath': 'Sopro Gélido', 'Paralyzing Breath': 'Sopro Paralisante', 'Fire Breath': 'Sopro de Fogo', 'Sleep Breath': 'Sopro Sonífero' };
const titulosDeSopro = (t) => t.replace(/(?<!\p{L})(Lightning|Repulsion|Acid|Slowing|Cold|Paralyzing|Fire|Sleep) Breath(?=\.)/gu, (m) => SOPROS[m]);

/** @param {{ frases: Record<string,string> }} memoria  @param {Set<string>} [faltantes] se informado, acumula em vez de lançar erro */
export function criarCompletador(memoria, faltantes) {
  return function completar(texto) {
    // O tradutor do legado quebra "alcance 5 ft. or range 20/60 ft., one target." em frases soltas; recompõe antes de traduzir.
    const t = titulosDeSopro(texto.replace(/alcance ([\d,]+) m\. Acerto: or range ([\d,]+)\/([\d,]+) m, one (target|creature)\. Hit:/g,
      // o legado converteu só o alcance longo ("20/18 m"): o primeiro número ficou em pés
      (_, a, curto, longo, alvo) => `alcance ${a} m ou distância ${(Number(curto.replace(',', '.')) * 0.3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/${longo} m, ${alvo === 'target' ? 'um alvo' : 'uma criatura'}. Acerto:`));
    const partes = frases(t);
    // primeiro trecho em inglês = início da "cauda"; o prefixo (já em português) fica como está
    const primeiro = partes.findIndex(([f]) => temIngles(f));
    if (primeiro < 0) return t;
    let saida = partes.slice(0, primeiro).map(([f, s]) => f + s).join('');
    for (const [f, sep] of partes.slice(primeiro)) {
      if (!temIngles(f)) { saida += f + sep; continue; }
      const numeros = f.match(NUMERO) ?? [];
      const chave = f.replace(NUMERO, '#');
      const pt = memoria.frases[chave];
      if (pt === undefined) { if (faltantes) { faltantes.add(chave); saida += f + sep; continue; } throw new Error(`Frase sem tradução cadastrada: "${chave}"`); }
      // {k} = k-ésimo número da frase original; {km} = o mesmo número lido como pés e convertido em metros (pés × 0,3)
      saida += pt.replace(/\{(\d+)(m?)\}/g, (_, k, m) => {
        const n = numeros[+k - 1]; if (n === undefined) throw new Error(`Marcador {${k}} sem número em "${chave}"`);
        return m ? (Number(n.replace(',', '.')) * 0.3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : n;
      }) + sep;
    }
    return saida;
  };
}

const metros = (n) => (Number(n.replace(',', '.')) * 0.3).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
/** Memória de substituição de texto inteiro: `traducoes-substituicoes.json` (chave = sha1 do original com números trocados por `#`). Devolve a tradução ou `undefined`. */
export function criarSubstituidor(memoria) {
  return function substituir(original) {
    const chave = createHash('sha1').update(original.replace(NUMERO, '#')).digest('hex').slice(0, 10);
    const entrada = memoria.textos[chave]; if (!entrada) return undefined;
    const numeros = original.match(NUMERO) ?? [];
    return entrada.t.replace(/\{(\d+)(m?)\}/g, (_, k, m) => { const n = numeros[+k - 1]; if (n === undefined) throw new Error(`Marcador {${k}} sem número (${chave})`); return m ? metros(n) : n; });
  };
}
