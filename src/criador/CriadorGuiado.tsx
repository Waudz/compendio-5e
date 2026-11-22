import { metodoPreservado, manualValido, type MetodoAtributos } from './atributos-2014';
// Criador guiado de personagem (aba `criador:<id>`), hoje só o Guerreiro. Reaproveita as regras de `src/rules` e o catálogo
// canônico; não duplica lógica. Ficha, equipamento inicial, inventário (dentro da ficha) e identidade pública em seções.
// Persistência por `RepositorioPersonagem`: SERVIDOR (Supabase, ficha privada + identidade pública, revisão otimista) quando há conta e a API de fichas;
// senão o armazenamento local EXPERIMENTAL (`armazenamento.ts`: sem segurança entre usuários e sem sincronização).
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useRef, lazy, Suspense } from "react";
import { useAuth } from "../AuthContext";
import { useCampaigns } from "../CampaignsContext";
import { useFichas } from "../RegistrosContext";
import { itemSpec } from "../Compendio";
import { Aviso } from "../Diario";
import { srdItem } from "../catalogue/srd-2014-items";
import { ERRO_CONFLITO_REVISAO } from "../fichas";
import { avisarRegistros, registrarTitulo } from "../registrosStore";
import { buildPilotCharacterCatalog } from "../rules/character-catalogue-adapter";
import { searchCompendium } from "../rules/compendium-query";
import { ABILITY_ORDER, POINT_BUY_BUDGET, pointBuySpent, validatePointBuy } from "../rules/ability-generation-2014";
import { addInventoryInstance, changeInventoryInstanceQuantity, createCharacterSheet, type CharacterDraft, type InventoryEntry } from "../rules/character-domain";
import { fighter2014Advancements } from "../rules/fighter-2014";
import { defaultPublicIdentity, type PublicIdentitySettings } from "../rules/public-identity";
import { useUnsavedGuard } from "../unsaved";
import type { TabSpec } from "../workspace";
import { armazenamentoLocalExperimental, type ArmazenamentoCriador } from "./armazenamento";
import { ErroConflito, repositorioLocal, repositorioServidor, type RepositorioPersonagem } from "./repositorio";
import { ehPersonagemNovo, gravarMapaAba, gravarRecuperacao, lerMapaAba, lerRecuperacao, limparRecuperacao, type Recuperacao } from "./recuperacao";
import { criadorRefs, criadorRules } from "./catalogo-criador";
// O snapshot de personagens não entra no carregamento da navegação/catálogos gerais.
let regras2014: typeof import('./regras-2014') | undefined;
const carregar2014 = async () => { regras2014 = await import('./regras-2014'); return regras2014; };
const Opcoes2014 = lazy(async () => { await carregar2014(); return { default: (await import('./Opcoes2014')).Opcoes2014 }; });
const Equipamento2014 = lazy(async () => { await carregar2014(); return { default: (await import('./Opcoes2014')).Equipamento2014 }; });
const Resumo2014 = lazy(async () => { await carregar2014(); return { default: (await import('./Opcoes2014')).Resumo2014 }; });
const modern2014 = (d: CharacterDraft) => d.catalogueVersion === 'character-srd-2014-v2';
const sheet2014 = (d: CharacterDraft) => { if (!regras2014) throw new Error('Carregando regras de personagem…'); return regras2014.sheet2014(d); };
const label2014 = (id: string) => regras2014?.label2014(id) ?? id;
const featureDescription2014 = (id: string) => regras2014?.featureDescription2014(id) ?? '';
import PublicIdentityEditor from "./identidade-publica-editor";
import { rotuloAtributo, rotuloOpcao, rotuloPericia } from "./rotulos";

