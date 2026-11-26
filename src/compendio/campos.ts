/** Campos narrativos opcionais; vínculos mecânicos usam IDs na tabela de relações. */
export const CAMPOS:Record<string,{id:string;label:string;long?:boolean}[]>={
 npc:[{id:'nickname',label:'Alcunha'},{id:'identity',label:'Identidade e informações básicas'},{id:'region',label:'Origem ou residência'},{id:'history',label:'História',long:true},{id:'personality',label:'Personalidade',long:true},{id:'relationships',label:'Observações sobre relações',long:true}],
 location:[{id:'region',label:'Região'},{id:'map',label:'Mapa (referência)'},{id:'identity',label:'Habitantes'},{id:'history',label:'História',long:true}],
 organization:[{id:'nickname',label:'Sigla ou alcunha'},{id:'identity',label:'Informações básicas'},{id:'history',label:'História',long:true},{id:'objectives',label:'Objetivos',long:true}],
 discovery:[{id:'type',label:'Tipo (carta, mapa, livro, artefato…)'},{id:'origin',label:'Origem'},{id:'history',label:'Contexto',long:true}],
 item:[{id:'origin',label:'Origem'},{id:'history',label:'História desta descoberta',long:true}],monster:[],
};
