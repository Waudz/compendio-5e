// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {pesquisarRegistros,SeletorRegistro} from './SeletorRegistro';
import type {LinhaCompendio} from './consulta';
afterEach(cleanup);
const row=(id:string,title:string,category='location'):LinhaCompendio=>({id,title,category,subtitle:'',body:'conteúdo privado fora da pesquisa de nomes',spec:{kind:'registro',ref:id}});
const rows=[row('j','Julkoun'),row('a','Aldren','npc')];
it('pesquisa nomes e categorias sem acentos ou diferença de caixa',()=>{
 expect(pesquisarRegistros(rows,'JÚLKOÙN locais').map(r=>r.id)).toEqual(['j']);
 expect(pesquisarRegistros(rows,'NPC ÁLDRÉN').map(r=>r.id)).toEqual(['a']);
 expect(pesquisarRegistros(rows,'conteúdo privado')).toEqual([]);
});
it('resultados diretos mostram nome/categoria e selecionam somente o ID',()=>{
 const select=vi.fn();render(<SeletorRegistro rows={rows} selected="" query="" onQuery={()=>{}} onSelect={select}/>);
 expect(screen.queryByRole('combobox')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Aldren NPC'}));expect(select).toHaveBeenCalledWith('a');
 expect(screen.getByRole('button',{name:'Julkoun Local'})).toBeTruthy();
});
it('mantém seleção explícita quando consulta muda e permite limpá-la',()=>{
 const select=vi.fn();render(<SeletorRegistro rows={rows} selected="a" query="julkoun" onQuery={()=>{}} onSelect={select}/>);
 expect(screen.getByText('Selecionado:')).toBeTruthy();expect(screen.getByText('Aldren')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Limpar seleção'}));expect(select).toHaveBeenCalledWith('');
});
it('carregamento e falha não são apresentados como ausência de registros',()=>{
 const props={rows:[],selected:'',query:'',onQuery:()=>{},onSelect:()=>{}};
 const view=render(<SeletorRegistro {...props} loading/>);expect(screen.getByRole('status').textContent).toContain('Carregando');expect(screen.queryByText(/Nenhum registro/)).toBeNull();
 view.rerender(<SeletorRegistro {...props} error="Falha de conexão"/>);expect(screen.getByRole('alert').textContent).toBe('Falha de conexão');expect(screen.queryByText(/Nenhum registro/)).toBeNull();
});