const { catalog } = buildPilotCharacterCatalog(criadorRules, { race: criadorRefs.race, background: criadorRefs.background, class: criadorRefs.class }, fighter2014Advancements);
const calcularFicha = (draft: CharacterDraft) => modern2014(draft) ? sheet2014(draft) : createCharacterSheet(draft, catalog);
type Secao = "ficha" | "equipamento" | "inventario" | "identidade";
type Metodo = MetodoAtributos;
const maxHpBase = (con: number) => 10 + Math.floor((con + 2 - 10) / 2);   // 10 + modificador de Constituição (Anão: +2 racial), nível 1

const novoRascunho = (id: string): CharacterDraft => ({ id, name: "", ruleset: "5e-2014", catalogueVersion: "character-srd-2014-v2", baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
  raceId: "hill-dwarf", backgroundId: "acolyte", classId: "fighter", level: 1, decisions: [], inventory: [], currentHp: 13, temporaryHp: 0, spentResources: {} });
/** Erros do domínio estão em inglês; a interface mostra a versão em português. */
const erroDeAtributo = (e: unknown) => { const m = e instanceof Error ? e.message : String(e); return /budget exceeded/i.test(m) ? "A compra de pontos passa de 27 pontos. Reduza outro atributo antes." : /between 8 and 15/i.test(m) ? "Na compra de pontos cada atributo vai de 8 a 15." : m; };
const nomeDoItem = (itemId: string) => srdItem(itemId)?.nome ?? itemId;
const nomeDaInstancia = (item: InventoryEntry) => typeof item.customName === "string" ? item.customName : nomeDoItem(item.itemId);
const gruposCompletos = (d: CharacterDraft) => d.decisions.some(c => c.id === 'equipment-accepted' && c.optionIds.includes('yes')) && d.decisions.some(c => c.id === 'background-equipment' && c.optionIds.includes('accepted'));

export function CriadorGuiado({ id, onOpenContent }: { id: string; onOpenContent: (s: TabSpec) => void }) {
  const { user } = useAuth(), { active } = useCampaigns(), fichas = useFichas();
  const aviso = (t: string) => <div className="content"><h1>Personagem</h1><Aviso t={t}/></div>;
  const store = useMemo<ArmazenamentoCriador | null>(() => { try { return user && active ? armazenamentoLocalExperimental(user.id, active.campaign.id) : null; } catch { return null; } }, [user, active]);
  const repo = useMemo<RepositorioPersonagem | null>(() => !user || !active || !store ? null : fichas ? repositorioServidor(fichas, active.campaign.id, user.id) : repositorioLocal(store), [user, active, store, fichas]);
  if (!user) return aviso("Conta necessária para usar o criador de personagens.");
  if (!active) return aviso("Os personagens pertencem a uma campanha. Escolha uma campanha ativa na barra lateral.");
  if (!store || !repo) return aviso("Não foi possível preparar o armazenamento deste usuário e campanha.");
  return <Editor key={`${active.campaign.id}:${id}`} id={id} repo={repo} store={store} userId={user.id} campaignId={active.campaign.id} campanha={active.campaign.name} onOpenContent={onOpenContent}/>;
}

