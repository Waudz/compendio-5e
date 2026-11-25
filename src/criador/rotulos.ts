/** Rótulos pt-BR das opções do criador. Identificadores estáveis nunca mudam; só o texto exibido é traduzido.
 * Sem tradução conhecida, mostra o identificador legível (nunca esconde a opção).
 */
const ATRIBUTO: Record<string, string> = { str: 'Força', dex: 'Destreza', con: 'Constituição', int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma' };
const PERICIA: Record<string, string> = {
  acrobatics: 'Acrobacia', 'animal-handling': 'Lidar com Animais', arcana: 'Arcanismo', athletics: 'Atletismo', deception: 'Enganação', history: 'História', insight: 'Intuição',
  intimidation: 'Intimidação', investigation: 'Investigação', medicine: 'Medicina', nature: 'Natureza', perception: 'Percepção', performance: 'Atuação', persuasion: 'Persuasão',
  religion: 'Religião', 'sleight-of-hand': 'Prestidigitação', stealth: 'Furtividade', survival: 'Sobrevivência',
};
const OUTROS: Record<string, string> = {
  archery: 'Arquearia', defense: 'Defesa', dueling: 'Duelismo', 'great-weapon-fighting': 'Combate com Armas Grandes', protection: 'Proteção', 'two-weapon-fighting': 'Combate com Duas Armas',
  champion: 'Campeão', 'fighting-style': 'Estilo de Luta', 'second-wind': 'Retomar o Fôlego', 'action-surge': 'Surto de Ação', 'extra-attack-2': 'Ataque Extra', 'extra-attack-3': 'Ataque Extra (2 ataques adicionais)',
  'extra-attack-4': 'Ataque Extra (3 ataques adicionais)', indomitable: 'Indomável', 'champion-improved-critical': 'Crítico Aprimorado',
};
const humanizar = (id: string) => { const t = id.replaceAll('-', ' '); return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1); };

export const rotuloAtributo = (id: string) => ATRIBUTO[id] ?? id.toUpperCase();
export const rotuloPericia = (id: string) => PERICIA[id] ?? humanizar(id);
/** Característica, recurso ou opção de escolha (estilo de luta, arquétipo, melhoria de atributo). */
export function rotuloOpcao(id: string): string {
  if (OUTROS[id]) return OUTROS[id];
  if (id.startsWith('fighting-style-')) return 'Estilo de Luta: ' + rotuloOpcao(id.slice('fighting-style-'.length));
  const dois = /^(str|dex|con|int|wis|cha)-plus-two$/.exec(id);
  if (dois) return `${rotuloAtributo(dois[1])} +2`;
  const dividido = /^(str|dex|con|int|wis|cha)-(str|dex|con|int|wis|cha)-plus-one$/.exec(id);
  if (dividido) return `${rotuloAtributo(dividido[1])} +1 e ${rotuloAtributo(dividido[2])} +1`;
  return PERICIA[id] ?? humanizar(id);
}

/** Os únicos dados da ficha que a identidade pública pode usar. `raca`/`classe` já em português. */
export const origemPublica = (d: { name: string; nickname?: string; portrait?: string }, raca: string, classe: string) => ({ name: d.name, alias: d.nickname ?? '', race: raca, characterClass: classe, portrait: d.portrait ?? '' });
export function rotuloClasse(id?:string){const classes:Record<string,string>={barbarian:'Bárbaro',bard:'Bardo',cleric:'Clérigo',druid:'Druida',fighter:'Guerreiro',monk:'Monge',paladin:'Paladino',ranger:'Patrulheiro',rogue:'Ladino',sorcerer:'Feiticeiro',warlock:'Bruxo',wizard:'Mago'};const key=id?.includes(':')?id.split(':').at(-2):id;return classes[key??'fighter']??'Personagem';}
export function rotuloRaca(id:string){const races:Record<string,string>={'hill-dwarf':'Anão da Colina','high-elf':'Elfo Alto','lightfoot-halfling':'Halfling Pés Leves','rock-gnome':'Gnomo da Rocha',human:'Humano',dragonborn:'Draconato','half-elf':'Meio-elfo','half-orc':'Meio-orc',tiefling:'Tiefling'};return races[id]??'Anão';}
