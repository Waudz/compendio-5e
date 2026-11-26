// Gera `src/catalogue/data/imagens-v1.json`: associa ao catálogo do 2.0 as imagens que o responsável cadastrou no Compêndio 1.0.
// NÃO baixa, copia, altera nem apaga arquivos: guarda apenas as associações (que apontam para os arquivos originais).
// Entrada: a listagem PÚBLICA do 1.0 (resposta da função `catalogo_imagens_publicas`, a mesma que o site 1.0 usa para visitantes),
// salva em um arquivo. Uso: node scripts/catalogo/mapear-imagens-v1.mjs <listagem.json> [AAAA-MM-DD]
import { readFileSync, writeFileSync } from 'node:fs';

const [entrada, data = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
if (!entrada) { console.error('Informe o arquivo com a listagem pública do 1.0.'); process.exit(1); }
const ler = c => JSON.parse(readFileSync(new URL(c, import.meta.url), 'utf8'));
const lista = JSON.parse(readFileSync(entrada, 'utf8'));
const itens = ler('../../src/catalogue/data/srd-2014-items.json').items;
const personagem = ler('../../src/criador/data/character-2014.json');
const monstros = ler('../../src/catalogue/sistemas/dnd5e-2014/data/monstros.json').itens;

const CAMINHO = /^(itens|monstros)\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const simples = s => String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
const porChave = (colecao, chaves) => { const m = new Map(); for (const x of colecao) for (const k of chaves(x)) if (k && !m.has(simples(k))) m.set(simples(k), x.id); return m; };
const idItem = porChave(itens, i => [i.id, ...(i.alias ?? []), i.en]);
const idMonstro = porChave(monstros, m => [m.id, ...(m.idsAnteriores ?? []), m.nomeIngles ?? m.en]);

const saida = { itens: {}, monstros: {} }, semCorrespondencia = [], removidas = [];
for (const r of lista) {
  if (!r.imagem) { removidas.push({ tipo: r.tipo, chave: r.chave }); continue; }
  if (!CAMINHO.test(r.imagem)) { semCorrespondencia.push({ ...r, motivo: 'caminho em formato inesperado' }); continue; }
  let id;
  if (r.tipo === 'item') {
    const curta = r.chave.replace(/^srd51:item\//, '');
    id = personagem.itemIds[r.chave] ?? idItem.get(simples(curta));
  } else id = idMonstro.get(simples(r.chave.replace(/^srd_/, '')));
  const alvo = r.tipo === 'item' ? saida.itens : saida.monstros;
  if (!id || (r.tipo === 'item' && !itens.some(i => i.id === id))) semCorrespondencia.push({ tipo: r.tipo, chave: r.chave, imagem: r.imagem });
  else if (alvo[id]) semCorrespondencia.push({ tipo: r.tipo, chave: r.chave, imagem: r.imagem, motivo: `o id ${id} já tem imagem` });
  else alvo[id] = { chaveV1: r.chave, caminho: r.imagem };
}
// Fotos publicadas no próprio site 1.0 (pasta `fotos/` do repositório): valem para o monstro que não tem imagem no catálogo global.
for (const chave of ['srd_adult-gold-dragon', 'srd_bugbear', 'srd_goblin', 'srd_hobgoblin']) {
  const id = idMonstro.get(simples(chave.replace(/^srd_/, '')));
  if (id && !saida.monstros[id] && !lista.some(r => r.chave === chave)) saida.monstros[id] = { chaveV1: chave, url: `https://waudz.github.io/rastreador-dnd/fotos/${chave}.jpg` };
}
const ordenar = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(new URL('../../src/catalogue/data/imagens-v1.json', import.meta.url), JSON.stringify({
  origem: 'Compêndio 1.0: bucket público "catalogos" e função catalogo_imagens_publicas()',
  base: 'https://pdjzahpxjrlbqqtzkfdr.supabase.co/storage/v1/object/public/catalogos/',
  consultadoEm: data, itens: ordenar(saida.itens), monstros: ordenar(saida.monstros), semCorrespondencia, removidasNo1: removidas,
}, null, 1) + '\n');
console.log(`itens: ${Object.keys(saida.itens).length}; monstros: ${Object.keys(saida.monstros).length}; sem correspondência: ${semCorrespondencia.length}; removidas no 1.0: ${removidas.length}`);
for (const s of semCorrespondencia) console.log('  sem correspondência:', s.tipo, s.chave, s.motivo ?? '');
