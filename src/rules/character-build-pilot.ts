/** Experimental 2014 character-creation rules kernel. Not a complete or approved catalogue. */
export type Ability = 'str'|'dex'|'con'|'int'|'wis'|'cha';
export type Abilities = Record<Ability,number>;
export type Grant =
  | {type:'ability'; ability:Ability; amount:number; source:string; max?:number}
  | {type:'skill'; skill:string; source:string}
  | {type:'language'; language:string; source:string}
  | {type:'item'; item:string; quantity:number; source:string}
  | {type:'feature'; feature:string; source:string}
  | {type:'resource'; resource:string; uses:number|null; source:string}
  | {type:'hp-per-level'; amount:number; source:string};
export type Option = {id:string; grants:Grant[]; choices?:{id:string;count:number;options:Grant[]}[]};
export type ClassLevel = {level:number; grants:Grant[]; hitDie:number};
export type ClassDefinition = {id:string; levels:ClassLevel[]};
export type BuildInput = {
  baseAbilities:Abilities; race:Option; background:Option; classDef:ClassDefinition;
  level:number; selected:Record<string,number[]>; hpRolls?:number[];
};
export type BuildResult = {abilities:Abilities; skills:string[]; languages:string[];
  items:{item:string;quantity:number}[]; features:string[]; resources:Record<string,number|null>;
  maxHp:number; pending:string[]; provenance:Grant[]};
export function modifier(score:number):number {return Math.floor((score-10)/2);}
export function buildCharacter(input:BuildInput):BuildResult {
  if(!Number.isInteger(input.level)||input.level<1||input.level>20) throw new Error('Invalid level');
  const levels=input.classDef.levels;
  if(levels.length!==20||levels.some((v,i)=>v.level!==i+1))throw new Error('Incomplete class progression');
  const grants:Grant[]=[...input.race.grants,...input.background.grants];
  const pending:string[]=[];
  for(const option of [input.race,input.background]){
    for(const choice of option.choices??[]){
      const indexes=input.selected[choice.id]??[];
      if(indexes.length!==choice.count||new Set(indexes).size!==indexes.length||indexes.some(i=>!Number.isInteger(i)||i<0||i>=choice.options.length)){
        pending.push(choice.id);continue;
      }
      for(const i of indexes)grants.push(choice.options[i]);
    }
  }
  for(let i=0;i<input.level;i++)grants.push(...levels[i].grants);
  const abilities={...input.baseAbilities};
  for(const g of grants)if(g.type==='ability')abilities[g.ability]=Math.min(g.max??20,abilities[g.ability]+g.amount);
  const skills=[...new Set(grants.filter((g):g is Extract<Grant,{type:'skill'}>=>g.type==='skill').map(g=>g.skill))];
  const languages=[...new Set(grants.filter((g):g is Extract<Grant,{type:'language'}>=>g.type==='language').map(g=>g.language))];
  const items=new Map<string,number>();
  for(const g of grants)if(g.type==='item')items.set(g.item,(items.get(g.item)??0)+g.quantity);
  const features=[...new Set(grants.filter((g):g is Extract<Grant,{type:'feature'}>=>g.type==='feature').map(g=>g.feature))];
  const resources:Record<string,number|null>={};
  for(const g of grants)if(g.type==='resource')resources[g.resource]=g.uses;
  const hitDie=levels[0].hitDie;
  if(input.hpRolls&&input.hpRolls.length!==input.level-1)throw new Error('Invalid HP roll count');
  let maxHp=hitDie+modifier(abilities.con);
  for(let n=2;n<=input.level;n++){
    const die=levels[n-1].hitDie;
    const rolled=input.hpRolls?input.hpRolls[n-2]:Math.floor(die/2)+1;
    if(!Number.isInteger(rolled)||rolled<1||rolled>die)throw new Error('Invalid HP roll');
    maxHp+=Math.max(1,rolled+modifier(abilities.con));
  }
  maxHp+=input.level*grants.filter((g):g is Extract<Grant,{type:'hp-per-level'}>=>g.type==='hp-per-level').reduce((sum,g)=>sum+g.amount,0);
  return {abilities,skills,languages,items:[...items].map(([item,quantity])=>({item,quantity})),
    features,resources,maxHp,pending,provenance:grants};
}
