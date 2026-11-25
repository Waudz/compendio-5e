/** Identidade pública: só a APRESENTAÇÃO do personagem aos outros jogadores. Não é outra ficha.
 * Cada campo acompanha a ficha (`sheet`), é personalizado (`custom`) ou fica oculto (`hidden`). O retrato é o mesmo da ficha.
 * Só o cartão resolvido por `publicIdentityCard` pode ser mostrado a outros jogadores.
 */
export type ModoPublico = 'sheet' | 'custom' | 'hidden';
export type CampoPublico = { mode: ModoPublico; value?: string };
export const CAMPOS_PUBLICOS = ['name', 'alias', 'race', 'characterClass'] as const;
export type ChavePublica = (typeof CAMPOS_PUBLICOS)[number];
export type PublicIdentity = Record<ChavePublica, CampoPublico> & { description: string };
/** Os únicos dados da ficha que a identidade pode usar. Nunca receba a ficha inteira aqui. */
export type SheetPublicSource = Record<ChavePublica, string> & { portrait: string };
export type PublicIdentityCard = Record<ChavePublica, string | null> & { description: string; imageUrl: string | null };

export const MODOS_PUBLICOS: readonly ModoPublico[] = ['sheet', 'custom', 'hidden'];
export function defaultPublicIdentity(): PublicIdentity {
 return { name: { mode: 'sheet' }, alias: { mode: 'sheet' }, race: { mode: 'sheet' }, characterClass: { mode: 'sheet' }, description: '' };
}
/** Valida (sem consertar) uma identidade lida do navegador. */
export function isPublicIdentity(v: unknown): v is PublicIdentity {
 if (typeof v !== 'object' || v === null) return false;
 const r = v as Record<string, unknown>;
 return typeof r.description === 'string' && CAMPOS_PUBLICOS.every(k => {
  const f = r[k] as Partial<CampoPublico> | null | undefined;
  return !!f && typeof f === 'object' && MODOS_PUBLICOS.includes(f.mode as ModoPublico) && (f.value === undefined || typeof f.value === 'string');
 });
}
function resolver(field: CampoPublico, daFicha: string): string | null {
 if (field.mode === 'hidden') return null;
 if (field.mode === 'sheet') return daFicha.trim() || null;
 if (field.mode === 'custom') return field.value?.trim() || null; // campo personalizado vazio nunca revela o valor da ficha
 throw Error('Invalid public identity mode');
}
export function publicIdentityCard(identity: PublicIdentity, source: SheetPublicSource): PublicIdentityCard {
 return {
  name: resolver(identity.name, source.name),
  alias: resolver(identity.alias, source.alias),
  race: resolver(identity.race, source.race),
  characterClass: resolver(identity.characterClass, source.characterClass),
  description: identity.description,
  imageUrl: source.portrait.trim() || null,
 };
}
/** O que mostrar: nome em destaque e, quando ambos são públicos, a alcunha abaixo. */
export function presentation(card: Pick<PublicIdentityCard, 'name' | 'alias'>): { nome: string; alcunha: string | null } {
 if (card.name) return { nome: card.name, alcunha: card.alias };
 return { nome: card.alias || 'Identidade desconhecida', alcunha: null };
}
