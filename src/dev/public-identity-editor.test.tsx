// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import PublicIdentityEditor from './public-identity-editor';
afterEach(cleanup);
const source={name:'Elyra',surname:'Voss',race:'Tiefling',characterClass:'Feiticeira'};
describe('public identity editor',()=>{
 it('shows a public preview with no level, HP or inventory',()=>{
  const onSave=vi.fn();
  render(<PublicIdentityEditor source={source} onSave={onSave}/>);
  const preview=within(screen.getByRole('region',{name:'Prévia para outros jogadores'}));
  expect(preview.getByText('Elyra Voss')).toBeTruthy();
  expect(preview.getByText('Raça: Tiefling')).toBeTruthy();
  expect(preview.queryByText(/nível|inventário|PV/i)).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Salvar identidade pública'}));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({name:{mode:'real'},surname:{mode:'real'}}));
 });
 it('allows false name and race while hiding surname and class',()=>{
  const onSave=vi.fn();
  render(<PublicIdentityEditor source={source} onSave={onSave}/>);
  fireEvent.change(screen.getByLabelText('Visibilidade Nome'),{target:{value:'custom'}});
  fireEvent.change(screen.getByLabelText('Nome público'),{target:{value:'A Viajante'}});
  fireEvent.change(screen.getByLabelText('Visibilidade Sobrenome'),{target:{value:'hidden'}});
  fireEvent.change(screen.getByLabelText('Visibilidade Raça'),{target:{value:'custom'}});
  fireEvent.change(screen.getByLabelText('Raça público'),{target:{value:'Humana'}});
  fireEvent.change(screen.getByLabelText('Visibilidade Classe'),{target:{value:'hidden'}});
  fireEvent.change(screen.getByLabelText('Título público'),{target:{value:'Herdeira das Sombras'}});
  const preview=within(screen.getByRole('region',{name:'Prévia para outros jogadores'}));
  expect(preview.getByText('A Viajante')).toBeTruthy();
  expect(preview.getByText('Herdeira das Sombras')).toBeTruthy();
  expect(preview.getByText('Raça: Humana')).toBeTruthy();
  expect(preview.queryByText(/Elyra|Voss|Tiefling|Feiticeira/)).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Salvar identidade pública'}));
  expect(onSave.mock.calls[0][0].name).toEqual({mode:'custom',customValue:'A Viajante'});
 });
 it('supports postponing the configuration',()=>{
  const onSkip=vi.fn();
  render(<PublicIdentityEditor source={source} onSave={vi.fn()} onSkip={onSkip}/>);
  fireEvent.click(screen.getByRole('button',{name:'Configurar depois'}));
  expect(onSkip).toHaveBeenCalledOnce();
 });
});
