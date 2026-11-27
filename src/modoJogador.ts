import {createContext,useContext} from 'react';
/** Estado apenas de apresentação, independente da sessão e das permissões reais. */
export const PreviaJogadorContext=createContext({ativa:false,permitida:false,alternar(){}});
export const useModoJogador=()=>useContext(PreviaJogadorContext);
