// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import PublicIdentityEditor from './identidade-publica-editor';
afterEach(cleanup);
const source={name:'Elyra Voss',alias:'A Andarilha',race:'Tiefling',characterClass:'Feiticeira',portrait:'https://exemplo.com/r.png'};
const previa=()=>within(screen.getByRole('region',{name:'Prévia para outros jogadores'}));
describe('editor da identidade pública',()=>{
 it('sem personalizar, mostra os campos da ficha, o retrato dela e nenhum dado privado',()=>{
  const onSave=vi.fn();
  const {container}=render(<PublicIdentityEditor source={source} onSave={onSave}/>);
  expect(previa().getByText('Elyra Voss')).toBeTruthy();
  expect(previa().getByText('A Andarilha').tagName).toBe('EM');
  expect(previa().getByText('Tiefling · Feiticeira')).toBeTruthy();
  expect(previa().queryByText(/nível|inventário|PV/i)).toBeNull();
  expect(container.querySelector('img')?.getAttribute('src')).toBe(source.portrait);
  fireEvent.click(screen.getByRole('button',{name:'Salvar identidade pública'}));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({name:{mode:'sheet'},alias:{mode:'sheet'}}));
 });
 it('personaliza nome e raça e oculta a classe sem revelar os valores da ficha na prévia',()=>{
  const onSave=vi.fn();
  render(<PublicIdentityEditor source={source} onSave={onSave}/>);
  fireEvent.change(screen.getByLabelText('Visibilidade Nome'),{target:{value:'custom'}});
  fireEvent.change(screen.getByLabelText('Nome público'),{target:{value:'A Viajante'}});
  fireEvent.change(screen.getByLabelText('Visibilidade Alcunha'),{target:{value:'hidden'}});
  fireEvent.change(screen.getByLabelText('Visibilidade Raça'),{target:{value:'custom'}});
  fireEvent.change(screen.getByLabelText('Raça pública'),{target:{value:'Humana'}});
  fireEvent.change(screen.getByLabelText('Visibilidade Classe'),{target:{value:'hidden'}});
  expect(previa().getByText('A Viajante')).toBeTruthy();
  expect(previa().getByText('Humana')).toBeTruthy();
  expect(previa().queryByText(/Elyra|Andarilha|Tiefling|Feiticeira/)).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Salvar identidade pública'}));
  expect(onSave.mock.calls[0][0].name).toEqual({mode:'custom',value:'A Viajante'});
 });
 it('exige ao menos o nome ou a alcunha; só a alcunha fica em destaque',()=>{
  render(<PublicIdentityEditor source={source} onSave={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('Visibilidade Nome'),{target:{value:'hidden'}});
  expect(previa().getByText('A Andarilha').tagName).not.toBe('EM');
  fireEvent.change(screen.getByLabelText('Visibilidade Alcunha'),{target:{value:'hidden'}});
  expect(screen.getByRole('alert').textContent).toMatch(/nome ou a alcunha/);
  expect((screen.getByRole('button',{name:'Salvar identidade pública'}) as HTMLButtonElement).disabled).toBe(true);
 });
 it('permite deixar a configuração para depois',()=>{
  const onSkip=vi.fn();
  render(<PublicIdentityEditor source={source} onSave={vi.fn()} onSkip={onSkip}/>);
  fireEvent.click(screen.getByRole('button',{name:'Configurar depois'}));
  expect(onSkip).toHaveBeenCalledOnce();
 });
});
