/** Somente demonstração isolada; a autorização de produção é SQL (0017), não este adaptador. */
import type { CodexApi, CodexLink, Conhecimento } from "../compendio/conhecimento";
import type { LinhaDefinicao } from "../compendio/definicoes";
import type { Secao } from "../compendio/ficha";
import type { LinhaVida } from "../npc/estado";
import type { FichaDeNpcEmMemoria } from "../fichasMemoria";

type Salvo = Conhecimento & { revealed: string[]; announced: string[] };
type Link = { id: string; source: string; target: string; kind: string; label: string; inverse: string; revealed: boolean };
type Aviso = { id: number; entry_id: string; is_new: boolean; created_at: string; read_at: string | null };
const NEUTRO: Record<string, string> = { npc: "Pessoa desconhecida", location: "Local desconhecido", organization: "Organização desconhecida", monster: "Criatura desconhecida" };

export function codexDemo(master: boolean, campaign: string, fichasNpc?: FichaDeNpcEmMemoria): CodexApi {
  const key = "demo:codex:v2";
  const parse = <T,>(k: string): T[] => { try { return JSON.parse(localStorage.getItem(k) ?? "[]"); } catch { return []; } };
  const store = <T,>(k: string, v: T[]) => localStorage.setItem(k, JSON.stringify(v));
  const read = () => parse<Salvo>(key), links = () => parse<Link>(key + ":links"), notices = () => parse<Aviso>(key + ":notices");
  const scope = (cid: string) => { if (cid !== campaign) throw Error("Outra campanha."); };
  const check = () => { if (!master) throw Error("Somente o mestre."); };
  const publicTitle = (e: Salvo) => e.revealed.includes("name") ? e.title : (e.revealed.includes("nickname") && e.fields?.nickname) || NEUTRO[e.category] || "Descoberta sem nome";
  const identified = (e: Salvo) => !!e.definitionId && e.revealed.includes("name") && (e.revealed.includes("sheet") || (!!e.sheet?.length && e.sheet.every((s) => e.revealed.includes("sheet:" + s.k))));
  const publicCategory = (e: Salvo) => (e.category === "item" && !identified(e) ? "discovery" : e.category);
  const linksOf = (id: string, asPlayer: boolean): CodexLink[] => {
    const all = read();
    return links().filter((l) => (l.source === id || l.target === id) && (!asPlayer || l.revealed)).flatMap((l) => {
      const other = all.find((x) => x.id === (l.source === id ? l.target : l.source));
      if (!other || (asPlayer && !other.visible)) return [];
      return [{ id: l.id, targetId: other.id, kind: l.kind, title: asPlayer ? publicTitle(other) : other.title, category: asPlayer ? publicCategory(other) : other.category, relation: l.source === id ? l.label : l.inverse, outgoing: l.source === id, ...(asPlayer ? {} : { revealed: l.revealed }) }];
    });
  };
  /** Mesma regra de citações da 0020: destino fechado chega só como texto; nome verdadeiro oculto vira o título público. */
  const sanear = <T,>(valor: T): T => {
    if (valor === undefined) return valor;
    return JSON.parse(JSON.stringify(valor), (_k, v: unknown) => typeof v !== "string" ? v : v.replace(/@\[([^\]\n]{1,120})\]\(([0-9a-fA-F-]{36})\)/g,(_m: string, texto: string, id: string) => {
      const alvo = read().find((x) => x.id === id);
      const nomeOculto = !!alvo && !alvo.revealed.includes("name") && texto.trim().toLowerCase() === alvo.title.trim().toLowerCase();
      const exibido = nomeOculto ? publicTitle(alvo) : texto;
      return alvo?.visible ? `@[${exibido}](${id})` : exibido;
    })) as T;
  };
  const project = (e: Salvo): Conhecimento => {
    const has = (k: string) => e.revealed.includes(k);
    const fields = Object.fromEntries(Object.entries(e.fields ?? {}).filter(([k]) => has(k)));
    const sheet = e.category === "monster" ? [] : (e.sheet ?? []).filter((s) => has("sheet") || has("sheet:" + s.k));
    const related = linksOf(e.id, true).map((l) => l.title);
    // Chaves ocultas ficam ausentes da resposta, como na projeção do servidor.
    return JSON.parse(JSON.stringify({
      id: e.id, systemId: e.systemId, version: e.version, visible: true, category: publicCategory(e), title: publicTitle(e),
      description: has("description") ? sanear(e.description) : undefined,
      fields: Object.keys(fields).length ? sanear(fields) : undefined,
      sheet: sheet.length ? sheet : undefined,
      imagePath: has("image") ? e.imagePath : undefined, framing: has("image") ? e.framing : undefined,
      imageDefinitionId: has("image") && has("name") ? e.definitionId : undefined,
      definitionId: e.category !== "monster" && identified(e) ? e.definitionId : undefined,
      relatedTerms: related.length ? related : undefined,
      vitalStatus: e.category === "npc" && has("vitalStatus") ? vitalDe(e.id) : undefined,
    })) as Conhecimento;
  };
  const vidas = () => parse<LinhaVida>(key + ":vida");
  const vitalDe = (id: string) => vidas().find(v => v.noteId === id)?.estado ?? "vivo";
  const asMaster = (e: Salvo): Conhecimento => { const { announced, ...rest } = e; void announced; return { ...rest, imageDefinitionId: e.definitionId, ...(e.category === "npc" ? { vitalStatus: vitalDe(e.id) } : {}) }; };
  const announce = (id: string) => {
    const all = read(), e = all.find((x) => x.id === id);
    if (!e?.visible) return;
    const p = project(e);
    const keys = ["exists", ...e.revealed.filter((k) => k === "name" || (k === "description" && !!p.description?.length) || !!p.fields?.[k]), ...(p.sheet ?? []).map((s) => "sheet:" + s.k), ...linksOf(id, true).map((l) => "link:" + l.id)];
    if (keys.every((k) => e.announced.includes(k))) return;
    const ns = notices();
    store(key + ":notices", [...ns, { id: Math.max(0, ...ns.map((n) => n.id)) + 1, entry_id: id, is_new: !e.announced.includes("exists"), created_at: new Date().toISOString(), read_at: null }]);
    e.announced = [...new Set([...e.announced, ...keys])];
    store(key, all);
  };
  const sync = (definitionId: string, sheet: Secao[], oldName: string | undefined, newName: string) => {
    const all = read(), mine = all.filter((e) => e.definitionId === definitionId);
    store(key, all.map((e) => (mine.some((m) => m.id === e.id) ? { ...e, sheet, title: e.title === oldName ? newName : e.title, version: e.version + 1 } : e)));
    for (const e of mine) announce(e.id);
  };
  const find = (id: string, version?: number) => {
    const e = read().find((x) => x.id === id);
    if (!e || (version !== undefined && e.version !== version)) throw Error("Conflito de versão.");
    return e;
  };
  const api:CodexApi = {
    edicaoAtomica: async()=>true,
    salvarEdicao: async(cid,id,version,data,changes)=>{
      check();scope(cid);
      const keys=[key,key+':links',key+':notices'];const before=keys.map(k=>localStorage.getItem(k));
      try {
        const nid=await api.save(cid,id,version,data);
        for(const lid of changes.remover)await api.unlink(cid,lid);
        for(const op of changes.adicionar)await api.link(cid,op.source??nid,op.target??nid,op.relation);
        return nid;
      }catch(e){keys.forEach((k,i)=>{if(before[i]===null)localStorage.removeItem(k);else localStorage.setItem(k,before[i]!);});throw e;}
    },
    links: async (cid, id) => { scope(cid); if (!master && !read().some((x) => x.id === id && x.visible)) throw Error("Sem acesso."); return linksOf(id, !master); },
    link: async (cid, source, target, r) => {
      check(); scope(cid);
      const ls = links(), pair = [source, target].sort().join();
      if (source === target || ls.some((l) => [l.source, l.target].sort().join() === pair && l.kind === r.kind && (r.kind !== "custom" || l.label === r.label))) throw Error("Vínculo já existe.");
      const id = crypto.randomUUID();
      store(key + ":links", [...ls, { id, source, target, kind: r.kind, label: r.label, inverse: r.inverse, revealed: !!r.revealed }]);
      if (r.revealed) announce(source);
      return id;
    },
    unlink: async (cid, id) => { check(); scope(cid); store(key + ":links", links().filter((l) => l.id !== id)); },
    feed: async (cid) => {
      scope(cid);
      const all = master ? [] : notices().flatMap((n) => { const e = read().find((x) => x.id === n.entry_id && x.visible); return e ? [{ ...n, title: publicTitle(e), category: publicCategory(e) }] : []; });
      return { items: all.slice(-50).reverse(), unread: all.filter((x) => !x.read_at).length, discoveries: all.filter((x) => !x.read_at && ["item", "discovery"].includes(x.category)).length };
    },
    list: async (cid) => { scope(cid); return read().filter((x) => master || x.visible).map((x) => (master ? asMaster(x) : project(x))); },
    save: async (cid, id, version, data) => {
      check(); scope(cid);
      const xs = read(), old = id ? find(id, version) : undefined;
      if (!id && data.definitionId && xs.some((x) => x.category === data.category && x.definitionId === data.definitionId)) throw Error("Já existe um registro para essa definição.");
      const eid = id ?? crypto.randomUUID();
      store(key, [...xs.filter((x) => x.id !== eid), { ...old, ...data, sheet: data.sheet ?? old?.sheet, id: eid, version: version + 1, visible: old?.visible ?? false, revealed: old?.revealed ?? [], announced: old?.announced ?? [], registered: !!(old?.registered || (data.registered ?? true)) }]);
      announce(eid);
      return eid;
    },
    reveal: async (cid, id, version, data) => {
      check(); scope(cid);
      const old = find(id, version);
      if (data.links) store(key + ":links", links().map((l) => (l.id in data.links! ? { ...l, revealed: data.links![l.id] } : l)));
      store(key, read().map((x) => (x.id === id ? { ...old, visible: data.visible, revealed: [...data.revealed], sheet: data.sheet ?? old.sheet, registered: old.registered || data.visible, version: version + 1 } : x)));
      announce(id);
    },
    preview: async (cid, id) => { check(); scope(cid); const e = find(id); return e.visible ? { entry: project(e), links: linksOf(id, true) } : { entry: null, links: [] }; },
    remove: async (cid, id, version) => { check(); scope(cid); find(id, version); store(key, read().filter((x) => x.id !== id)); },
    upload: async () => { throw Error("Upload exige Storage privado. A demonstração não envia arquivos."); },
    image: async () => { throw Error("Imagem indisponível."); },
    holders: async () => [],
    definitions: async (cid) => {
      scope(cid);
      const all = parse<LinhaDefinicao>(key + ":definitions");
      return master ? all : all.filter((d) => d.kind === "item" && read().some((e) => e.visible && e.definitionId === d.definitionId && e.category === d.kind && identified(e)));
    },
    bancoDeNpcs: async () => true,
    vidas: async (cid) => { scope(cid); return master ? vidas() : []; },
    gravarVida: async (cid, noteId, patch, _operacao, version) => {
      check(); scope(cid);
      const antes = vidas().find(v => v.noteId === noteId);
      if ((patch.pv !== undefined || patch.temp !== undefined || patch.condicoes !== undefined) && version !== (antes?.version ?? 0)) throw Error("Outra sessão alterou este registro. Recarregue antes de salvar.");
      const nova: LinhaVida = { noteId, estado: "vivo", pv: null, temp: 0, condicoes: [], ...antes, ...patch, version: (antes?.version ?? 0) + 1 };
      store(key + ":vida", [...vidas().filter(v => v.noteId !== noteId), nova]);
      return nova;
    },
    // as mesmas regras da 0022: uma ficha por NPC e confirmação para perder a atual (a cópia de 30 dias é só do servidor)
    definirFichaNpc: async (cid, id, version, nova, pedido) => {
      check(); scope(cid);
      const old = find(id, version), propria = "custom-npc-" + id;
      const removida = fichasNpc?.revisao(id) !== undefined ? "personagem" : old.combatDefinitionId === propria ? "criatura" : null;
      if (removida && !pedido.confirmar) throw Error("Confirme a remoção da ficha atual.");
      if (removida === "personagem" && pedido.revisao !== fichasNpc!.revisao(id)) throw Error("A ficha mudou em outra sessão. Recarregue antes de substituir ou remover; nada foi alterado.");
      if (nova?.tipo === "personagem" && !fichasNpc) throw Error("A demonstração sem fichas não cria ficha de personagem.");
      const defs = parse<LinhaDefinicao>(key + ":definitions").filter(d => d.definitionId !== propria);
      store(key + ":definitions", nova?.tipo === "criatura" ? [...defs, { kind: "monster" as const, definitionId: propria, baseId: nova.base, version: 1, data: { definition: nova.definicao } }] : defs);
      fichasNpc?.definir(cid, id, nova?.tipo === "personagem" ? nova.draft : null);
      store(key + ":vida", vidas().map(v => v.noteId === id ? { ...v, pv: null, temp: 0, condicoes: [], version: v.version + 1 } : v));
      store(key, read().map(x => x.id === id ? { ...old, characterSheet: nova?.tipo === "personagem" || undefined, combatDefinitionId: nova?.tipo === "criatura" ? propria : undefined, version: version + 1 } : x));
      return { revision: nova?.tipo === "personagem" ? 1 : undefined };
    },
    setCombatSheet: async (cid, id, version, definitionId) => {
      check(); scope(cid);
      const old = find(id, version);
      store(key, read().map((x) => (x.id === id ? { ...old, combatDefinitionId: definitionId ?? undefined, version: version + 1 } : x)));
    },
    saveDefinition: async (cid, d, sheet, baseName) => {
      check(); scope(cid);
      const all = parse<LinhaDefinicao>(key + ":definitions"), same = (x: LinhaDefinicao) => x.kind === d.kind && x.definitionId === d.definitionId, old = all.find(same);
      if ((old?.version ?? 0) !== d.version) throw Error("Conflito de versão.");
      store(key + ":definitions", [...all.filter((x) => !same(x)), { ...d, version: d.version + 1 }]);
      sync(d.definitionId, sheet, (old?.data.definition as { nome?: string } | undefined)?.nome ?? baseName, (d.data.definition as { nome: string }).nome);
      return d.version + 1;
    },
    removeDefinition: async (cid, kind, id, version, sheet, originalName) => {
      check(); scope(cid);
      const all = parse<LinhaDefinicao>(key + ":definitions"), old = all.find((x) => x.kind === kind && x.definitionId === id);
      if (!old || old.version !== version) throw Error("Conflito de versão.");
      if (id.startsWith("custom-")) { if (read().some((e) => e.definitionId === id)) throw Error("Há uma página da campanha ligada a esta criação."); }
      else sync(id, sheet!, (old.data.definition as { nome: string }).nome, originalName!);
      store(key + ":definitions", all.filter((x) => x !== old));
    },
    seenAll: async (cid,through,signal) => { signal.throwIfAborted();scope(cid);if(!master){const visible=new Set(read().filter(e=>e.visible).map(e=>e.id));store(key+":notices",notices().map(n=>n.id<=through&&!n.read_at&&visible.has(n.entry_id)?{...n,read_at:new Date().toISOString()}:n));} },
    seen: async (id) => { if (!master) store(key + ":notices", notices().map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))); },
  };
  return api;
}
