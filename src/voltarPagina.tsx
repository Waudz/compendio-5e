import {createContext} from 'react';
/** Mobile usa o histórico existente; desktop ativa a lista sem destruir a aba de detalhe. */
export const VoltarPaginaContext=createContext<(()=>void)|undefined>(undefined);
