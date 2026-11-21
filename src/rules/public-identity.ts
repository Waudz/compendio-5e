/** Public identity is deliberately independent of the private character sheet.
 * Only this projection may be serialized to other players.
 */
export type PublicIdentityField = {mode:'real'|'custom'|'hidden';customValue?:string};
export type PublicIdentitySettings = {
 imageUrl:string|null;
 title:string;
 name:PublicIdentityField;
 surname:PublicIdentityField;
 race:PublicIdentityField;
 characterClass:PublicIdentityField;
 description:string;
};
export type PrivateIdentitySource = {
 name:string; surname:string; race:string; characterClass:string;
};
export type PublicIdentityCard = {
 imageUrl:string|null; title:string; name:string|null; surname:string|null;
 race:string|null; characterClass:string|null; description:string;
};
export function defaultPublicIdentity():PublicIdentitySettings {
 return {
  imageUrl:null,title:'',description:'',
  name:{mode:'real'},surname:{mode:'real'},race:{mode:'real'},characterClass:{mode:'real'}
 };
}
function resolveField(field:PublicIdentityField,real:string):string|null {
 if(field.mode==='hidden')return null;
 if(field.mode==='real')return real.trim()||null;
 if(field.mode==='custom')return field.customValue?.trim()||null;
 throw Error('Invalid public identity mode');
}
/** Never accept a full CharacterDraft here: this explicit allowlist prevents
 * HP, level, equipment, secrets and private notes from leaking to other players.
 */
export function publicIdentityCard(settings:PublicIdentitySettings,source:PrivateIdentitySource):PublicIdentityCard {
 return {
  imageUrl:settings.imageUrl,
  title:settings.title.trim(),
  name:resolveField(settings.name,source.name),
  surname:resolveField(settings.surname,source.surname),
  race:resolveField(settings.race,source.race),
  characterClass:resolveField(settings.characterClass,source.characterClass),
  description:settings.description
 };
}
