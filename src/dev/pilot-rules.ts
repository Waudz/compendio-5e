/** Shared illustrative catalogue for development pilots only. Not certified SRD data. */
import type {RulesCatalogue} from '../rules/rules-catalogue';
export const pilotRefs={
 race:{sourceId:'srd-2014',kind:'race' as const,id:'dwarf',revision:'1'},
 background:{sourceId:'srd-2014',kind:'background' as const,id:'acolyte',revision:'1'},
 class:{sourceId:'srd-2014',kind:'class' as const,id:'fighter',revision:'1'},
 item:{sourceId:'srd-2014',kind:'item' as const,id:'longsword',revision:'1'}
};
const entries=[
 {ref:pilotRefs.race,name:'Anão',description:'Raça de demonstração',
  data:{id:'dwarf',grants:[{type:'ability',ability:'con',amount:2,source:'dwarf'}]}},
 {ref:pilotRefs.background,name:'Acólito',description:'Antecedente de demonstração',
  data:{id:'acolyte',grants:[]}},
 {ref:pilotRefs.class,name:'Guerreiro',description:'Classe de demonstração',
  data:{id:'fighter',levels:Array.from({length:20},(_,i)=>({level:i+1,hitDie:10,grants:[]}))}},
 {ref:pilotRefs.item,name:'Espada longa',description:'Item de demonstração',
  data:{id:'longsword'}}
];
export const pilotRules:RulesCatalogue={
 registry:{sources:[{id:'srd-2014',origin:'srd-2014',title:'SRD 2014 — amostra ilustrativa',ruleset:'5e-2014'}],
 entries:entries.map(e=>({ref:e.ref,name:e.name,ruleset:'5e-2014'}))},
 definitions:entries.map(e=>({ref:e.ref,description:e.description,data:e.data}))
};
