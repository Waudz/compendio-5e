/** Shared illustrative catalogue for development pilots only. Not certified SRD data. */
import type {RulesCatalogue} from '../rules/rules-catalogue';
import {fighter2014} from '../rules/fighter-2014';
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
 {ref:pilotRefs.class,name:'Guerreiro',description:'Guerreiro SRD 5.1 (2014): estilo de luta, Retomar o Fôlego, Surto de Ação, arquétipo Campeão, Ataque Extra e melhorias de atributo. Piloto incompleto: efeitos condicionais e progressão do Campeão acima do nível 3 ainda não automatizados.',
  data:{...fighter2014}},
 {ref:pilotRefs.item,name:'Espada longa',description:'Item de demonstração',
  data:{id:'longsword'}}
];
export const pilotRules:RulesCatalogue={
 registry:{sources:[{id:'srd-2014',origin:'srd-2014',title:'SRD 2014 — amostra ilustrativa',ruleset:'5e-2014'}],
 entries:entries.map(e=>({ref:e.ref,name:e.name,ruleset:'5e-2014'}))},
 definitions:entries.map(e=>({ref:e.ref,description:e.description,data:e.data}))
};
