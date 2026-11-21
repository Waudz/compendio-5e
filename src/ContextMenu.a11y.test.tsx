// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { ContextMenu } from './ContextMenu';
afterEach(cleanup);
function Fixture(){
 const [open,setOpen]=useState(false), close=useCallback(()=>setOpen(false),[]);
 return <><button onClick={()=>setOpen(true)}>Abrir</button>{open&&<ContextMenu menu={{x:10,y:10,items:[
  {label:'Primeiro',onSelect:close},{label:'Desabilitado',onSelect:close,disabled:true},{label:'Último',onSelect:close}
 ]}} onClose={close}/>}</>;
}
function open(){render(<Fixture/>);const trigger=screen.getByRole('button',{name:'Abrir'});trigger.focus();fireEvent.click(trigger);return trigger;}
describe('acessibilidade do menu contextual',()=>{
 it('setas pulam desabilitados e circulam entre os itens',()=>{
  open();const first=screen.getByRole('menuitem',{name:'Primeiro'}),last=screen.getByRole('menuitem',{name:'Último'});
  expect(document.activeElement).toBe(first);fireEvent.keyDown(first,{key:'ArrowDown'});expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last,{key:'ArrowDown'});expect(document.activeElement).toBe(first);
 });
 it('Home, End e ArrowUp preservam a ordem dos itens habilitados',()=>{
  open();const first=screen.getByRole('menuitem',{name:'Primeiro'}),last=screen.getByRole('menuitem',{name:'Último'});
  fireEvent.keyDown(first,{key:'End'});expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last,{key:'Home'});expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first,{key:'ArrowUp'});expect(document.activeElement).toBe(last);
 });
 it('Escape fecha e restaura o foco no acionador',()=>{
  const trigger=open();fireEvent.keyDown(screen.getByRole('menu'),{key:'Escape'});
  expect(screen.queryByRole('menu')).toBeNull();expect(document.activeElement).toBe(trigger);
 });
});

function MenuParaDialogo() {
 const [menu,setMenu]=useState(false), [dialog,setDialog]=useState(false);
 const close=useCallback(()=>setMenu(false),[]);
 return <><button onClick={()=>setMenu(true)}>Abrir opções</button>
  {menu&&<ContextMenu menu={{x:10,y:10,items:[{label:'Fechar ficha',onSelect:()=>setDialog(true)}]}} onClose={close}/>}
  {dialog&&<div role="alertdialog" aria-label="Alterações não salvas"><button autoFocus>Cancelar</button></div>}
 </>;
}
it('não retira o foco do diálogo aberto pela ação do menu',()=>{
 render(<MenuParaDialogo/>);const trigger=screen.getByRole('button',{name:'Abrir opções'});
 trigger.focus();fireEvent.click(trigger);
 fireEvent.click(screen.getByRole('menuitem',{name:'Fechar ficha'}));
 expect(screen.queryByRole('menu')).toBeNull();
 expect(document.activeElement).toBe(screen.getByRole('button',{name:'Cancelar'}));
});
