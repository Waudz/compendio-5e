/** Categorias de regras do SRD 2014, compartilhando a fonte versionada do criador. */
import type { CategoriaDef } from '../../nucleo/tipos';
import dados from '../../../criador/data/character-2014.json';

type Classe = (typeof dados.classes)[number];
type Subclasse = (typeof dados.subclasses)[number];
type Raca = (typeof dados.races)[number];
const nomes: Record<string,string> = {
 barbarian:'Bárbaro',bard:'Bardo',cleric:'Clérigo',druid:'Druida',fighter:'Guerreiro',monk:'Monge',paladin:'Paladino',ranger:'Patrulheiro',rogue:'Ladino',sorcerer:'Feiticeiro',warlock:'Bruxo',wizard:'Mago',
 berserker:'Berserker',lore:'Colégio do Conhecimento',life:'Domínio da Vida',land:'Círculo da Terra',champion:'Campeão','open-hand':'Caminho da Mão Aberta',devotion:'Juramento de Devoção',hunter:'Caçador',thief:'Ladrão',draconic:'Linhagem Dracônica',fiend:'O Corruptor',evocation:'Escola de Evocação',
 dwarf:'Anão',elf:'Elfo',halfling:'Halfling',human:'Humano',dragonborn:'Draconato',gnome:'Gnomo','half-elf':'Meio-elfo','half-orc':'Meio-orc',tiefling:'Tiefling'
};
const slug = (id:string) => id.split('/').pop() ?? id;
const nome = (id:string) => nomes[slug(id)] ?? slug(id);
const ordenacao = <T,>(nomeDe:(x:T)=>string) => [{id:'nome',rotulo:'Nome',comparar:(a:T,b:T)=>nomeDe(a).localeCompare(nomeDe(b),'pt-BR')}];
const nomeClasse = (c:Classe) => nome(c.id);
export const categoriaClasses:CategoriaDef<Classe> = {
 id:'classes',rotulo:'Classes',rotuloItem:'Classe',
 carregar:async()=>dados.classes,dadosEmMemoria:()=>dados.classes,
 idDe:c=>c.id,nomeDe:nomeClasse,nomesAlternativos:c=>[slug(c.id)],
 subtituloDe:c=>`Dado de Vida: d${c.data.hitDie} · Níveis 1–20`,
 resumoDe:c=>`${c.data.levels.length} níveis de progressão`,
 corpoDe:c=>c.data.levels.flatMap(n=>n.features.map(id=>dados.features.find(f=>f.id===id)?.nome??slug(id))).join(' '),
 filtros:[],ordenacoes:ordenacao(nomeClasse)
};
const nomeSubclasse=(s:Subclasse)=>nome(s.id);
export const categoriaSubclasses:CategoriaDef<Subclasse> = {
 id:'subclasses',rotulo:'Subclasses',rotuloItem:'Subclasse',
 carregar:async()=>dados.subclasses,dadosEmMemoria:()=>dados.subclasses,
 idDe:s=>s.id,nomeDe:nomeSubclasse,nomesAlternativos:s=>[slug(s.id)],
 subtituloDe:s=>`Classe: ${nome(s.parent)}`,resumoDe:s=>s.descricao,
 corpoDe:s=>s.descricao,
 filtros:[{id:'classe',rotulo:'Classe',tipo:'selecao',opcoes:dados.classes.map(c=>({valor:c.id,rotulo:nomeClasse(c)})),extrair:s=>s.parent}],
 ordenacoes:ordenacao(nomeSubclasse)
};
const nomeRaca=(r:Raca)=>nomes[r.index]??r.name;
export const categoriaRacas:CategoriaDef<Raca> = {
 id:'racas',rotulo:'Raças',rotuloItem:'Raça',
 carregar:async()=>dados.races,dadosEmMemoria:()=>dados.races,
 idDe:r=>r.index,nomeDe:nomeRaca,nomesAlternativos:r=>[r.name],
 subtituloDe:r=>`Deslocamento: ${r.speed} pés · Tamanho: ${r.size}`,
 resumoDe:r=>`${r.traits.length} características raciais`,
 corpoDe:r=>r.traits.map(t=>t.name).join(' '),
 filtros:[],ordenacoes:ordenacao(nomeRaca)
};
