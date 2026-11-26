// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {UnsavedContext,useUnsavedGuard,useUnsavedRegistry} from './unsaved';
import {OrigemAbaContext} from './abrirEmAba';
afterEach(cleanup);
it('guardas de editores seguem a aba real sem sobrescrever o outro editor',()=>{
 const closed=vi.fn();
 function Editor({dirty}:{dirty:boolean}){useUnsavedGuard('criador:personagem',dirty);return null;}
 function Workspace(){const registry=useUnsavedRegistry(()=> 'Aba atual');return <UnsavedContext.Provider value={registry.api}><OrigemAbaContext.Provider value="secao:personagens"><Editor dirty/><Editor dirty={false}/></OrigemAbaContext.Provider><button onClick={()=>registry.api.guard(['secao:personagens'],closed)}>Fechar</button>{registry.dialog}</UnsavedContext.Provider>;}
 render(<Workspace/>);fireEvent.click(screen.getByRole('button',{name:'Fechar'}));
 expect(screen.getByRole('alertdialog')).toBeTruthy();expect(closed).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(closed).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Fechar'}));fireEvent.click(screen.getByRole('button',{name:'Descartar alterações'}));expect(closed).toHaveBeenCalledTimes(1);
});
