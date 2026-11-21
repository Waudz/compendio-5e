// @vitest-environment jsdom
import {afterEach,describe,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import CompendiumPilot from './compendium-pilot';
import {criadorRules} from '../criador/catalogo-criador';
afterEach(()=>cleanup());
describe('Compendium browser pilot',()=>{
 it('switches list/grid, searches accents, filters types and opens stable IDs',()=>{
  render(<CompendiumPilot/>);
  const list=screen.getByRole('list',{name:'Resultados do compêndio'});
  expect(within(list).getAllByRole('listitem')).toHaveLength(criadorRules.registry.entries.length);
  fireEvent.click(screen.getByLabelText('Grade'));
  expect(list.getAttribute('data-view')).toBe('grid');
  fireEvent.change(screen.getByLabelText('Pesquisar no compêndio'),{target:{value:'anao'}});
  expect(within(list).getByRole('button',{name:'Abrir Anão'})).toBeTruthy();   // a busca sem acento também pode achar itens (ex.: Anão em nomes de itens)
  fireEvent.click(screen.getByRole('button',{name:'Abrir Anão'}));
  expect(screen.getByText('srd-2014:race:dwarf:1')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Pesquisar no compêndio'),{target:{value:''}});
  fireEvent.change(screen.getByLabelText('Filtrar por tipo'),{target:{value:'item'}});
  expect(within(list).getAllByRole('listitem')).toHaveLength(criadorRules.registry.entries.filter(entry=>entry.ref.kind==='item').length);
  expect(within(list).getByRole('button',{name:'Abrir Espada longa'})).toBeTruthy();
 });
});
