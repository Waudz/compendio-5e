/** Rótulos em português de D&D 5e 2014. Identificadores estáveis nunca mudam; só o texto exibido. Sem tradução conhecida, devolve o identificador legível. */
export const humanizar = (id: string) => { const t = id.replaceAll('-', ' ').replaceAll('_', ' '); return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1); };
const rotulo = (tabela: Record<string, string>) => (id: string) => tabela[id] ?? humanizar(id);

export const rotuloEscola = rotulo({ abjuration: 'Abjuração', conjuration: 'Conjuração', divination: 'Adivinhação', enchantment: 'Encantamento', evocation: 'Evocação', illusion: 'Ilusão', necromancy: 'Necromancia', transmutation: 'Transmutação' });
export const rotuloClasse = rotulo({ bard: 'Bardo', cleric: 'Clérigo', druid: 'Druida', paladin: 'Paladino', ranger: 'Patrulheiro', sorcerer: 'Feiticeiro', warlock: 'Bruxo', wizard: 'Mago' });
export const rotuloAtributo = rotulo({ str: 'Força', dex: 'Destreza', con: 'Constituição', int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma' });
export const siglaAtributo = rotulo({ str: 'FOR', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' });
export const rotuloTipoCriatura = rotulo({ aberration: 'Aberração', beast: 'Fera', celestial: 'Celestial', construct: 'Constructo', dragon: 'Dragão', elemental: 'Elemental', fey: 'Feérico', fiend: 'Ínfero', giant: 'Gigante', humanoid: 'Humanoide', monstrosity: 'Monstruosidade', ooze: 'Gosma', plant: 'Planta', undead: 'Morto-vivo' });
export const rotuloTamanho = rotulo({ tiny: 'Miúdo', small: 'Pequeno', medium: 'Médio', large: 'Grande', huge: 'Enorme', gargantuan: 'Imenso' });
export const rotuloTipoDano = rotulo({ acid: 'ácido', bludgeoning: 'contundente', cold: 'frio', fire: 'fogo', force: 'energético', lightning: 'elétrico', necrotic: 'necrótico', piercing: 'perfurante', poison: 'venenoso', psychic: 'psíquico', radiant: 'radiante', slashing: 'cortante', thunder: 'trovejante' });
export const rotuloAmbiente = rotulo({
  arctic: 'Ártico', caves: 'Cavernas', coast: 'Costa', desert: 'Deserto', forest: 'Floresta', grassland: 'Campos', hills: 'Colinas', lake: 'Lago', laboratory: 'Laboratório', mountain: 'Montanha',
  ocean: 'Oceano', ruins: 'Ruínas', sewer: 'Esgoto', swamp: 'Pântano', temple: 'Templo', tomb: 'Tumba', underworld: 'Subterrâneo', urban: 'Urbano', shadowfell: 'Pendor das Sombras',
  'plane-of-air': 'Plano do Ar', 'plane-of-earth': 'Plano da Terra', 'plane-of-fire': 'Plano do Fogo', 'plane-of-water': 'Plano da Água', 'astral-plane': 'Plano Astral', 'ethereal-plane': 'Plano Etéreo',
  'material-plane': 'Plano Material', feywild: 'Agreste Fada', abyss: 'Abismo', hell: 'Nove Infernos', elysium: 'Elísio',
});
export const rotuloPericia = rotulo({
  acrobatics: 'Acrobacia', animal_handling: 'Lidar com Animais', arcana: 'Arcanismo', athletics: 'Atletismo', deception: 'Enganação', history: 'História', insight: 'Intuição', intimidation: 'Intimidação',
  investigation: 'Investigação', medicine: 'Medicina', nature: 'Natureza', perception: 'Percepção', performance: 'Atuação', persuasion: 'Persuasão', religion: 'Religião', sleight_of_hand: 'Prestidigitação',
  stealth: 'Furtividade', survival: 'Sobrevivência',
});
export const rotuloDeslocamento = rotulo({ walk: 'Caminhada', fly: 'Voo', swim: 'Natação', climb: 'Escalada', burrow: 'Escavação' });
export const rotuloSentido = rotulo({ visaoNoEscuro: 'Visão no escuro', percepcaoAsCegas: 'Percepção às cegas', sentidoSismico: 'Sentido sísmico', visaoVerdadeira: 'Visão verdadeira' });
export const rotuloGrupoAcao = rotulo({ ACTION: 'Ações', BONUS_ACTION: 'Ações bônus', REACTION: 'Reações', LEGENDARY_ACTION: 'Ações lendárias', LAIR_ACTION: 'Ações de covil' });
export const rotuloArea = rotulo({ cube: 'Cubo', sphere: 'Esfera', line: 'Linha', cone: 'Cone', cylinder: 'Cilindro' });
export const rotuloEfeitoSalvaguarda = rotulo({ none: 'sem efeito em caso de sucesso', half: 'metade do dano em caso de sucesso', other: 'efeito especial em caso de sucesso' });
