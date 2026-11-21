// Criador guiado de personagem (aba `criador:<id>`), hoje só o Guerreiro. Reaproveita as regras de `src/rules` e o catálogo
// canônico; não duplica lógica. Ficha, equipamento inicial, inventário (dentro da ficha) e identidade pública em seções.
// Persistência por `RepositorioPersonagem`: SERVIDOR (Supabase, ficha privada + identidade pública, revisão otimista) quando há conta e a API de fichas;
// senão o armazenamento local EXPERIMENTAL (`armazenamento.ts`: sem segurança entre usuários e sem sincronização).
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext";
import { useCampaigns } from "../CampaignsContext";
import { useFichas } from "../RegistrosContext";
import { itemSpec } from "../Compendio";
import { Aviso } from "../Diario";
import { srdItem, srdItemIds } from "../catalogue/srd-2014-items";
import { ERRO_CONFLITO_REVISAO } from "../fichas";
import { avisarRegistros, registrarTitulo } from "../registrosStore";
import { buildPilotCharacterCatalog } from "../rules/character-catalogue-adapter";
import { searchCompendium } from "../rules/compendium-query";
import { ABILITY_ORDER, POINT_BUY_BUDGET, isStandardArray, pointBuySpent, validatePointBuy } from "../rules/ability-generation-2014";
import { addInventoryInstance, changeInventoryInstanceQuantity, createCharacterSheet, type CharacterDraft } from "../rules/character-domain";
import { fighter2014Advancements } from "../rules/fighter-2014";
import { defaultPublicIdentity, type PublicIdentitySettings } from "../rules/public-identity";
import { fighterEquipmentOptions2014 } from "../rules/starting-equipment-2014";
import { applyStartingEquipmentSelection, replaceStartingEquipmentSelection } from "../rules/starting-equipment-selection";
import { useUnsavedGuard } from "../unsaved";
import type { TabSpec } from "../workspace";
import { armazenamentoLocalExperimental, type ArmazenamentoCriador } from "./armazenamento";
import { ErroConflito, repositorioLocal, repositorioServidor, type RepositorioPersonagem } from "./repositorio";
import { ehPersonagemNovo, gravarMapaAba, gravarRecuperacao, lerMapaAba, lerRecuperacao, limparRecuperacao, type Recuperacao } from "./recuperacao";
import { criadorRefs, criadorRules } from "./catalogo-criador";
import PublicIdentityEditor from "./identidade-publica-editor";
import { rotuloAtributo, rotuloOpcao, rotuloPericia } from "./rotulos";

const { catalog, ids } = buildPilotCharacterCatalog(criadorRules, { race: criadorRefs.race, background: criadorRefs.background, class: criadorRefs.class }, fighter2014Advancements);
type Secao = "ficha" | "equipamento" | "inventario" | "identidade";
type Metodo = "point-buy" | "standard-array";
const GRUPOS: Record<string, string> = { armor: "Armadura", weapons: "Armas marciais", ranged: "Armas adicionais", pack: "Pacote de aventureiro" };
const PREFIXO = (group: string) => "starting-choice:fighter-" + group + ":";
const maxHpBase = (con: number) => 10 + Math.floor((con + 2 - 10) / 2);   // 10 + modificador de Constituição (Anão: +2 racial), nível 1

const novoRascunho = (id: string): CharacterDraft => ({ id, name: "", ruleset: "5e-2014", catalogueVersion: catalog.version, baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
  raceId: ids.raceId, backgroundId: ids.backgroundId, classId: ids.classId, level: 1, decisions: [], inventory: [], currentHp: 13, temporaryHp: 0, spentResources: {} });
