/** Sistema "D&D 5e (2014)" do catálogo. Para suportar outro sistema de RPG: criar uma pasta irmã com seus dados, esquemas, rótulos e categorias e registrar um
 * `SistemaDef` (ver docs/CATALOGO-DND-2014.md, "Como adicionar outro sistema"). O Compêndio lê só `nucleo/` e este registro.
 */
import { categoriaOrigens, categoriaTalentos, categoriaRegras } from './categorias-consulta';
import { registrarSistema, sistema } from '../../nucleo/registro';
import type { SistemaDef } from '../../nucleo/tipos';
import { categoriaItens, categoriaMagias, categoriaMonstros } from './categorias';
import { categoriaClasses, categoriaSubclasses, categoriaRacas } from './categorias-personagem';

export const DND5E_2014 = 'dnd5e-2014';

export const sistemaDnd5e2014: SistemaDef = {
  id: DND5E_2014,
  nome: 'D&D 5e (regras de 2014)',
  fonte: {
    titulo: 'SRD 5.1 (2014)', licenca: 'CC BY 4.0',
    atribuicao: 'Este trabalho inclui material do System Reference Document 5.1 (SRD 5.1) de Wizards of the Coast LLC, disponível em https://dnd.wizards.com/resources/systems-reference-document e licenciado sob Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/legalcode). Texto traduzido para o português e adaptado pelo projeto; podem existir erros de tradução.',
  },
  categorias: [categoriaItens, categoriaMagias, categoriaMonstros, categoriaRacas, categoriaClasses, categoriaSubclasses, categoriaOrigens, categoriaTalentos, categoriaRegras] as never,
};

/** Registro idempotente: seguro chamar de vários lugares (o registro recusa duplicatas, então só registra se ainda não existir). */
export function garantirSistemaDnd5e2014(): SistemaDef {
  if (!sistema(DND5E_2014)) registrarSistema(sistemaDnd5e2014);
  return sistemaDnd5e2014;
}
export { categoriaItens, categoriaMagias, categoriaMonstros, categoriaRacas, categoriaClasses, categoriaSubclasses };
