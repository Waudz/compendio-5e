// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import PublicIdentityEditor from './identidade-publica-editor';
afterEach(cleanup);
const source={name:'Elyra Voss',alias:'A Andarilha',race:'Tiefling',characterClass:'Feiticeira',level:'9',portrait:'https://exemplo.com/r.png'};
const previa=()=>within(screen.getByRole('region',{name:'Prévia para outros jogadores'}));
describe('editor da identidade pública',()=>{
 it('sem personalizar, mostra os campos da ficha, o retrato dela e nenhum dado privado',()=>{
  const onChange=vi.fn();
  const {container}=render(<PublicIdentityEditor source={source} onChange={onChange}/>);
  expect(previa().getByText('Elyra Voss')).toBeTruthy();
  expect(previa().getByText('A Andarilha').tagName).toBe('EM');
  expect(previa().getByText('Tiefling · Feiticeira · Nível 9')).toBeTruthy();
  expect(previa().queryByText(/inventário|PV/i)).toBeNull();
  expect(screen.queryByRole('checkbox',{name:/Publicar/})).toBeNull();
  expect(container.querySelector('img')?.getAttribute('src')).toBe(source.portrait);
  fireEvent.change(screen.getByLabelText('Visibilidade Nível'),{target:{value:'hidden'}});
  expect(previa().queryByText(/Nível/)).toBeNull();
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({name:{mode:'sheet'},alias:{mode:'sheet'},level:{mode:'hidden',value:undefined}}));
 });
 it('personaliza nome e raça e oculta a classe sem revelar os valores da ficha na prévia',()=>{
  const onChange=vi.fn();
  render(<PublicIdentityEditor source={source} onChange={onChange}/>);
  fireEvent.change(screen.getByLabelText('Visibilidade Nome'),{target:{value:'custom'}});
  fireEvent.change(screen.getByLabelText('Nome público'),{target:{value:'A Viajante'}});
  fireEvent.change(screen.getByLabelText('Visibilidade Alcunha'),{target:{value:'hidden'}});
  fireEvent.change(screen.getByLabelText('Visibilidade Raça'),{target:{value:'custom'}});
  fireEvent.change(screen.getByLabelText('Raça pública'),{target:{value:'Humana'}});
  fireEvent.change(screen.getByLabelText('Visibilidade Classe'),{target:{value:'hidden'}});
  expect(previa().getByText('A Viajante')).toBeTruthy();
  expect(previa().getByText('Humana · Nível 9')).toBeTruthy();
  expect(previa().queryByText(/Elyra|Andarilha|Tiefling|Feiticeira/)).toBeNull();
  expect(onChange.mock.lastCall![0].name).toEqual({mode:'custom',value:'A Viajante'});
 });
 it('exige ao menos o nome ou a alcunha; só a alcunha fica em destaque',()=>{
  render(<PublicIdentityEditor source={source} onChange={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('Visibilidade Nome'),{target:{value:'hidden'}});
  expect(previa().getByText('A Andarilha').tagName).not.toBe('EM');
  fireEvent.change(screen.getByLabelText('Visibilidade Alcunha'),{target:{value:'hidden'}});
  expect(screen.getByRole('alert').textContent).toMatch(/nome ou a alcunha/);
 });
 it('permite deixar a configuração para depois',()=>{
  const onSkip=vi.fn();
  render(<PublicIdentityEditor source={source} onChange={vi.fn()} onSkip={onSkip}/>);
  fireEvent.click(screen.getByRole('button',{name:'Configurar depois'}));
  expect(onSkip).toHaveBeenCalledOnce();
 });
});
