/** Catálogo do criador guiado e dos pilotos: itens SRD 2014 reais + raça/antecedente/classe parciais. */
import type {RulesCatalogue} from '../rules/rules-catalogue';
import {srdItemRef,srdItemsCatalogue} from '../catalogue/srd-2014-items';
import {fighter2014} from '../rules/fighter-2014';
import {fighterEquipmentOptions2014} from '../rules/starting-equipment-2014';
export const criadorRefs={
 race:{sourceId:'srd-2014',kind:'race' as const,id:'dwarf',revision:'1'},
 background:{sourceId:'srd-2014',kind:'background' as const,id:'acolyte',revision:'1'},
 class:{sourceId:'srd-2014',kind:'class' as const,id:'fighter',revision:'1'},
 item:srdItemRef('longsword')
};
const packItemIds=[...new Set(Object.values(fighterEquipmentOptions2014).flatMap(options=>options.flatMap(option=>option.components.map(item=>item.itemId))))].filter(id=>id!=='longsword');
export const criadorItemRefs=Object.fromEntries(packItemIds.map(id=>[id,srdItemRef(id)]));
const entries=[
 {ref:criadorRefs.race,name:'Anão',description:'Raça de demonstração',
  data:{id:'dwarf',grants:[{type:'ability',ability:'con',amount:2,source:'dwarf'}]}},
 {ref:criadorRefs.background,name:'Acólito',description:'Antecedente de demonstração',
  data:{id:'acolyte',grants:[]}},
 {ref:criadorRefs.class,name:'Guerreiro',description:'Guerreiro SRD 5.1 (2014): estilo de luta, Retomar o Fôlego, Surto de Ação, arquétipo Campeão, Ataque Extra e melhorias de atributo. Piloto incompleto: efeitos condicionais e progressão do Campeão acima do nível 3 ainda não automatizados.',
  data:{...fighter2014}}
];
/** Raça, antecedente e classe seguem ilustrativos/parciais; os ITENS são o catálogo SRD 2014 completo (`src/catalogue`),
 * a mesma fonte do Compêndio, do criador e do inventário. */
const items=srdItemsCatalogue();
export const criadorRules:RulesCatalogue={
 registry:{sources:items.registry.sources,
  entries:[...entries.map(e=>({ref:e.ref,name:e.name,ruleset:'5e-2014' as const})),...items.registry.entries]},
 definitions:[...entries.map(e=>({ref:e.ref,description:e.description,data:e.data})),...items.definitions]
};
