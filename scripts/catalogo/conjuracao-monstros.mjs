/** Tradutor das características de conjuração dos monstros (Spellcasting, Innate Spellcasting, Shared Spellcasting).
 *  Produz o texto em português e a lista de magias citadas (ids do catálogo de magias), para que a ficha ligue cada magia ao seu detalhe.
 *  Qualquer frase ou nome de magia que não seja reconhecido FAZ O BUILD FALHAR (nada é adivinhado). */

const ATRIBUTO = { strength: 'Força', dexterity: 'Destreza', constitution: 'Constituição', intelligence: 'Inteligência', wisdom: 'Sabedoria', charisma: 'Carisma' };
const CLASSE = { cleric: 'clérigo', wizard: 'mago', druid: 'druida', bard: 'bardo', sorcerer: 'feiticeiro', warlock: 'bruxo', paladin: 'paladino', ranger: 'patrulheiro' };
const COMPONENTES = { 'no material components': 'sem precisar de componentes materiais', 'only verbal components': 'precisando apenas de componentes verbais', 'no components': 'sem precisar de componentes' };
/** Observações entre parênteses ao lado do nome de uma magia (conjunto fechado). */
const OBSERVACAO = {
  'self only': 'apenas em si mesma', 'can create wine instead of water': 'pode criar vinho em vez de água', 'air elemental only': 'apenas elemental do ar',
  'fire elemental only': 'apenas elemental do fogo', 'any humanoid form': 'qualquer forma humanoide',
};
/** Nomes de magia do texto do monstro que diferem do nome da API (minúsculas). */
const ALIAS = { 'eye bite': 'eyebite' };
/** Magias citadas por monstros do SRD que NÃO estão no catálogo de magias do SRD 5.1 (sem ligação): nome em português do Livro do Jogador. */
const FORA_DO_CATALOGO = { 'ray of sickness': 'raio nauseante' };

const espacos = (n) => `${n} espaço${n > 1 ? 's' : ''}`;

