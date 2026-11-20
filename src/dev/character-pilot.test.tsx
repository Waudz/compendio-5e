// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import CharacterPilot from './character-pilot';
beforeEach(()=>localStorage.clear());
afterEach(()=>cleanup());
describe('local creator vertical slice',()=>{
 it('creates, levels, edits inventory, saves and reopens without a server',()=>{
  const view=render(<CharacterPilot/>);
  fireEvent.change(screen.getByLabelText('Nome do personagem'),{target:{value:'Dorna'}});
  fireEvent.change(screen.getByLabelText('fighter-style-1'),{target:{value:'defense'}});
  fireEvent.click(screen.getByLabelText('Perícia athletics'));
  fireEvent.click(screen.getByLabelText('Perícia perception'));
  fireEvent.change(screen.getByLabelText('Nível'),{target:{value:'4'}});
  expect(screen.getByText(/Escolhas pendentes:/).textContent).toContain('fighter-asi-4');
  fireEvent.change(screen.getByLabelText('fighter-archetype-3'),{target:{value:'champion'}});
  fireEvent.change(screen.getByLabelText('Melhoria de atributo'),{target:{value:'str-plus-two'}});
  expect(screen.getByText(/Força: 17/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Adicionar espada longa'}));
  fireEvent.click(screen.getByRole('button',{name:'Adicionar espada longa'}));
  expect(screen.getAllByText(/Espada longa · quantidade 1/)).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button',{name:/Adicionar quantidade/})[1]);
  expect(screen.getByText(/Espada longa · quantidade 2/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Salvar rascunho local'}));
  expect(screen.getByRole('status').textContent).toContain('Salvo');
  view.unmount();
  render(<CharacterPilot/>);
  expect((screen.getByLabelText('Nome do personagem') as HTMLInputElement).value).toBe('Dorna');
  expect(screen.getByText(/Força: 17/)).toBeTruthy();
  expect(screen.getByText(/Espada longa · quantidade 2/)).toBeTruthy();
 });
 it('keeps incomplete level-four choices as drafts instead of completed characters',()=>{
  render(<CharacterPilot/>);
  fireEvent.change(screen.getByLabelText('Nome do personagem'),{target:{value:'Dorna'}});
  fireEvent.change(screen.getByLabelText('Nível'),{target:{value:'4'}});
  expect(screen.getByRole('note').textContent).toContain('rascunho incompleto');
  fireEvent.click(screen.getByRole('button',{name:'Salvar rascunho local'}));
  expect(screen.getByRole('status').textContent).toContain('Rascunho incompleto salvo');
 });
 it('rejects incompatible or malformed persisted data without crashing',()=>{
  localStorage.setItem('compendio5e:dev:character-pilot:fighter-srd51-v2',JSON.stringify({
   schemaVersion:999,draft:{name:'Corrupted'}
  }));
  render(<CharacterPilot/>);
  expect((screen.getByLabelText('Nome do personagem') as HTMLInputElement).value).toBe('');
  cleanup();
  localStorage.setItem('compendio5e:dev:character-pilot:v1',JSON.stringify({
   schemaVersion:2,draft:{id:'broken',name:'Invalid',baseAbilities:{str:15},decisions:[],inventory:[],spentResources:{}}
  }));
  render(<CharacterPilot/>);
  expect((screen.getByLabelText('Nome do personagem') as HTMLInputElement).value).toBe('');
 });

 it('applies real Fighter level features and exposes resources in the calculated sheet',()=>{
  render(<CharacterPilot/>);
  fireEvent.change(screen.getByLabelText('Nome do personagem'),{target:{value:'Dorna'}});
  expect(screen.getByText(/Características:/).textContent).toContain('second-wind');
  expect(screen.getByText(/Recursos:/).textContent).toContain('second-wind 1/1');
  fireEvent.change(screen.getByLabelText('fighter-style-1'),{target:{value:'archery'}});
  fireEvent.click(screen.getByLabelText('Perícia athletics'));
  fireEvent.click(screen.getByLabelText('Perícia perception'));
  expect(screen.getByText(/Perícias:/).textContent).toContain('athletics');
  expect(screen.getByText(/Características:/).textContent).toContain('fighting-style-archery');
  fireEvent.change(screen.getByLabelText('Nível'),{target:{value:'3'}});
  expect(screen.getByText(/Características:/).textContent).toContain('action-surge');
  fireEvent.change(screen.getByLabelText('fighter-archetype-3'),{target:{value:'champion'}});
  expect(screen.getByText(/Características:/).textContent).toContain('champion-improved-critical');
  fireEvent.change(screen.getByLabelText('Nível'),{target:{value:'5'}});
  expect(screen.getByText(/Características:/).textContent).toContain('extra-attack-2');
 });

});
