/** Somente demonstração isolada; autorização de produção é SQL, não este adaptador. */
import type {
  CodexApi,
  Conhecimento,
  CodexAviso,
} from "../compendio/conhecimento";
export function codexDemo(master: boolean, campaign: string): CodexApi {
  const key = "demo:codex:v1";
  const read = (): Conhecimento[] => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      return [];
    }
  };
  const write = (xs: Conhecimento[]) =>
    localStorage.setItem(key, JSON.stringify(xs));
  const check = () => {
    if (!master) throw Error("Somente o mestre.");
  };
  const linksKey=key+':links',noticesKey=key+':notices';
  const parse=<T,>(k:string):T[]=>{try{return JSON.parse(localStorage.getItem(k)??'[]');}catch{return [];}};
  type Link={id:string;source:string;target:string;relation:string};
  type Notice={id:number;entry_id:string;knowledge:number;created_at:string;read_at:string|null};
  const visible=(id:string)=>read().find(x=>x.id===id&&(master||x.knowledge>0));
  return {
    links:async(cid,id)=>{if(cid!==campaign||!visible(id))throw Error('Sem acesso.');return parse<Link>(linksKey).filter(l=>l.source===id||l.target===id).flatMap(l=>{const target=visible(l.source===id?l.target:l.source);return target?[{id:l.id,targetId:target.id,title:target.title,category:target.category,relation:l.relation}]:[];});},
    link:async(cid,source,target,relation)=>{check();if(cid!==campaign||!visible(source)||!visible(target)||source===target)throw Error('Vínculo inválido.');const ls=parse<Link>(linksKey);if(ls.some(l=>(l.source===source&&l.target===target)||(l.source===target&&l.target===source)))throw Error('Vínculo já existe.');const id=crypto.randomUUID();localStorage.setItem(linksKey,JSON.stringify([...ls,{id,source,target,relation}]));return id;},
    unlink:async(cid,id)=>{check();if(cid!==campaign)throw Error('Outra campanha.');localStorage.setItem(linksKey,JSON.stringify(parse<Link>(linksKey).filter(l=>l.id!==id)));},
    feed:async cid=>{if(cid!==campaign)throw Error('Outra campanha.');const all=master?[]:parse<Notice>(noticesKey).flatMap(n=>{const e=visible(n.entry_id);return e&&e.knowledge>=n.knowledge?[{...n,title:e.title,category:e.category}]:[];});return {items:all.slice(-50).reverse(),unread:all.filter(x=>!x.read_at).length,discoveries:all.filter(x=>!x.read_at&&['item','discovery'].includes(x.category)).length};},
    list: async (cid) => {
      if (cid !== campaign) throw Error("Outra campanha.");
      return read()
        .filter((x) => master || x.knowledge > 0)
        .map((x) =>
          master
            ? x
            : {
                id: x.id,
                title: x.title,
                category: x.category,
                systemId: x.systemId,
                version: x.version,
                knowledge: x.knowledge,
                ...(x.knowledge >= 2 ? { description: x.description, fields:x.fields } : {}),
                ...(x.knowledge >= 3
                  ? {
                      imagePath: x.imagePath, framing:x.framing,
                      imageDefinitionId: x.definitionId,
                    }
                  : {}),
                ...(x.knowledge === 4 || x.category === "item"
                  ? { definitionId: x.definitionId }
                  : {}),
                ...(x.knowledge === 4 ? { stats: x.stats } : {}),
              },
        );
    },
    save: async (cid, id, version, data) => {
      check();
      if (cid !== campaign) throw Error("Outra campanha.");
      const xs = read(),
        old = xs.find((x) => x.id === id);
      if (id && old?.version !== version) throw Error("Conflito de versão.");
      if (
        !id &&
        data.definitionId &&
        xs.some(
          (x) =>
            x.category === data.category &&
            x.definitionId === data.definitionId,
        )
      )
        throw Error("Já existe uma descoberta para essa definição.");
      const eid = id ?? crypto.randomUUID();
      write([
        ...xs.filter((x) => x.id !== eid),
        { ...data, id: eid, version: version + 1 },
      ]);
      if(data.knowledge>(old?.knowledge??0)){
       const ns=parse<Notice>(noticesKey);if(!ns.some(n=>n.entry_id===eid&&n.knowledge===data.knowledge))localStorage.setItem(noticesKey,JSON.stringify([...ns,{id:Math.max(0,...ns.map(n=>n.id))+1,entry_id:eid,knowledge:data.knowledge,created_at:new Date().toISOString(),read_at:null}]));
      }
      return eid;
    },
    remove: async (cid, id, version) => {
      check();
      const xs = read();
      if (cid !== campaign || xs.find((x) => x.id === id)?.version !== version)
        throw Error("Conflito.");
      write(xs.filter((x) => x.id !== id));
    },
    upload: async () => {
      throw Error(
        "Upload exige Storage privado. A demonstração não envia arquivos.",
      );
    },
    image: async () => {
      throw Error("Imagem indisponível.");
    },
    holders: async () => [],
    notices: async () => [] as CodexAviso[],
    seen: async id => {if(!master)localStorage.setItem(noticesKey,JSON.stringify(parse<Notice>(noticesKey).map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n)));},
  };
}
