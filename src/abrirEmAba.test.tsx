// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {AbrirEmAbaContext,OrigemAbaContext,useAbrirEmAba} from './abrirEmAba';
afterEach(cleanup);
it('Ctrl/Cmd e botão do meio abrem na origem; clique comum preserva navegação local',()=>{
 const abrir=vi.fn(),mostrar=vi.fn(),normal=vi.fn();
 function Link(){const a=useAbrirEmAba(),s={kind:'item' as const,ref:'dagger'};return <button onClick={e=>{if(!a.aoClicar(e,s))normal();}} onAuxClick={e=>a.aoBotaoDoMeio(e,s)} onContextMenu={e=>a.aoClicarDireito(e,s)}>Consultar</button>;}
 render(<AbrirEmAbaContext.Provider value={{abrir,mostrar}}><OrigemAbaContext.Provider value="origem"><Link/></OrigemAbaContext.Provider></AbrirEmAbaContext.Provider>);
 const link=screen.getByRole('button',{name:'Consultar'});
 fireEvent.click(link);expect(normal).toHaveBeenCalledTimes(1);expect(abrir).not.toHaveBeenCalled();
 fireEvent.click(link,{ctrlKey:true});fireEvent.click(link,{metaKey:true});
 link.dispatchEvent(new MouseEvent('auxclick',{button:1,bubbles:true,cancelable:true}));
 expect(abrir).toHaveBeenCalledTimes(3);expect(abrir).toHaveBeenLastCalledWith({kind:'item',ref:'dagger'},'origem');
 fireEvent.contextMenu(link,{clientX:12,clientY:24});expect(mostrar).toHaveBeenCalledWith(12,24,{kind:'item',ref:'dagger'},'origem');
});