/** @param {{id:string,en:string,nome:string}[]} magias catálogo de magias */
export function criarTradutorConjuracao(magias) {
  const porNome = new Map(magias.map((m) => [m.en.toLowerCase(), m]));
  const achar = (nomeEn) => { const k = nomeEn.trim().toLowerCase(); const m = porNome.get(ALIAS[k] ?? k); if (!m) throw new Error(`Magia desconhecida em conjuração de monstro: "${nomeEn}"`); return m; };

  /** Lista "a, b (obs), c" -> texto pt; acumula {id,nome}. */
  function lista(itens, citadas) {
    return itens.split(/,\s*/).map((x) => {
      const m = x.trim().match(/^([^()]+?)(?:\s*\(([^)]+)\))?$/);
      if (!m) throw new Error(`Item de lista de magias ilegível: "${x}"`);
      const foraDoCatalogo = FORA_DO_CATALOGO[m[1].trim().toLowerCase()];
      const magia = foraDoCatalogo ? null : achar(m[1]); const nome = foraDoCatalogo ?? magia.nome.toLowerCase();
      if (magia) citadas.push({ id: magia.id, nome });
      if (!m[2]) return nome;
      const obs = OBSERVACAO[m[2].toLowerCase()]; if (!obs) throw new Error(`Observação de magia desconhecida: "${m[2]}"`);
      return `${nome} (${obs})`;
    }).join(', ');
  }

  function linha(ln, citadas) {
    let m;
    if ((m = ln.match(/^Cantrips \(at will\):\s*(.+)$/i))) return `Truques (à vontade): ${lista(m[1], citadas)}`;
    if ((m = ln.match(/^(\d+)(?:st|nd|rd|th) level \((\d+) slots?\):\s*(.+)$/i))) return `${m[1]}º círculo (${espacos(+m[2])}): ${lista(m[3], citadas)}`;
    if ((m = ln.match(/^At will:\s*(.+)$/i))) return `À vontade: ${lista(m[1], citadas)}`;
    if ((m = ln.match(/^(\d+)\/day( each)?:\s*(.+)$/i))) return `${m[1]}/dia${m[2] ? ' cada' : ''}: ${lista(m[3], citadas)}`;
    return null;
  }

  const dc = (s) => s.replace(/spell save DC/gi, 'CD de resistência de magia').replace(/to hit with spell attacks/gi, 'para atingir com ataques de magia');
  const comp = (c) => { const r = COMPONENTES[c.toLowerCase()]; if (!r) throw new Error(`Componentes desconhecidos: "${c}"`); return r; };

  /** Traduz o parágrafo de abertura (sentenças em inglês) e devolve texto pt; falha se sobrar inglês. */
  function abertura(p, citadas) {
    let s = p.replace(/\s+/g, ' ').trim(), m, out = [];
    const sent = (re, f) => { const r = s.match(re); if (!r) return false; out.push(f(r)); s = s.slice(r[0].length).trim(); return true; };
    // 1) "The X is a Nth-level spellcaster."
    sent(/^(?:The [^.]+? is an? )(\d+)(?:st|nd|rd|th)-level spellcaster\.\s*/i, (r) => `A criatura é um conjurador de ${r[1]}º nível.`);
    // 2) habilidade de conjuração
    sent(/^(?:(?:Its|His|Her|Their) |The [\w' -]+?'s )?(innate )?spell ?casting ability is (\w+)(?: \(([^)]*)\))?(?:, and it needs only verbal components to cast its spells)?\.\s*/i,
      (r) => { const a = ATRIBUTO[r[2].toLowerCase()]; if (!a) throw new Error(`Atributo desconhecido: ${r[2]}`);
        return `Seu atributo de conjuração${r[1] ? ' inata' : ''} é ${a}${r[3] ? ` (${dc(r[3])})` : ''}${/needs only verbal/i.test(r[0]) ? ', e precisa apenas de componentes verbais para conjurar suas magias' : ''}.`; });
    sent(/^It requires no material components to cast its spells\.\s*/i, () => 'Não precisa de componentes materiais para conjurar suas magias.');
    // 3) "can innately cast the following spells, requiring X components[:.]"
    if ((m = s.match(/^(?:It|She|He|They|The [\w' -]+?) can innately cast the following spells, requiring ([\w ]+?) components[:.]?$/i))) { out.push(`Pode conjurar inatamente as seguintes magias, ${comp(m[1] + ' components')}:`); s = ''; }
    // 4) "The X (has|have) [the] following CLASS spells prepared:"  (opcional "can cast A and B at will and")
    else if ((m = s.match(/^(?:The [\w' -]+? can cast ([^.]+?) at will and has|(?:The [\w' -]+?|It) has) (?:the )?following (\w+) spells prepared:?$/i))) {
      const c = CLASSE[m[2].toLowerCase()]; if (!c) throw new Error(`Classe desconhecida: ${m[2]}`);
      if (m[1]) { const partes = m[1].split(/ and |, /).map((x) => lista(x, citadas)); out.push(`Pode conjurar ${partes.join(' e ')} à vontade e tem as seguintes magias de ${c} preparadas:`); }
      else out.push(`Tem as seguintes magias de ${c} preparadas:`);
      s = '';
    }
    if (s) throw new Error(`Frase de conjuração não reconhecida: "${s}"`);
    return out.join(' ');
  }

  const COVEN_ABERTURA = /^While all three members of a hag coven are within 30 feet of one another, they can each cast the following spells from the wizard's spell list but must share the spell slots among themselves:$/;
  const COVEN_FIM = /^For casting these spells, each hag is a 12th-level spellcaster that uses Intelligence as her spellcasting ability\. The spell save DC is 12\+the hag's Intelligence modifier, and the spell attack bonus is 4\+the hag's Intelligence modifier\.$/;
  const ARCHMAGE_FIM = /^The archmage casts these spells on itself before combat\.$/;

  /** @returns {{ t: string, magias: {id:string,nome:string}[] }} */
  return function traduzir(en) {
    const citadas = [];
    const paragrafos = en.replace(/\r/g, '').split(/\n/).map((x) => x.trim().replace(/^[-•]\s*/, '')).filter(Boolean);
    const saida = paragrafos.map((p, i) => {
      if (COVEN_ABERTURA.test(p)) return 'Enquanto os três membros de um clã de bruxas estiverem a até 9 metros uns dos outros, cada uma pode conjurar as seguintes magias da lista de magias de mago, mas devem dividir os espaços de magia entre si:';
      if (COVEN_FIM.test(p)) return 'Para conjurar essas magias, cada bruxa é uma conjuradora de 12º nível que usa Inteligência como atributo de conjuração. A CD de resistência de magia é 12 + o modificador de Inteligência da bruxa, e o bônus de ataque de magia é 4 + o modificador de Inteligência da bruxa.';
      if (ARCHMAGE_FIM.test(p)) return 'A criatura conjura essas magias em si mesma antes do combate.';
      const l = linha(p, citadas); if (l) return l;
      // mefite: "The mephit can innately cast _fog cloud_[ (spell save DC 10)], requiring no material components. Its innate spellcasting ability is Charisma."
      const mef = p.match(/^The mephit can innately cast _([^_]+)_(?: \(([^)]*)\))?, requiring (no material) components\. Its innate spellcasting ability is (\w+)\.$/i);
      if (mef) { const magia = achar(mef[1]); citadas.push({ id: magia.id, nome: magia.nome.toLowerCase() });
        return `Pode conjurar inatamente ${magia.nome.toLowerCase()}${mef[2] ? ` (${dc(mef[2])})` : ''}, ${comp(mef[3] + ' components')}. Seu atributo de conjuração inata é ${ATRIBUTO[mef[4].toLowerCase()]}.`; }
      return abertura(p, citadas);
    });
    const unicas = [...new Map(citadas.map((c) => [c.id, c])).values()];
    if (!unicas.length) throw new Error('Conjuração sem nenhuma magia reconhecida');
    const t = saida.join('\n');
      // nomes de magia em português podem conter palavras que coincidem; só acusa inglês fora das linhas de lista
    const semListas = saida.filter((x) => !/^(Truques|\d+º círculo|À vontade|\d+\/dia)/.test(x)).join('\n');
      if (/\b(the|spell save|slots?|at will|requiring|components?|prepared|following)\b/i.test(semListas)) throw new Error(`Inglês remanescente em conjuração: "${semListas}"`);
    return { t, magias: unicas };
  };
}