function Editor({ id, repo, store, userId, campaignId, campanha, onOpenContent }: { id: string; repo: RepositorioPersonagem; store: ArmazenamentoCriador; userId: string; campaignId: string; campanha: string; onOpenContent: (s: TabSpec) => void }) {
  const servidor = repo.tipo === "servidor";
  const [carga, setCarga] = useState<"carregando" | "pronto" | { erro: string }>("carregando"), [tentativa, setTentativa] = useState(0);
  const [draft, setDraft] = useState<CharacterDraft>(() => novoRascunho(id));
  const nameRef = useRef<HTMLInputElement>(null);
  const previousVersion = useRef(draft.catalogueVersion);
  useEffect(() => {
    if (previousVersion.current !== draft.catalogueVersion && modern2014(draft)) nameRef.current?.focus();
    previousVersion.current = draft.catalogueVersion;
  }, [draft.catalogueVersion]);
  const [identity, setIdentity] = useState<PublicIdentitySettings>(defaultPublicIdentity), [publicar, setPublicar] = useState(false);
  const [salvo, setSalvo] = useState<string | null>(null);          // retrato do último estado salvo (null = nunca salvo)
  const [idReal, setIdReal] = useState(id), [existe, setExiste] = useState(false), [revisao, setRevisao] = useState<number | null>(null), [somenteFicha, setSomenteFicha] = useState(false);
  const [salvando, setSalvando] = useState(false), [conflito, setConflito] = useState(false), [recuperacao, setRecuperacao] = useState<Recuperacao | null>(null);
  const [secao, setSecao] = useState<Secao>("ficha");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [metodo, setMetodo] = useState<Metodo>("point-buy"), [erroAtrib, setErroAtrib] = useState("");
  const [busca, setBusca] = useState(""), [excluindo, setExcluindo] = useState(false);

  const aplicarCarregado = (p: { id: string; draft: CharacterDraft; identity: PublicIdentitySettings; publicar: boolean; revision: number | null; somenteFicha: boolean }) => {
    calcularFicha(p.draft);   // dado inválido/de outra versão falha aqui, não na tela
    setDraft(p.draft); setIdentity(p.identity); setPublicar(p.publicar); setIdReal(p.id); setExiste(true); setRevisao(p.revision); setSomenteFicha(p.somenteFicha);
    setSalvo(JSON.stringify({ draft: p.draft, identity: p.identity, publicar: p.publicar }));
    setMetodo(metodoPreservado(p.draft.baseAbilities, p.draft.abilityMethod));
    registrarTitulo(id, p.draft.name.trim() || "Novo personagem"); registrarTitulo(p.id, p.draft.name.trim() || "Novo personagem");
  };
  useEffect(() => {
    let vivo = true; setCarga("carregando");
    (async () => {
      try {
        const novoNaoSalvo = ehPersonagemNovo(id), alvo = servidor && novoNaoSalvo ? lerMapaAba(userId, campaignId, id) ?? id : id;
        // Uma aba `novo-*` ainda não corresponde a uma ficha no banco; o servidor exige UUID. No modo local, porém, a aba `novo-*` pode já estar salva e precisa ser carregada.
        const p = servidor && novoNaoSalvo && alvo === id ? null : await repo.carregar(alvo);
        if (!vivo) return;
        if (!p && (!novoNaoSalvo || alvo !== id)) { setCarga({ erro: "Personagem não encontrado, removido ou sem acesso (por exemplo, você saiu da campanha). Nada foi alterado." }); return; }   // nunca abre um editor vazio no lugar de um personagem existente
        await carregar2014(); if (!vivo) return;
        if (p && !modern2014(p.draft)) { setCarga({ erro: "Ficha criada no protótipo antigo. Esta versão aceita somente personagens SRD 2014." }); return; }
        if (p) aplicarCarregado(p); else { registrarTitulo(id, "Novo personagem"); }
        if (servidor) setRecuperacao(lerRecuperacao(userId, campaignId, id));   // alterações não enviadas de uma falha anterior
        setCarga("pronto");
      } catch (e) { if (vivo) setCarga({ erro: e instanceof Error ? e.message : "Não foi possível ler o personagem salvo." }); }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, id, tentativa]);

  const retrato = JSON.stringify({ draft, identity, publicar });
  const vazio = JSON.stringify({ draft: novoRascunho(id), identity: defaultPublicIdentity(), publicar: false });
  const sujo = carga === "pronto" && retrato !== (salvo ?? vazio) && (salvo !== null || draft.name.trim() !== "" || draft.inventory.length > 0 || draft.decisions.length > 0);
  const { sheet, erro } = useMemo(() => { try { return { sheet: calcularFicha({ ...draft, name: draft.name.trim() || "Sem nome" }), erro: "" }; }  catch (e) { return { sheet: null, erro: e instanceof Error ? e.message : String(e) }; } }, [draft]);
  const mudar = (proximo: CharacterDraft) => { setDraft(proximo); setMsg(null); };

  const alterarNivel = (level: number) => {
    try { mudar(modern2014(draft) ? regras2014!.progressLevel2014(draft, level) : { ...draft, level }); setErroAtrib(''); }
    catch (e) { setErroAtrib(e instanceof Error ? e.message : 'Revise os recursos e as rolagens de PV antes de mudar o nível.'); }
  };

  const salvar = useCallback(async (): Promise<boolean> => {
    if (salvando) return false;
    if (!sheet || !draft.name.trim()) { setMsg({ ok: false, t: "Informe o nome e corrija os erros antes de salvar." }); return false; }
    const estado = { draft, identity, publicar };
    setSalvando(true);
    try {
      const r = await repo.salvar({ id: idReal, existe, revisao, estado, somenteFicha, source: { name: draft.name, surname: "", race: modern2014(draft) ? label2014(draft.raceId) : "Anão", characterClass: modern2014(draft) ? label2014(draft.classId) : "Guerreiro" } });
      const gravado = { ...draft, id: r.id };
      setDraft(gravado); setIdReal(r.id); setExiste(true); setRevisao(r.revision); setConflito(false); setRecuperacao(null);
      setSalvo(JSON.stringify({ draft: gravado, identity, publicar }));
      limparRecuperacao(userId, campaignId, id);
      if (servidor && ehPersonagemNovo(id)) gravarMapaAba(userId, campaignId, id, r.id);
      registrarTitulo(id, draft.name.trim()); registrarTitulo(r.id, draft.name.trim()); avisarRegistros();
      const incompleto = sheet.pending.length || !gruposCompletos(draft);
      setMsg({ ok: true, t: servidor ? `${incompleto ? "Rascunho incompleto" : "Personagem"} salvo na campanha (revisão ${r.revision}).` : `${incompleto ? "Rascunho incompleto salvo" : "Personagem salvo"} neste navegador (armazenamento experimental).` });
      return true;
    } catch (e) {
      const texto = e instanceof Error ? e.message : "Não foi possível salvar.";
      const guardou = servidor && gravarRecuperacao(userId, campaignId, id, { estado, baseRevisao: revisao, motivo: texto, em: new Date().toISOString() });
      if (e instanceof ErroConflito) setConflito(true);
      setMsg({ ok: false, t: `${texto} Suas alterações continuam na tela${guardou ? " e foram guardadas neste navegador" : ""}.` });
      return false;
    } finally { setSalvando(false); }
  }, [salvando, sheet, draft, identity, publicar, repo, idReal, existe, revisao, somenteFicha, servidor, userId, campaignId, id]);
  useUnsavedGuard(`criador:${id}`, sujo, salvar);

  /** Conflito de revisão: carrega a versão atual do servidor. As alterações não enviadas ficam na cópia de recuperação (restauráveis). */
  const recarregarServidor = async () => {
    try { const p = await repo.carregar(idReal); if (!p) { setMsg({ ok: false, t: "Personagem não encontrado ou sem permissão." }); return; } aplicarCarregado(p); setConflito(false); setRecuperacao(lerRecuperacao(userId, campaignId, id)); setMsg({ ok: true, t: "Versão atual carregada do servidor. Suas alterações anteriores continuam guardadas para restaurar." }); }
    catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : "Não foi possível recarregar." }); }
  };
  const restaurar = () => { if (!recuperacao) return; try { createCharacterSheet(recuperacao.estado.draft, catalog); } catch { setMsg({ ok: false, t: "A cópia guardada é inválida e não pôde ser restaurada." }); return; }
    setDraft({ ...recuperacao.estado.draft, id: idReal }); setIdentity(recuperacao.estado.identity); setPublicar(recuperacao.estado.publicar); setEscolhas(escolhasDoInventario(recuperacao.estado.draft)); limparRecuperacao(userId, campaignId, id); setRecuperacao(null); setMsg({ ok: true, t: "Alterações restauradas. Revise e clique em Salvar." }); };
  const descartarRecuperacao = () => { limparRecuperacao(userId, campaignId, id); setRecuperacao(null); };

  if (carga === "carregando") return <div className="content"><p className="muted" role="status">Carregando personagem…</p></div>;
  if (typeof carga === "object") return <div className="content"><h1>Personagem</h1><Aviso erro t={`Não foi possível abrir este personagem: ${carga.erro}`} onRetry={() => setTentativa(n => n + 1)}/>
    {!servidor && <div className="row"><button className="btn-secondary danger" onClick={() => { store.excluir(id); setCarga("pronto"); setDraft(novoRascunho(id)); setSalvo(null); }}>Descartar dado corrompido e recomeçar</button></div>}</div>;

  const alterarAtributo = (a: typeof ABILITY_ORDER[number], valor: number) => {
    const novo = { ...draft.baseAbilities, [a]: valor };
    if (metodo === 'preserved') return;
    if (metodo === 'manual') {
      if (!manualValido(novo)) { setErroAtrib('Informe uma rolagem inteira entre 3 e 18, antes dos bônus raciais.'); return; }
      setErroAtrib(''); mudar({ ...draft, baseAbilities: novo, abilityMethod: 'manual', currentHp: Math.min(draft.currentHp, modern2014(draft) ? sheet2014({ ...draft, baseAbilities: novo, currentHp: 0 }).maxHp : maxHpBase(novo.con)) }); return;
    }
    if (metodo === "standard-array") {
      const outro = ABILITY_ORDER.find(k => k !== a && draft.baseAbilities[k] === valor);
      if (!outro) return;                                                             // matriz padrão: só troca de posição entre dois valores
      const troca = { ...draft.baseAbilities, [a]: valor, [outro]: draft.baseAbilities[a] };
      setErroAtrib(""); mudar({ ...draft, baseAbilities: troca, currentHp: Math.min(draft.currentHp, modern2014(draft) ? sheet2014({ ...draft, baseAbilities: troca, currentHp: 0 }).maxHp : maxHpBase(troca.con)) }); return;
    }
    try { validatePointBuy(novo); setErroAtrib(""); mudar({ ...draft, baseAbilities: novo, currentHp: Math.min(draft.currentHp, modern2014(draft) ? sheet2014({ ...draft, baseAbilities: novo, currentHp: 0 }).maxHp : maxHpBase(novo.con)) }); }
    catch (e) { setErroAtrib(erroDeAtributo(e)); }
  };
  const trocarMetodo = (m: Metodo) => {
    if (m === 'preserved') return;
    if (m === 'manual') { if (!manualValido(draft.baseAbilities)) { setErroAtrib('Valores antigos foram preservados; rolagens manuais de criação precisam estar entre 3 e 18.'); return; } setMetodo(m); setErroAtrib(''); mudar({ ...draft, abilityMethod: 'manual' }); return; }
    setMetodo(m); setErroAtrib("");
    const base = m === "standard-array" ? { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } : { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 };
    mudar({ ...draft, abilityMethod: m, baseAbilities: base, currentHp: modern2014(draft) ? sheet2014({ ...draft, baseAbilities: base, currentHp: 0 }).maxHp : maxHpBase(base.con) });
  };

  const resultadosBusca = busca.trim().length >= 2 ? searchCompendium(criadorRules, { kind: "item", text: busca }).filter(l => srdItem(l.ref.id)?.raridade === "mundano").slice(0, 8) : [];
  const completo = !!sheet && !!draft.name.trim() && !sheet.pending.length && gruposCompletos(draft);
  const sec = (s: Secao, rotulo: string) => <button type="button" className={secao === s ? "active" : ""} aria-current={secao === s ? "true" : undefined} onClick={() => setSecao(s)}>{rotulo}</button>;

  return <div className="content ficha auth wide criador">
    <div className="eyebrow">{campanha.toLocaleUpperCase("pt-BR")} · CRIADOR GUIADO · {modern2014(draft) ? label2014(draft.classId).toLocaleUpperCase("pt-BR") : "GUERREIRO"} (SRD 2014)</div>
    <div className="row-between"><h1>{draft.name.trim() || "Novo personagem"}</h1>
      <button type="button" className="btn-primary" onClick={() => void salvar()} disabled={salvando || (!sujo && salvo !== null)}>{salvando ? "Salvando…" : "Salvar"}</button></div>
    {servidor
      ? <div className="notice ok" role="note" data-testid="aviso-servidor">{somenteFicha ? "Ficha de outro jogador: você a vê e edita como mestre da campanha. A identidade pública continua sendo do dono." : "Salvo na campanha: só você e o mestre leem esta ficha. Os outros jogadores veem apenas a identidade pública que você publicar."} {modern2014(draft) ? "Versão de personagens SRD 2014 ativa." : "Raça (Anão) e antecedente (Acólito) são ilustrativos."}</div>
      : <div className="notice" role="note" data-testid="aviso-armazenamento">Armazenamento <strong>experimental</strong>: o personagem fica só neste navegador, não sincroniza entre aparelhos e não é privado de quem usa o mesmo navegador. Sem conta e API de fichas não há salvamento real na campanha. {modern2014(draft) ? "Versão de personagens SRD 2014 ativa." : "Raça (Anão) e antecedente (Acólito) são ilustrativos."}</div>}
    {conflito && <div className="notice err" role="alert" data-testid="aviso-conflito"><p>{ERRO_CONFLITO_REVISAO}</p><div className="row"><button type="button" className="btn-primary" onClick={() => void recarregarServidor()}>Carregar a versão atual</button><button type="button" className="btn-secondary" onClick={() => setConflito(false)}>Continuar editando</button></div></div>}
    {recuperacao && <div className="notice" role="status" data-testid="aviso-recuperacao"><p>Há alterações deste personagem que não chegaram ao servidor ({recuperacao.motivo || "falha anterior"}), guardadas neste navegador em {new Date(recuperacao.em).toLocaleString("pt-BR")}.</p><div className="row"><button type="button" className="btn-primary" onClick={restaurar}>Restaurar essas alterações</button><button type="button" className="btn-secondary" onClick={descartarRecuperacao}>Descartar</button></div></div>}
    <nav className="ficha-subnav" aria-label="Seções do personagem">{sec("ficha", "Ficha")}{sec("equipamento", "Equipamento inicial")}{sec("inventario", "Inventário")}{sec("identidade", "Identidade pública")}</nav>
    {msg && <Aviso erro={!msg.ok} t={msg.t}/>}
    {erro && <Aviso erro t={erro}/>}
    {sujo && <p className="muted" role="status">Alterações não salvas.</p>}

    {secao === "ficha" && <div className="criador-sec">
      <label>Nome do personagem<input ref={nameRef} aria-label="Nome do personagem" value={draft.name} maxLength={120} onChange={e => mudar({ ...draft, name: e.target.value })}/></label>
      <Suspense fallback={<p role="status">Carregando opções de personagem…</p>}><Opcoes2014 draft={draft} onChange={mudar}/></Suspense>
      <fieldset><legend>Atributos-base (antes dos bônus raciais)</legend>
        <label>Método<select aria-label="Método de atributos" value={metodo} onChange={e => trocarMetodo(e.target.value as Metodo)}><option value="point-buy">Compra de pontos (27)</option><option value="standard-array">Matriz padrão</option><option value="manual">Rolagens manuais (3–18)</option>{metodo === "preserved" && <option value="preserved">Valores preservados da ficha</option>}</select></label>
        {metodo === "point-buy" && <p className="muted">Pontos gastos: {pointBuySpent(draft.baseAbilities)} / {POINT_BUY_BUDGET}</p>}
        {metodo === "preserved" && <p role="note">Os atributos desta ficha foram preservados. Selecione outro método somente se deseja redistribuí-los; nada será salvo automaticamente.</p>}{metodo === "manual" && <p>Role 4d6, descarte o menor dado e informe a soma dos três restantes em cada atributo, antes dos bônus raciais.</p>}
        <div className="criador-atributos">{ABILITY_ORDER.map(a => <label key={a}>{rotuloAtributo(a)}
          {metodo === "manual" ? <input type="number" aria-label={"Atributo " + a} min={3} max={18} value={draft.baseAbilities[a]} onChange={e => alterarAtributo(a, Number(e.target.value))}/> : <select disabled={metodo === "preserved"} aria-label={"Atributo " + a} value={draft.baseAbilities[a]} onChange={e => alterarAtributo(a, Number(e.target.value))}>
            {(metodo === "preserved" ? [draft.baseAbilities[a]] : metodo === "standard-array" ? [15, 14, 13, 12, 10, 8] : [8, 9, 10, 11, 12, 13, 14, 15]).map(v => <option key={v} value={v}>{v}</option>)}</select>}</label>)}</div>
        {erroAtrib && <p role="alert" className="notice err">{erroAtrib}</p>}
      </fieldset>
      <label>Nível<select aria-label="Nível" value={draft.level} onChange={e => alterarNivel(Number(e.target.value))}>{(modern2014(draft) ? Array.from({ length: 20 }, (_, i) => i + 1) : [1, 2, 3, 4, 5, 6]).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      {sheet && <section aria-label="Ficha calculada" className="criador-ficha">
        <h2>Ficha calculada</h2>
        <p>{ABILITY_ORDER.map(a => `${rotuloAtributo(a)} ${sheet.abilities[a]}`).join(" · ")}</p>
        <p>PV máximo: {sheet.maxHp}</p>
        <p>Características: {sheet.features.map(id => modern2014(draft) ? label2014(id) : rotuloOpcao(id)).join(", ") || "nenhuma"}</p>
        <p>Perícias: {sheet.skills.map(rotuloPericia).join(", ") || "nenhuma"}</p>
        {modern2014(draft) && <details><summary>Descrições das características de classe</summary>{sheet.features.filter(id => featureDescription2014(id)).map(id => <details key={id}><summary>{label2014(id)}</summary><p style={{ whiteSpace: 'pre-wrap' }}>{featureDescription2014(id)}</p></details>)}</details>}
        <p>Recursos: {Object.entries(sheet.resources).map(([n, v]) => `${rotuloOpcao(n)} ${v.remaining}/${v.maximum}`).join(" · ") || "nenhum"}</p>
        <p>Escolhas pendentes: {sheet.pending.length ? sheet.pending.map(rotuloOpcao).join(", ") : "nenhuma"}</p>
        <p role="note"><strong>{completo ? "Estado: escolhas concluídas" : "Estado: rascunho incompleto"}</strong></p>
      </section>}
    </div>}

    {secao === "ficha" && modern2014(draft) && !erro && <Suspense fallback={<p role="status">Carregando resumo…</p>}><Resumo2014 draft={draft} onChange={mudar}/></Suspense>}
    {secao === "equipamento" && <Suspense fallback={<p role="status">Carregando equipamento…</p>}><Equipamento2014 draft={draft} onChange={mudar}/></Suspense>}

    {secao === "inventario" && <section className="criador-sec ficha-inventario" aria-label="Inventário">
      <h2>Inventário</h2>
      {sheet && sheet.inventory.length === 0 && <p className="muted" data-testid="inventario-vazio">Inventário vazio. Confirme o equipamento inicial ou adicione itens do catálogo abaixo.</p>}
      <ul>{sheet?.inventory.map(item => { const def = srdItem(item.itemId); return <li key={item.id}>
        <span><strong>{nomeDaInstancia(item)}</strong> · quantidade {item.quantity}{item.origin === "starting" ? " · inicial" : ""}{def?.peso != null ? ` · ${String(def.peso * item.quantity).replace(".", ",")} kg` : ""}</span>
        <span className="row">
          {def && <button type="button" className="btn-secondary" aria-label={`Consultar no Compêndio: ${nomeDaInstancia(item)}`} onClick={() => onOpenContent(itemSpec(item.itemId, nomeDaInstancia(item)))}>Consultar no Compêndio</button>}
          <button type="button" className="btn-secondary" aria-label={`+1: adicionar quantidade de ${nomeDaInstancia(item)}`} onClick={() => mudar(changeInventoryInstanceQuantity(draft, item.id, 1))}>+1</button>
          <button type="button" className="btn-secondary" aria-label={`−1: remover quantidade de ${nomeDaInstancia(item)}`} onClick={() => mudar(changeInventoryInstanceQuantity(draft, item.id, -1))}>−1</button></span></li>; })}</ul>
      <label>Adicionar item do catálogo<input type="search" aria-label="Buscar item para adicionar" value={busca} placeholder="Digite ao menos 2 letras" onChange={e => setBusca(e.target.value)}/></label>
      {busca.trim().length >= 2 && resultadosBusca.length === 0 && <p className="muted">Nenhum item mundano encontrado.</p>}
      <ul>{resultadosBusca.map(l => <li key={l.key}><span>{l.name}</span><button type="button" className="btn-secondary" aria-label={`Adicionar ${l.name}`} onClick={() => { mudar(addInventoryInstance(draft, { id: crypto.randomUUID(), itemId: l.ref.id, quantity: 1, equipped: false, origin: "acquired" })); setBusca(""); }}><Plus size={14} aria-hidden="true"/> Adicionar</button></li>)}</ul>
    </section>}

    {secao === "identidade" && <div className="criador-sec">
      {somenteFicha ? <Aviso t="A identidade pública pertence ao dono do personagem. Como mestre, você edita a ficha, mas não altera nem lê a identidade privada dele."/> : <>
      <p className="muted">O cartão público é separado da ficha privada: nível, PV, atributos, inventário e anotações nunca aparecem nele.{servidor ? " Só o que você publicar aparece para os outros jogadores." : " Vale para a prévia local; a publicação na campanha exige conta e a API de fichas."}</p>
      {servidor && <label className="check"><input type="checkbox" aria-label="Publicar identidade na campanha" checked={publicar} onChange={e => { setPublicar(e.target.checked); setMsg(null); }}/> Publicar a identidade pública na campanha (aparece em Personagens e no Início)</label>}
      <PublicIdentityEditor key={draft.id} source={{ name: draft.name, surname: "", race: modern2014(draft) ? label2014(draft.raceId) : "Anão", characterClass: modern2014(draft) ? label2014(draft.classId) : "Guerreiro" }} initialSettings={identity}
        onSave={s => { setIdentity(s); setMsg({ ok: true, t: "Identidade pública atualizada. Clique em Salvar para guardá-la." }); }}/></>}
    </div>}

    <div className="row criador-rodape">
      {servidor ? <p className="muted" data-testid="exclusao-indisponivel">A exclusão e a transferência de personagens salvos na campanha seguem o fluxo narrativo (ainda não disponível aqui); por isso não há botão de excluir.</p>
        : !excluindo ? <button type="button" className="btn-secondary danger" onClick={() => setExcluindo(true)} disabled={salvo === null}><Trash2 size={15} aria-hidden="true"/> Excluir personagem</button>
        : <><button type="button" className="btn-secondary danger" onClick={() => { store.excluir(id); setSalvo(null); registrarTitulo(id, "Personagem excluído"); avisarRegistros(); setDraft(novoRascunho(id)); setIdentity(defaultPublicIdentity()); setExcluindo(false); setMsg({ ok: true, t: "Personagem excluído deste navegador." }); }}>Confirmar exclusão</button>
          <button type="button" className="btn-secondary" onClick={() => setExcluindo(false)}>Cancelar</button></>}
    </div>
  </div>;
}
