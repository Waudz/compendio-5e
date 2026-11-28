// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {Modal} from './Modal';
import {MenuDeAcoes} from './MenuDeAcoes';
import {CartoesCategoria,FerramentasCategoria} from '../compendio/ComponentesCategoria';
afterEach(()=>{cleanup();vi.unstubAllGlobals();document.body.innerHTML='';});
beforeEach(()=>vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}})));
it('abrir formulário anuncia diálogo sem focar campo; Tab/Shift+Tab mantêm foco e Escape fecha',()=>{
 const close=vi.fn();render(<Modal titulo="Editar identidade" onFechar={close} acoes={<button>Salvar</button>}><label>Nome<input/></label></Modal>);
 const dialog=screen.getByRole('dialog'),save=screen.getByRole('button',{name:'Salvar'}),first=screen.getByRole('button',{name:'Fechar'});
 expect(document.activeElement).toBe(dialog);
 fireEvent.keyDown(dialog,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(save);
 fireEvent.keyDown(save,{key:'Tab'});expect(document.activeElement).toBe(first);
 fireEvent.keyDown(first,{key:'Escape'});expect(close).toHaveBeenCalledOnce();
});
it('fechar formulário não devolve foco a busca e não reabre teclado virtual',()=>{
 const input=document.createElement('input');document.body.append(input);input.focus();
 const {unmount}=render(<Modal titulo="Editar" onFechar={()=>{}}><input aria-label="Valor"/></Modal>);
 unmount();expect(document.activeElement).not.toBe(input);
});
it('menu sem ações não cria reticências; celular não oferece novas abas',()=>{
 render(<><MenuDeAcoes rotulo="Vazio" acoes={[]}/><CartoesCategoria rows={[{id:'a',title:'Registro público',category:'npc',subtitle:'',body:'',spec:{kind:'registro',ref:'a'}}]} view="grade" onOpen={()=>{}}/></>);
 expect(screen.queryByRole('button',{name:'Vazio'})).toBeNull();expect(screen.queryByRole('button',{name:'Ações de Registro público'})).toBeNull();
});
it('alternância lista/grade usa um controle e conserva busca e estado operacional',()=>{
 const change=vi.fn();render(<><FerramentasCategoria query="Lydia" onQuery={()=>{}} view="grade" onView={change} order="nome" onOrder={()=>{}}/><CartoesCategoria rows={[{id:'a',title:'Lydia',category:'character',subtitle:'Guerreira',body:'',estado:<span>PV 13/20</span>,spec:{kind:'identidade',ref:'a'}}]} view="grade" onOpen={()=>{}}/></>);
 fireEvent.click(screen.getByRole('button',{name:'Visualizar em lista'}));expect(change).toHaveBeenCalledWith('lista');
 expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('Lydia');expect(screen.getByText('PV 13/20')).toBeTruthy();
});