/** Erros do domínio estão em inglês; a interface mostra a versão em português. */
const erroDeAtributo = (e: unknown) => { const m = e instanceof Error ? e.message : String(e); return /budget exceeded/i.test(m) ? "A compra de pontos passa de 27 pontos. Reduza outro atributo antes." : /between 8 and 15/i.test(m) ? "Na compra de pontos cada atributo vai de 8 a 15." : m; };
const nomeDoItem = (itemId: string) => srdItem(itemId)?.nome ?? itemId;
const escolhasDoInventario = (d: CharacterDraft): Record<string, string> => Object.fromEntries(Object.entries(fighterEquipmentOptions2014).map(([g, opcoes]) => {
  const sel = d.inventory.find(e => e.id.startsWith(PREFIXO(g)))?.id.split(":")[2];
  return [g, opcoes.some(o => o.id === sel) ? sel! : opcoes[0].id];
}));
const gruposCompletos = (d: CharacterDraft) => Object.entries(fighterEquipmentOptions2014).every(([g, opcoes]) => opcoes.some(o => o.components.every(c =>
  d.inventory.some(e => e.id === PREFIXO(g) + o.id + ":" + c.itemId && e.itemId === c.itemId && e.quantity === c.quantity))));

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
  const [identity, setIdentity] = useState<PublicIdentitySettings>(defaultPublicIdentity), [publicar, setPublicar] = useState(false);
  const [salvo, setSalvo] = useState<string | null>(null);          // retrato do último estado salvo (null = nunca salvo)
  const [idReal, setIdReal] = useState(id), [existe, setExiste] = useState(false), [revisao, setRevisao] = useState<number | null>(null), [somenteFicha, setSomenteFicha] = useState(false);
  const [salvando, setSalvando] = useState(false), [conflito, setConflito] = useState(false), [recuperacao, setRecuperacao] = useState<Recuperacao | null>(null);
  const [secao, setSecao] = useState<Secao>("ficha");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [metodo, setMetodo] = useState<Metodo>("point-buy"), [erroAtrib, setErroAtrib] = useState("");
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [confirmando, setConfirmando] = useState<string[] | null>(null);   // grupos cujas escolhas substituem equipamento já concedido
  const [busca, setBusca] = useState(""), [excluindo, setExcluindo] = useState(false);

  const aplicarCarregado = (p: { id: string; draft: CharacterDraft; identity: PublicIdentitySettings; publicar: boolean; revision: number | null; somenteFicha: boolean }) => {
    createCharacterSheet(p.draft, catalog);   // dado inválido/de outra versão falha aqui, não na tela
    setDraft(p.draft); setIdentity(p.identity); setPublicar(p.publicar); setIdReal(p.id); setExiste(true); setRevisao(p.revision); setSomenteFicha(p.somenteFicha);
    setSalvo(JSON.stringify({ draft: p.draft, identity: p.identity, publicar: p.publicar })); setEscolhas(escolhasDoInventario(p.draft));
    setMetodo(isStandardArray(p.draft.baseAbilities) ? "standard-array" : "point-buy");
    registrarTitulo(id, p.draft.name.trim() || "Novo personagem"); registrarTitulo(p.id, p.draft.name.trim() || "Novo personagem");
  };
  useEffect(() => {
    let vivo = true; setCarga("carregando");
    (async () => {
      try {
        const novoNaoSalvo = ehPersonagemNovo(id), alvo = servidor && novoNaoSalvo ? lerMapaAba(userId, campaignId, id) ?? id : id;
        // Uma aba `novo-*` ainda não corresponde a uma ficha no banco. Consultar a API com esse identificador causa erro de UUID inválido.
        const p = novoNaoSalvo && alvo === id ? null : await repo.carregar(alvo);
        if (!vivo) return;
        if (!p && (!novoNaoSalvo || alvo !== id)) { setCarga({ erro: "Personagem não encontrado, removido ou sem acesso (por exemplo, você saiu da campanha). Nada foi alterado." }); return; }   // nunca abre um editor vazio no lugar de um personagem existente
        if (p) aplicarCarregado(p); else { setEscolhas(escolhasDoInventario(novoRascunho(id))); registrarTitulo(id, "Novo personagem"); }
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
  const { sheet, erro } = useMemo(() => { try { return { sheet: createCharacterSheet({ ...draft, name: draft.name.trim() || "Sem nome" }, catalog), erro: "" }; }  catch (e) { return { sheet: null, erro: e instanceof Error ? e.message : String(e) }; } }, [draft]);
  const mudar = (proximo: CharacterDraft) => { setDraft(proximo); setMsg(null); };

  const salvar = useCallback(async (): Promise<boolean> => {
    if (salvando) return false;
    if (!sheet || !draft.name.trim()) { setMsg({ ok: false, t: "Informe o nome e corrija os erros antes de salvar." }); return false; }
    const estado = { draft, identity, publicar };
    setSalvando(true);
    try {
      const r = await repo.salvar({ id: idReal, existe, revisao, estado, somenteFicha, source: { name: draft.name, surname: "", race: "Anão", characterClass: "Guerreiro" } });
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
    {!servidor && <div className="row"><button className="btn-secondary danger" onClick={() => { store.excluir(id); setCarga("pronto"); setDraft(novoRascunho(id)); setSalvo(null); setEscolhas(escolhasDoInventario(novoRascunho(id))); }}>Descartar dado corrompido e recomeçar</button></div>}</div>;

  const alterarAtributo = (a: typeof ABILITY_ORDER[number], valor: number) => {
    const novo = { ...draft.baseAbilities, [a]: valor };
    if (metodo === "standard-array") {
      const outro = ABILITY_ORDER.find(k => k !== a && draft.baseAbilities[k] === valor);
      if (!outro) return;                                                             // matriz padrão: só troca de posição entre dois valores
      const troca = { ...draft.baseAbilities, [a]: valor, [outro]: draft.baseAbilities[a] };
      setErroAtrib(""); mudar({ ...draft, baseAbilities: troca, currentHp: Math.min(draft.currentHp, maxHpBase(troca.con)) }); return;
    }
    try { validatePointBuy(novo); setErroAtrib(""); mudar({ ...draft, baseAbilities: novo, currentHp: Math.min(draft.currentHp, maxHpBase(novo.con)) }); }
    catch (e) { setErroAtrib(erroDeAtributo(e)); }
  };
  const trocarMetodo = (m: Metodo) => {
    setMetodo(m); setErroAtrib("");
    const base = m === "standard-array" ? { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } : { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 };
    mudar({ ...draft, baseAbilities: base, currentHp: maxHpBase(base.con) });
  };

  /** Mudanças de escolha que substituiriam equipamento inicial já concedido (precisam de confirmação). */
  const substituicoes = Object.keys(fighterEquipmentOptions2014).filter(g => { const atual = draft.inventory.find(e => e.id.startsWith(PREFIXO(g)))?.id.split(":")[2]; return !!atual && atual !== escolhas[g]; });
  const aplicarEquipamento = () => {
    try {
      const conhecidos = srdItemIds(); let proximo = draft;
      for (const [g, opcoes] of Object.entries(fighterEquipmentOptions2014)) {
        const opcao = opcoes.find(o => o.id === escolhas[g]); if (!opcao) throw new Error("Selecione o equipamento: " + GRUPOS[g]);
        const origem = "fighter-" + g, atual = proximo.inventory.find(e => e.id.startsWith("starting-choice:" + origem + ":"))?.id.split(":")[2];
        if (atual && atual !== opcao.id) {
          const antiga = opcoes.find(o => o.id === atual); if (!antiga) throw new Error("Equipamento inicial anterior desconhecido.");
          proximo = replaceStartingEquipmentSelection(proximo, { sourceId: origem, optionId: antiga.id, components: antiga.components }, { sourceId: origem, optionId: opcao.id, components: opcao.components }, conhecidos, true);
        } else proximo = applyStartingEquipmentSelection(proximo, { sourceId: origem, optionId: opcao.id, components: opcao.components }, conhecidos);
      }
      mudar(proximo); setConfirmando(null); setMsg({ ok: true, t: "Equipamentos iniciais aplicados ao inventário. Revise na seção Inventário." });
    } catch (e) { setConfirmando(null); setMsg({ ok: false, t: e instanceof Error ? e.message : "Não foi possível confirmar os equipamentos." }); }
  };
  const pedirEquipamento = () => { if (substituicoes.length) setConfirmando(substituicoes); else aplicarEquipamento(); };

  const resultadosBusca = busca.trim().length >= 2 ? searchCompendium(criadorRules, { kind: "item", text: busca }).filter(l => srdItem(l.ref.id)?.raridade === "mundano").slice(0, 8) : [];
  const completo = !!sheet && !!draft.name.trim() && !sheet.pending.length && gruposCompletos(draft);
  const escolhasDoNivel = fighter2014Advancements.flatMap(a => a.level <= draft.level ? a.choices ?? [] : []);
  const sec = (s: Secao, rotulo: string) => <button type="button" className={secao === s ? "active" : ""} aria-current={secao === s ? "true" : undefined} onClick={() => setSecao(s)}>{rotulo}</button>;

  return <div className="content ficha auth wide criador">
    <div className="eyebrow">{campanha.toLocaleUpperCase("pt-BR")} · CRIADOR GUIADO · GUERREIRO (SRD 2014)</div>
    <div className="row-between"><h1>{draft.name.trim() || "Novo personagem"}</h1>
      <button type="button" className="btn-primary" onClick={() => void salvar()} disabled={salvando || (!sujo && salvo !== null)}>{salvando ? "Salvando…" : "Salvar"}</button></div>
    {servidor
      ? <div className="notice ok" role="note" data-testid="aviso-servidor">{somenteFicha ? "Ficha de outro jogador: você a vê e edita como mestre da campanha. A identidade pública continua sendo do dono." : "Salvo na campanha: só você e o mestre leem esta ficha. Os outros jogadores veem apenas a identidade pública que você publicar."} Raça (Anão) e antecedente (Acólito) são ilustrativos.</div>
      : <div className="notice" role="note" data-testid="aviso-armazenamento">Armazenamento <strong>experimental</strong>: o personagem fica só neste navegador, não sincroniza entre aparelhos e não é privado de quem usa o mesmo navegador. Sem conta e API de fichas não há salvamento real na campanha. Raça (Anão) e antecedente (Acólito) são ilustrativos.</div>}
    {conflito && <div className="notice err" role="alert" data-testid="aviso-conflito"><p>{ERRO_CONFLITO_REVISAO}</p><div className="row"><button type="button" className="btn-primary" onClick={() => void recarregarServidor()}>Carregar a versão atual</button><button type="button" className="btn-secondary" onClick={() => setConflito(false)}>Continuar editando</button></div></div>}
    {recuperacao && <div className="notice" role="status" data-testid="aviso-recuperacao"><p>Há alterações deste personagem que não chegaram ao servidor ({recuperacao.motivo || "falha anterior"}), guardadas neste navegador em {new Date(recuperacao.em).toLocaleString("pt-BR")}.</p><div className="row"><button type="button" className="btn-primary" onClick={restaurar}>Restaurar essas alterações</button><button type="button" className="btn-secondary" onClick={descartarRecuperacao}>Descartar</button></div></div>}
    <nav className="ficha-subnav" aria-label="Seções do personagem">{sec("ficha", "Ficha")}{sec("equipamento", "Equipamento inicial")}{sec("inventario", "Inventário")}{sec("identidade", "Identidade pública")}</nav>
    {msg && <Aviso erro={!msg.ok} t={msg.t}/>}
    {erro && <Aviso erro t={erro}/>}
    {sujo && <p className="muted" role="status">Alterações não salvas.</p>}

    {secao === "ficha" && <div className="criador-sec">
      <label>Nome do personagem<input aria-label="Nome do personagem" value={draft.name} maxLength={120} onChange={e => mudar({ ...draft, name: e.target.value })}/></label>
      <p className="muted">Raça: Anão · Antecedente: Acólito · Classe: Guerreiro</p>
      <fieldset><legend>Atributos-base (antes dos bônus raciais)</legend>
        <label>Método<select aria-label="Método de atributos" value={metodo} onChange={e => trocarMetodo(e.target.value as Metodo)}><option value="point-buy">Compra de pontos (27)</option><option value="standard-array">Matriz padrão</option></select></label>
        {metodo === "point-buy" && <p className="muted">Pontos gastos: {pointBuySpent(draft.baseAbilities)} / {POINT_BUY_BUDGET}</p>}
        <div className="criador-atributos">{ABILITY_ORDER.map(a => <label key={a}>{rotuloAtributo(a)}
          <select aria-label={"Atributo " + a} value={draft.baseAbilities[a]} onChange={e => alterarAtributo(a, Number(e.target.value))}>
            {(metodo === "standard-array" ? [15, 14, 13, 12, 10, 8] : [8, 9, 10, 11, 12, 13, 14, 15]).map(v => <option key={v} value={v}>{v}</option>)}</select></label>)}</div>
        {erroAtrib && <p role="alert" className="notice err">{erroAtrib}</p>}
      </fieldset>
      <label>Nível<select aria-label="Nível" value={draft.level} onChange={e => mudar({ ...draft, level: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      {escolhasDoNivel.map(ch => ch.count > 1
        ? <fieldset key={ch.id}><legend>Perícias do Guerreiro (escolha {ch.count})</legend>
          <div className="criador-pericias">{ch.options.map(o => { const marcadas = draft.decisions.find(d => d.id === ch.id)?.optionIds ?? [];
            return <label key={o.id} className="check"><input type="checkbox" aria-label={"Perícia " + o.id} checked={marcadas.includes(o.id)} disabled={!marcadas.includes(o.id) && marcadas.length >= ch.count}
              onChange={e => mudar({ ...draft, decisions: [...draft.decisions.filter(d => d.id !== ch.id), { id: ch.id, optionIds: e.target.checked ? [...marcadas, o.id] : marcadas.filter(x => x !== o.id) }] })}/> {rotuloPericia(o.id)}</label>; })}</div></fieldset>
        : <label key={ch.id}>{ch.id === "fighter-style-1" ? "Estilo de luta (nível 1)" : ch.id === "fighter-archetype-3" ? "Arquétipo marcial (nível 3)" : `Melhoria de atributo (nível ${ch.level})`}
          <select aria-label={ch.id === "fighter-asi-4" ? "Melhoria de atributo" : ch.id} value={draft.decisions.find(d => d.id === ch.id)?.optionIds[0] ?? ""}
            onChange={e => mudar({ ...draft, decisions: [...draft.decisions.filter(d => d.id !== ch.id), ...(e.target.value ? [{ id: ch.id, optionIds: [e.target.value] }] : [])] })}>
            <option value="">Selecione uma opção</option>{ch.options.map(o => <option key={o.id} value={o.id}>{rotuloOpcao(o.id)}</option>)}</select></label>)}
      {sheet && <section aria-label="Ficha calculada" className="criador-ficha">
        <h2>Ficha calculada</h2>
        <p>{ABILITY_ORDER.map(a => `${rotuloAtributo(a)} ${sheet.abilities[a]}`).join(" · ")}</p>
        <p>PV máximo: {sheet.maxHp}</p>
        <p>Características: {sheet.features.map(rotuloOpcao).join(", ") || "nenhuma"}</p>
        <p>Perícias: {sheet.skills.map(rotuloPericia).join(", ") || "nenhuma"}</p>
        <p>Recursos: {Object.entries(sheet.resources).map(([n, v]) => `${rotuloOpcao(n)} ${v.remaining}/${v.maximum}`).join(" · ") || "nenhum"}</p>
        <p>Escolhas pendentes: {sheet.pending.length ? sheet.pending.map(rotuloOpcao).join(", ") : "nenhuma"}</p>
        <p role="note"><strong>{completo ? "Estado: personagem completo (somente neste navegador)" : "Estado: rascunho incompleto"}</strong></p>
      </section>}
    </div>}

    {secao === "equipamento" && <div className="criador-sec">
      <h2>Equipamento inicial do Guerreiro</h2>
      <p className="muted">Escolha um conjunto de cada grupo e confirme: os itens entram no inventário como instâncias independentes, com os dados do catálogo oficial. As opções de armas marciais são uma amostra (espada longa) até o catálogo de escolhas livres estar pronto.</p>
      {Object.entries(fighterEquipmentOptions2014).map(([g, opcoes]) => <fieldset key={g}><legend>{GRUPOS[g]}</legend>
        <select aria-label={"Equipamento " + g} value={escolhas[g]} onChange={e => { setEscolhas(p => ({ ...p, [g]: e.target.value })); setConfirmando(null); }}>{opcoes.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <ul className="criador-previa" aria-label={"Prévia de " + GRUPOS[g]}>{opcoes.find(o => o.id === escolhas[g])?.components.map(c => <li key={c.itemId}>{nomeDoItem(c.itemId)} ×{c.quantity}</li>)}</ul>
      </fieldset>)}
      {confirmando && <div className="notice err" role="alertdialog" aria-label="Substituir equipamento inicial">
        <p>Substituir o equipamento inicial de: {confirmando.map(g => GRUPOS[g]).join(", ")}? Itens iniciais já consumidos ou alterados não serão substituídos, e itens adquiridos depois são preservados.</p>
        <div className="row"><button type="button" className="btn-primary" onClick={aplicarEquipamento}>Substituir equipamentos</button><button type="button" className="btn-secondary" onClick={() => setConfirmando(null)}>Cancelar</button></div></div>}
      {!confirmando && <div className="row"><button type="button" className="btn-primary" onClick={pedirEquipamento}>Confirmar equipamentos iniciais</button></div>}
    </div>}

    {secao === "inventario" && <section className="criador-sec ficha-inventario" aria-label="Inventário">
      <h2>Inventário</h2>
      {sheet && sheet.inventory.length === 0 && <p className="muted" data-testid="inventario-vazio">Inventário vazio. Confirme o equipamento inicial ou adicione itens do catálogo abaixo.</p>}
      <ul>{sheet?.inventory.map(item => { const def = srdItem(item.itemId); return <li key={item.id}>
        <span><strong>{nomeDoItem(item.itemId)}</strong> · quantidade {item.quantity}{item.origin === "starting" ? " · inicial" : ""}{def?.peso != null ? ` · ${String(def.peso * item.quantity).replace(".", ",")} kg` : ""}</span>
        <span className="row">
          <button type="button" className="btn-secondary" aria-label={`Consultar no Compêndio: ${nomeDoItem(item.itemId)}`} onClick={() => onOpenContent(itemSpec(item.itemId, nomeDoItem(item.itemId)))}>Consultar no Compêndio</button>
          <button type="button" className="btn-secondary" aria-label={`+1: adicionar quantidade de ${nomeDoItem(item.itemId)}`} onClick={() => mudar(changeInventoryInstanceQuantity(draft, item.id, 1))}>+1</button>
          <button type="button" className="btn-secondary" aria-label={`−1: remover quantidade de ${nomeDoItem(item.itemId)}`} onClick={() => mudar(changeInventoryInstanceQuantity(draft, item.id, -1))}>−1</button></span></li>; })}</ul>
      <label>Adicionar item do catálogo<input type="search" aria-label="Buscar item para adicionar" value={busca} placeholder="Digite ao menos 2 letras" onChange={e => setBusca(e.target.value)}/></label>
      {busca.trim().length >= 2 && resultadosBusca.length === 0 && <p className="muted">Nenhum item mundano encontrado.</p>}
      <ul>{resultadosBusca.map(l => <li key={l.key}><span>{l.name}</span><button type="button" className="btn-secondary" aria-label={`Adicionar ${l.name}`} onClick={() => { mudar(addInventoryInstance(draft, { id: crypto.randomUUID(), itemId: l.ref.id, quantity: 1, equipped: false, origin: "acquired" })); setBusca(""); }}><Plus size={14} aria-hidden="true"/> Adicionar</button></li>)}</ul>
    </section>}

    {secao === "identidade" && <div className="criador-sec">
      {somenteFicha ? <Aviso t="A identidade pública pertence ao dono do personagem. Como mestre, você edita a ficha, mas não altera nem lê a identidade privada dele."/> : <>
      <p className="muted">O cartão público é separado da ficha privada: nível, PV, atributos, inventário e anotações nunca aparecem nele.{servidor ? " Só o que você publicar aparece para os outros jogadores." : " Vale para a prévia local; a publicação na campanha exige conta e a API de fichas."}</p>
      {servidor && <label className="check"><input type="checkbox" aria-label="Publicar identidade na campanha" checked={publicar} onChange={e => { setPublicar(e.target.checked); setMsg(null); }}/> Publicar a identidade pública na campanha (aparece em Personagens e no Início)</label>}
      <PublicIdentityEditor key={draft.id} source={{ name: draft.name, surname: "", race: "Anão", characterClass: "Guerreiro" }} initialSettings={identity}
        onSave={s => { setIdentity(s); setMsg({ ok: true, t: "Identidade pública atualizada. Clique em Salvar para guardá-la." }); }}/></>}
    </div>}

    <div className="row criador-rodape">
      {servidor ? <p className="muted" data-testid="exclusao-indisponivel">A exclusão e a transferência de personagens salvos na campanha seguem o fluxo narrativo (ainda não disponível aqui); por isso não há botão de excluir.</p>
        : !excluindo ? <button type="button" className="btn-secondary danger" onClick={() => setExcluindo(true)} disabled={salvo === null}><Trash2 size={15} aria-hidden="true"/> Excluir personagem</button>
        : <><button type="button" className="btn-secondary danger" onClick={() => { store.excluir(id); setSalvo(null); registrarTitulo(id, "Personagem excluído"); avisarRegistros(); setDraft(novoRascunho(id)); setIdentity(defaultPublicIdentity()); setEscolhas(escolhasDoInventario(novoRascunho(id))); setExcluindo(false); setMsg({ ok: true, t: "Personagem excluído deste navegador." }); }}>Confirmar exclusão</button>
          <button type="button" className="btn-secondary" onClick={() => setExcluindo(false)}>Cancelar</button></>}
    </div>
  </div>;
}
