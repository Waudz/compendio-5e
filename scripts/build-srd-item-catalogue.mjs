#!/usr/bin/env node
/** Gera `src/catalogue/data/srd-2014-items.json` a partir do arquivo de itens do projeto legado (Compêndio 1.0).
 * Execução manual e reprodutível; nada é gravado fora do arquivo de saída e nada é publicado.
 *
 * Uso: node scripts/build-srd-item-catalogue.mjs <caminho/itens-srd2014.json> [saida]
 *
 * O que muda em relação ao legado: IDs perdem o prefixo `srd51:item/` (a fonte passa a ser o `sourceId`
 * do catálogo), ganchos de automação do legado (`efeitos`) são descartados e a lista fica ordenada por ID.
 * A validação de verdade é feita por `src/catalogue/item-schema.ts` (Zod) nos testes e no carregamento.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const [entrada, saidaArg = 'src/catalogue/data/srd-2014-items.json'] = process.argv.slice(2);
if (!entrada) { console.error('Uso: node scripts/build-srd-item-catalogue.mjs <itens-srd2014.json> [saida]'); process.exit(1); }

const prefixo = 'srd51:item/';
const semPrefixo = (id) => {
  if (typeof id !== 'string' || !id.startsWith(prefixo)) throw new Error('ID fora do padrão do legado: ' + id);
  return id.slice(prefixo.length);
};

const bruto = JSON.parse(await readFile(resolve(entrada), 'utf8'));
if (!Array.isArray(bruto.itens)) throw new Error('Arquivo sem lista de itens');

const itens = bruto.itens.map((item) => {
  const { id, efeitos: _efeitos, alias, pacote, ...resto } = item;
  const saida = { id: semPrefixo(id), ...resto };
  if (alias) saida.alias = alias.map(semPrefixo);
  if (pacote) saida.pacote = pacote.map((c) => ({ id: semPrefixo(c.id), qtd: c.qtd }));
  return saida;
}).sort((a, b) => a.id.localeCompare(b.id));

const conteudo = JSON.stringify(itens);
const documento = {
  schemaVersion: 1,
  revision: '1',
  source: {
    id: 'srd-2014',
    title: 'SRD 5.1 (2014)',
    license: 'CC BY 4.0',
    attribution: 'Este trabalho inclui material do System Reference Document 5.1 (SRD 5.1) de Wizards of the Coast LLC, disponível em https://dnd.wizards.com/resources/systems-reference-document e licenciado sob Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/legalcode). Nomes em português e estrutura de dados adaptados do Compêndio 1.0 e do HeroQuill (MIT).',
  },
  provenance: { legacyFile: 'dados/itens-srd2014.json', legacyVersion: bruto.versao ?? null, legacySource: bruto.fonte ?? null },
  count: itens.length,
  sha256: createHash('sha256').update(conteudo).digest('hex'),
  items: itens,
};
await writeFile(resolve(saidaArg), JSON.stringify(documento, null, 1) + '\n');
console.log(JSON.stringify({ saida: resolve(saidaArg), count: itens.length, sha256: documento.sha256 }, null, 2));
