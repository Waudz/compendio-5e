/** Localized labels never replace stable content references or rules payloads. */
import {contentKey,type ContentRef} from './content-registry';
import {validateRulesCatalogue,type RulesCatalogue} from './rules-catalogue';
export type CatalogueLocale='pt-BR'|'en';
export type CatalogueTranslation={ref:ContentRef;locale:CatalogueLocale;name:string;description?:string};
export function localizeCatalogue(
 catalogue:RulesCatalogue,translations:readonly CatalogueTranslation[],locale:CatalogueLocale
):RulesCatalogue{
 validateRulesCatalogue(catalogue);
 const known=new Set(catalogue.registry.entries.map(entry=>contentKey(entry.ref)));
 const names=new Map<string,CatalogueTranslation>();
 for(const translation of translations){
  const key=contentKey(translation.ref);
  if(!known.has(key)) throw new Error('Translation references unknown content: '+key);
  if(!translation.name.trim()||translation.description!==undefined&&!translation.description.trim())
   throw new Error('Invalid catalogue translation: '+key);
  const translationKey=translation.locale+':'+key;
  if(names.has(translationKey)) throw new Error('Duplicate catalogue translation: '+translationKey);
  names.set(translationKey,translation);
 }
 return {
  registry:{sources:catalogue.registry.sources.map(source=>({...source})),
   entries:catalogue.registry.entries.map(entry=>{
    const translation=names.get(locale+':'+contentKey(entry.ref));
    return {...entry,ref:{...entry.ref},name:translation?.name??entry.name};
   })},
  definitions:catalogue.definitions.map(definition=>{
   const translation=names.get(locale+':'+contentKey(definition.ref));
   return {...definition,ref:{...definition.ref},
    description:translation?.description??definition.description};
  })
 };
}
