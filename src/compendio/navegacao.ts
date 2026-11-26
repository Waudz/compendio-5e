import type { TabSpec } from '../workspace';
export const registroSpec=(id:string,title?:string):TabSpec=>({kind:'registro',ref:id,title});
export const identidadeSpec=(id:string,title?:string):TabSpec=>({kind:'identidade',ref:id,title});
export const monstroSpec=(id:string,title?:string):TabSpec=>({kind:'monstro',ref:id,title});
export function regraSpec(category:string,id:string,title?:string):TabSpec {
 const bytes=new TextEncoder().encode(id);let raw='';for(const b of bytes)raw+=String.fromCharCode(b);
 return {kind:'regra',ref:category+'--'+btoa(raw).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''),title};
}
export function lerRegra(ref:string){const i=ref.indexOf('--');if(i<1)return null;try{const raw=atob(ref.slice(i+2).replaceAll('-','+').replaceAll('_','/'));return {category:ref.slice(0,i),id:new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0)))};}catch{return null;}}
/** Páginas de consulta do Compêndio: o menu delas também oferece abrir como aba no próprio grupo. */
export const ehPaginaDoCompendio=(s:TabSpec)=>['registro','identidade','monstro','regra','item','magia'].includes(s.kind);
export const VOLTAR_COMPENDIO='compendio:voltar-categoria';
export function categoriaDoRegistro(category:string){return ({npc:'personagens',character:'personagens',location:'locais',organization:'organizacoes',discovery:'descobertas',item:'descobertas',monster:'monstros'} as Record<string,string>)[category]??category;}
