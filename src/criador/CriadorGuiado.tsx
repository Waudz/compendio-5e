import { EstadoCombateFicha } from "../EstadoCombateFicha";
import { metodoPreservado, manualValido, type MetodoAtributos } from './atributos-2014';
// Criador guiado SRD 2014; mantém leitura/edição versionada das fichas legadas. Reaproveita as regras de `src/rules` e o catálogo
// canônico; não duplica lógica. Ficha, equipamento inicial, inventário (dentro da ficha) e identidade pública em seções.
// Persistência por `RepositorioPersonagem`: SERVIDOR (Supabase, ficha privada + identidade pública, revisão otimista) quando há conta e a API de fichas;
// senão o armazenamento local EXPERIMENTAL (`armazenamento.ts`: sem segurança entre usuários e sem sincronização).
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useRef, lazy, Suspense } from "react";
import { useAuth } from "../AuthContext";
import { useCampaigns } from "../CampaignsContext";
import { useFichas, useMoedasDaCampanha } from "../RegistrosContext";
import { entregarNasAtivas } from "../moedas/moedas";
import { itemSpec } from "../Compendio";
import { Aviso } from "../Diario";
import { srdItem, srdItemIds } from "../catalogue/srd-2014-items";
import { ERRO_CONFLITO_REVISAO, retratoValido } from "../fichas";
import { avisarRegistros, registrarTitulo } from "../registrosStore";
import { buildPilotCharacterCatalog } from "../rules/character-catalogue-adapter";
import { searchCompendium } from "../rules/compendium-query";
import { ABILITY_ORDER, POINT_BUY_BUDGET, pointBuySpent, validatePointBuy } from "../rules/ability-generation-2014";
import { addInventoryInstance, changeInventoryInstanceQuantity, createCharacterSheet, type CharacterDraft, type InventoryEntry } from "../rules/character-domain";
import { fighter2014Advancements } from "../rules/fighter-2014";
import { defaultPublicIdentity, publicIdentityCard, type PublicIdentity } from "../rules/public-identity";
import { fighterEquipmentOptions2014 } from "../rules/starting-equipment-2014";
import { applyStartingEquipmentSelection, replaceStartingEquipmentSelection } from "../rules/starting-equipment-selection";
import { useUnsavedGuard } from "../unsaved";
import { estaVisivel, EVENTO_ABRIR_FICHA, pedirFechamento, registrarAliasPersonagem, registrarVoltar } from "../voltarInterno";
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
const FichaJogo = lazy(async () => { await carregar2014(); return import("../ficha/FichaJogo"); });
import PublicIdentityEditor from "./identidade-publica-editor";
import { CampoRetrato } from "./CampoRetrato";
import { CAMPOS_HISTORIA } from "../ficha/campos";
import { origemPublica, rotuloAtributo, rotuloOpcao, rotuloPericia } from "./rotulos";

const { catalog } = buildPilotCharacterCatalog(criadorRules, { race: criadorRefs.race, background: criadorRefs.background, class: criadorRefs.class }, fighter2014Advancements);
const calcularFicha = (draft: CharacterDraft) => modern2014(draft) ? sheet2014(draft) : createCharacterSheet(draft, catalog);
type Secao = "ficha" | "equipamento" | "inventario" | "identidade";
type Metodo = MetodoAtributos;
const GRUPOS: Record<string, string> = { armor: "Armadura", weapons: "Armas marciais", ranged: "Armas adicionais", pack: "Pacote de aventureiro" };
const PREFIXO = (group: string) => "starting-choice:fighter-" + group + ":";
const maxHpBase = (con: number) => 10 + Math.floor((con + 2 - 10) / 2);   // 10 + modificador de Constituição (Anão: +2 racial), nível 1

const novoRascunho = (id: string): CharacterDraft => {
  const draft: CharacterDraft = { id, name: "", ruleset: "5e-2014", catalogueVersion: "character-srd-2014-v2", baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
    raceId: "hill-dwarf", backgroundId: "acolyte", classId: "fighter", level: 1, decisions: [], inventory: [], currentHp: 0, temporaryHp: 0, spentResources: {} };
  return regras2014 ? { ...draft, currentHp: regras2014.sheet2014(draft).maxHp } : draft;
};
/** Erros do domínio estão em inglês; a interface mostra a versão em português. */
const erroDeAtributo = (e: unknown) => { const m = e instanceof Error ? e.message : String(e); return /budget exceeded/i.test(m) ? "A compra de pontos passa de 27 pontos. Reduza outro atributo antes." : /between 8 and 15/i.test(m) ? "Na compra de pontos cada atributo vai de 8 a 15." : m; };
const nomeDoItem = (itemId: string) => srdItem(itemId)?.nome ?? itemId;
const nomeDaInstancia = (item: InventoryEntry) => typeof item.customName === "string" ? item.customName : nomeDoItem(item.itemId);
const escolhasDoInventario = (d: CharacterDraft): Record<string, string> => Object.fromEntries(Object.entries(fighterEquipmentOptions2014).map(([g, opcoes]) => {
  const sel = d.inventory.find(e => e.id.startsWith(PREFIXO(g)))?.id.split(":")[2];
  return [g, opcoes.some(o => o.id === sel) ? sel! : opcoes[0].id];
}));
const gruposCompletos = (d: CharacterDraft) => modern2014(d) ? d.decisions.some(c => c.id === 'equipment-accepted' && c.optionIds.includes('yes')) && d.decisions.some(c => c.id === 'background-equipment' && c.optionIds.includes('accepted')) : Object.entries(fighterEquipmentOptions2014).every(([g, opcoes]) => opcoes.some(o => o.components.every(c =>
  d.inventory.some(e => e.id === PREFIXO(g) + o.id + ":" + c.itemId && e.itemId === c.itemId && e.quantity === c.quantity))));

export function CriadorGuiado({ id, onOpenContent, initialView = false }: { id: string; onOpenContent: (s: TabSpec) => void; initialView?: boolean }) {
  const { user } = useAuth(), { active } = useCampaigns(), fichas = useFichas();
  const aviso = (t: string) => <div className="content"><h1>Personagem</h1><Aviso t={t}/></div>;
  // Usar identificadores estáveis: contextos podem emitir novos objetos para a
  // mesma conta/campanha e recriar o repositório, recarregando a ficha por cima
  // das escolhas ainda não salvas.
  const userId = user?.id, campaignId = active?.campaign.id;
  const store = useMemo<ArmazenamentoCriador | null>(() => { try { return userId && campaignId ? armazenamentoLocalExperimental(userId, campaignId) : null; } catch { return null; } }, [userId, campaignId]);
  const repo = useMemo<RepositorioPersonagem | null>(() => !userId || !campaignId || !store ? null : fichas ? repositorioServidor(fichas, campaignId, userId) : repositorioLocal(store), [userId, campaignId, store, fichas]);
  if (!user) return aviso("Conta necessária para usar o criador de personagens.");
  if (!active) return aviso("Os personagens pertencem a uma campanha. Escolha uma campanha ativa na barra lateral.");
  if (!store || !repo) return aviso("Não foi possível preparar o armazenamento deste usuário e campanha.");
  return <Editor key={`${active.campaign.id}:${id}`} id={id} repo={repo} store={store} userId={user.id} campaignId={active.campaign.id} campanha={active.campaign.name} onOpenContent={onOpenContent} initialView={initialView} mestre={active.role === "mestre"}/>;
}

function Editor({ id, repo, store, userId, campaignId, campanha, onOpenContent, initialView, mestre }: { mestre: boolean; id: string; repo: RepositorioPersonagem; store: ArmazenamentoCriador; userId: string; campaignId: string; campanha: string; onOpenContent: (s: TabSpec) => void; initialView: boolean }) {
  const servidor = repo.tipo === "servidor";
  const [carga, setCarga] = useState<"carregando" | "pronto" | { erro: string }>("carregando"), [tentativa, setTentativa] = useState(0);
  const [draft, setDraft] = useState<CharacterDraft>(() => novoRascunho(id));
  const nameRef = useRef<HTMLInputElement>(null);
  const previousVersion = useRef(draft.catalogueVersion);
  useEffect(() => {
    if (previousVersion.current !== draft.catalogueVersion && modern2014(draft)) nameRef.current?.focus();
    previousVersion.current = draft.catalogueVersion;
  }, [draft.catalogueVersion]);
  // A apresentação pública é automática: segue a ficha, salvo o que o dono personalizar ou ocultar.
  const [identity, setIdentity] = useState<PublicIdentity>(defaultPublicIdentity);
  const [salvo, setSalvo] = useState<string | null>(null);          // retrato do último estado salvo (null = nunca salvo)
  const idRealRef = useRef(id);
  const [idReal, setIdReal] = useState(id), [existe, setExiste] = useState(false), [revisao, setRevisao] = useState<number | null>(null), [somenteFicha, setSomenteFicha] = useState(false);
  const [salvando, setSalvando] = useState(false), [conflito, setConflito] = useState(false), [recuperacao, setRecuperacao] = useState<Recuperacao | null>(null);
  const [secao, setSecao] = useState<Secao>("ficha");
  // Ficha de jogo ou edição é estado desta tela, nunca da navegação: abrir um personagem já salvo mostra sempre a ficha.
  const [visualizando, setVisualizando] = useState(initialView);
  /** Estado no momento em que "Editar personagem" foi usado: é para onde Cancelar volta. `null` na criação. */
  const [base, setBase] = useState<{ draft: CharacterDraft; identity: PublicIdentity } | null>(null);
  const [saida, setSaida] = useState<"cancelar" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [metodo, setMetodo] = useState<Metodo>("point-buy"), [erroAtrib, setErroAtrib] = useState("");
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [confirmando, setConfirmando] = useState<string[] | null>(null);   // grupos cujas escolhas substituem equipamento já concedido
  const [busca, setBusca] = useState(""), [excluindo, setExcluindo] = useState(false);

  const aplicarCarregado = (p: { id: string; draft: CharacterDraft; identity: PublicIdentity; revision: number | null; somenteFicha: boolean }) => {
    calcularFicha(p.draft);   // dado inválido/de outra versão falha aqui, não na tela
    setDraft(p.draft); setIdentity(p.identity); setIdReal(p.id); setExiste(true); setRevisao(p.revision); setSomenteFicha(p.somenteFicha);
    setSalvo(JSON.stringify({ draft: p.draft, identity: p.identity })); setEscolhas(escolhasDoInventario(p.draft));
    setMetodo(metodoPreservado(p.draft.baseAbilities, p.draft.abilityMethod));
    setBase(null); setSaida(null);
    if (p.id !== id) registrarAliasPersonagem(p.id, id);
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
        if (!p || modern2014(p.draft)) { await carregar2014(); if (!vivo) return; }
        if (p) { aplicarCarregado(p); setVisualizando(true); } else { const novo = novoRascunho(id); setDraft(novo); setEscolhas(escolhasDoInventario(novo)); registrarTitulo(id, "Novo personagem"); }
        if (servidor) setRecuperacao(lerRecuperacao(userId, campaignId, id));   // alterações não enviadas de uma falha anterior
        setCarga("pronto");
      } catch (e) { if (vivo) setCarga({ erro: e instanceof Error ? e.message : "Não foi possível ler o personagem salvo." }); }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, id, tentativa]);

  idRealRef.current = idReal;
  const retrato = JSON.stringify({ draft, identity });
  const vazio = JSON.stringify({ draft: novoRascunho(id), identity: defaultPublicIdentity() });
  const sujo = carga === "pronto" && retrato !== (salvo ?? vazio) && (salvo !== null || draft.name.trim() !== "" || draft.inventory.length > 0 || draft.decisions.length > 0);
  const { sheet, erro } = useMemo(() => { try { return { sheet: calcularFicha({ ...draft, name: draft.name.trim() || "Sem nome" }), erro: "" }; }  catch (e) { return { sheet: null, erro: e instanceof Error ? e.message : String(e) }; } }, [draft]);
  const mudar = (proximo: CharacterDraft) => { setDraft(proximo); setMsg(null); };
  const moedas = useMoedasDaCampanha(campaignId).ativas;
  /** Fluxos que ENTREGAM dinheiro (equipamento inicial, origem): o valor chega nas moedas que a campanha usa. */
  const mudarComEntrega = (proximo: CharacterDraft) => mudar(proximo.currency === draft.currency ? proximo : { ...proximo, currency: { cp: 0, sp: 0, gp: 0, ...entregarNasAtivas(draft.currency, proximo.currency, moedas) } });

  const alterarNivel = (level: number) => {
    try { mudar(modern2014(draft) ? regras2014!.progressLevel2014(draft, level) : { ...draft, level }); setErroAtrib(''); }
    catch (e) { setErroAtrib(e instanceof Error ? e.message : 'Revise os recursos e as rolagens de PV antes de mudar o nível.'); }
  };

  /** Os únicos dados da ficha que a identidade pública usa. */
  const origem = origemPublica(draft, modern2014(draft) ? label2014(draft.raceId) : "Anão", modern2014(draft) ? label2014(draft.classId) : "Guerreiro");

  /** Último estado que falhou: o salvamento automático não insiste nele (só depois de nova mudança ou do botão de tentar de novo). */
  const falhou = useRef<string | null>(null);
  const salvar = useCallback(async (automatico?: boolean): Promise<boolean> => {
    if (salvando) return false;
    if (!sheet || !draft.name.trim()) { setMsg({ ok: false, t: "Informe o nome e corrija os erros antes de salvar." }); return false; }
    if (draft.portrait && !retratoValido(draft.portrait)) { setMsg({ ok: false, t: "O endereço do retrato deve começar com https:// e não ter espaços." }); return false; }
    const apresentado = publicIdentityCard(identity, origem);
    if (!somenteFicha && !apresentado.name && !apresentado.alias) { setMsg({ ok: false, t: "Na identidade pública, apresente ao menos o nome ou a alcunha." }); return false; }
    const estado = { draft, identity };
    setSalvando(true);
    try {
      const r = await repo.salvar({ id: idReal, existe, revisao, estado, somenteFicha, source: origem });
      const gravado = { ...draft, id: r.id };
      // A resposta confirma o snapshot enviado, não alterações feitas enquanto
      // a requisição estava em andamento. Preservar o estado mais recente da UI.
      setDraft(atual => ({ ...atual, id: r.id })); setIdReal(r.id); setExiste(true); setRevisao(r.revision); setConflito(false); setRecuperacao(null);
      setSalvo(JSON.stringify({ draft: gravado, identity }));
      limparRecuperacao(userId, campaignId, id);
      falhou.current = null;
      if (servidor && ehPersonagemNovo(id)) { gravarMapaAba(userId, campaignId, id, r.id); registrarAliasPersonagem(r.id, id); }
      registrarTitulo(id, draft.name.trim()); registrarTitulo(r.id, draft.name.trim()); avisarRegistros();
      if (automatico === true) { setMsg(null); return true; }   // não muda de tela nem de aba
      const incompleto = sheet.pending.length || !gruposCompletos(draft);
      setMsg({ ok: true, t: servidor ? `${incompleto ? "Rascunho incompleto" : "Personagem"} salvo na campanha.` : `${incompleto ? "Rascunho incompleto salvo" : "Personagem salvo"} neste navegador (armazenamento experimental).` });
      if (!incompleto || base) { setBase(null); setSaida(null); setVisualizando(true); setSecao("ficha"); }

      return true;
    } catch (e) {
      falhou.current = JSON.stringify(estado);
      const texto = e instanceof Error ? e.message : "Não foi possível salvar.";
      const guardou = servidor && gravarRecuperacao(userId, campaignId, id, { estado, baseRevisao: revisao, motivo: texto, em: new Date().toISOString() });
      if (e instanceof ErroConflito) setConflito(true);
      setMsg({ ok: false, t: `${texto} Suas alterações continuam na tela${guardou ? " e foram guardadas neste navegador" : ""}.` });
      return false;
    } finally { setSalvando(false); }
  }, [salvando, sheet, draft, identity, repo, idReal, existe, revisao, somenteFicha, servidor, userId, campaignId, id, base]);
  // Proteção local contínua do rascunho: a aba pode ser desmontada ao alternar
  // para outro conteúdo sem que o usuário pressione Salvar. Nunca enviamos
  // essas alterações automaticamente ao servidor: restauração é explícita.
  // Uma recuperação anterior tem prioridade e não pode ser sobrescrita pela
  // versão recém-carregada do banco antes de o usuário decidir restaurá-la.
  useEffect(() => {
    if (!servidor || carga !== "pronto" || !sujo || recuperacao || salvando) return;
    gravarRecuperacao(userId, campaignId, id, {
      estado: { draft, identity }, baseRevisao: revisao,
      motivo: "Rascunho não salvo recuperado deste navegador", em: new Date().toISOString(),
    });
  }, [servidor, carga, sujo, recuperacao, salvando, userId, campaignId, id, draft, identity, revisao]);

  useUnsavedGuard(`criador:${id}`, sujo, salvar);
  // Ficha de jogo: cada mudança é salva sozinha, com a mesma revisão controlada. Conflito ou cópia de recuperação pausam tudo até a pessoa decidir.
  const automatico = visualizando && carga === "pronto" && existe && modern2014(draft) && !!sheet && sujo && !salvando && !conflito && !recuperacao;
  const salvarAtual = useRef(salvar); salvarAtual.current = salvar;
  const pendente = useRef(false);
  useEffect(() => {
    pendente.current = false;
    if (!automatico || falhou.current === retrato) return;
    pendente.current = true;
    const t = setTimeout(() => { pendente.current = false; void salvarAtual.current(true); }, 700);
    return () => clearTimeout(t);
  }, [automatico, retrato]);
  // saindo da ficha antes do prazo (ex.: trocando de menu): envia o que estava pendente
  useEffect(() => () => { if (pendente.current) { pendente.current = false; void salvarAtual.current(true); } }, []);

  // ------------------------------------------------------------ entrar e sair da edição
  const raizEditor = useRef<HTMLDivElement>(null);
  const marca = `edicao:${id}`, ignorarVoltar = useRef(false);
  const editar = () => {
    falhou.current = null;
    setBase({ draft, identity }); setSecao("ficha"); setVisualizando(false); setMsg(null);
    window.history.pushState({ ...window.history.state, compendioEdicao: marca }, "");   // o Voltar do navegador retorna à ficha
  };
  /** Retira do histórico a entrada criada ao editar, quando a saída foi por um botão da tela. */
  const consumirEntradaDoHistorico = () => {
    if ((window.history.state as { compendioEdicao?: string } | null)?.compendioEdicao !== marca) return;
    ignorarVoltar.current = true; window.history.back();
  };
  const alteradoNaEdicao = base ? retrato !== JSON.stringify(base) : sujo;
  /** Sai da edição sem guardar o que foi feito nela. */
  const descartarEdicao = () => {
    setSaida(null); setMsg(null); setErroAtrib(""); limparRecuperacao(userId, campaignId, id); setRecuperacao(null);
    if (!existe) {
      const novo = novoRascunho(id); setDraft(novo); setIdentity(defaultPublicIdentity()); setEscolhas(escolhasDoInventario(novo));
      pedirFechamento(`criador:${id}`); return;
    }
    const volta = base ?? (salvo ? JSON.parse(salvo) as { draft: CharacterDraft; identity: PublicIdentity } : null);
    if (volta) { setDraft(volta.draft); setIdentity(volta.identity); setEscolhas(escolhasDoInventario(volta.draft)); setMetodo(metodoPreservado(volta.draft.baseAbilities, volta.draft.abilityMethod)); }
    setBase(null); setVisualizando(true); setSecao("ficha");
  };
  const cancelarEdicao = () => { if (alteradoNaEdicao) setSaida("cancelar"); else { consumirEntradaDoHistorico(); descartarEdicao(); } };
  const salvarEdicao = async () => { if (await salvar()) { setSaida(null); consumirEntradaDoHistorico(); } };

  const acoesDeSaida = useRef({ visualizando, base, cancelar: cancelarEdicao, alterado: alteradoNaEdicao });
  acoesDeSaida.current = { visualizando, base, cancelar: cancelarEdicao, alterado: alteradoNaEdicao };
  useEffect(() => {
    const voltar = () => {
      if (ignorarVoltar.current) { ignorarVoltar.current = false; return true; }
      const a = acoesDeSaida.current;
      if (a.visualizando || !a.base || !estaVisivel(raizEditor.current)) return false;
      if (a.alterado) { window.history.pushState({ ...window.history.state, compendioEdicao: marca }, ""); setSaida("cancelar"); }
      else a.cancelar();
      return true;
    };
    const reabrir = (e: Event) => {
      const alvo = (e as CustomEvent<string>).detail;
      if (alvo !== id && alvo !== idRealRef.current) return;
      const a = acoesDeSaida.current;
      if (a.visualizando || !a.base) return;
      if (a.alterado) setSaida("cancelar"); else a.cancelar();
    };
    const desfazer = registrarVoltar(voltar);
    window.addEventListener(EVENTO_ABRIR_FICHA, reabrir);
    return () => { desfazer(); window.removeEventListener(EVENTO_ABRIR_FICHA, reabrir); };
  }, [id, marca]);
  // a edição começa no topo; a rolagem da ficha fica guardada por aba e é restaurada na volta
  useEffect(() => {
    if (visualizando || !base) return;
    for (let n: HTMLElement | null = raizEditor.current; n; n = n.parentElement) if (n.scrollTop > 0) { n.scrollTop = 0; break; }
  }, [visualizando]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** Conflito de revisão: carrega a versão atual do servidor. As alterações não enviadas ficam na cópia de recuperação (restauráveis). */
  const recarregarServidor = async () => {
    try { const p = await repo.carregar(idReal); if (!p) { setMsg({ ok: false, t: "Personagem não encontrado ou sem permissão." }); return; } aplicarCarregado(p); setConflito(false); setRecuperacao(lerRecuperacao(userId, campaignId, id)); setMsg({ ok: true, t: "Versão atual carregada do servidor. Suas alterações anteriores continuam guardadas para restaurar." }); }
    catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : "Não foi possível recarregar." }); }
  };
  const restaurar = async () => { if (!recuperacao) return; try { if (modern2014(recuperacao.estado.draft) && !regras2014) await carregar2014(); calcularFicha(recuperacao.estado.draft); } catch { setMsg({ ok: false, t: "A cópia guardada é inválida e não pôde ser restaurada." }); return; }
    setDraft({ ...recuperacao.estado.draft, id: idReal }); setMetodo(metodoPreservado(recuperacao.estado.draft.baseAbilities, recuperacao.estado.draft.abilityMethod)); setIdentity(recuperacao.estado.identity); setEscolhas(escolhasDoInventario(recuperacao.estado.draft)); limparRecuperacao(userId, campaignId, id); setRecuperacao(null); setMsg({ ok: true, t: "Alterações restauradas. Revise e clique em Salvar." }); };
  const descartarRecuperacao = () => { limparRecuperacao(userId, campaignId, id); setRecuperacao(null); };

  if (carga === "carregando") return <div className="content"><p className="muted" role="status">Carregando personagem…</p></div>;
  if (typeof carga === "object") return <div className="content"><h1>Personagem</h1><Aviso erro t={`Não foi possível abrir este personagem: ${carga.erro}`} onRetry={() => setTentativa(n => n + 1)}/>
    {!servidor && <div className="row"><button className="btn-secondary danger" onClick={() => { store.excluir(id); setCarga("pronto"); setDraft(novoRascunho(id)); setSalvo(null); setEscolhas(escolhasDoInventario(novoRascunho(id))); }}>Descartar dado corrompido e recomeçar</button></div>}</div>;

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
  const escolhasDoNivel = (modern2014(draft) ? [] : fighter2014Advancements).flatMap(a => a.level <= draft.level ? a.choices ?? [] : []);
  const sec = (s: Secao, rotulo: string) => <button type="button" className={secao === s ? "active" : ""} aria-current={secao === s ? "true" : undefined} onClick={() => setSecao(s)}>{rotulo}</button>;

  const avisoConflito = conflito && <div className="notice err" role="alert" data-testid="aviso-conflito"><p>{ERRO_CONFLITO_REVISAO}</p><div className="row"><button type="button" className="btn-primary" onClick={() => void recarregarServidor()}>Carregar a versão atual</button><button type="button" className="btn-secondary" onClick={() => setConflito(false)}>Continuar editando</button></div></div>;

  // Ficha de jogo (três abas), independente das etapas do criador. Os mesmos dados do motor alimentam a edição e o jogo.
  if (visualizando && carga === "pronto" && existe && sheet) {
    if (!modern2014(draft)) return <div className="content ficha auth wide" data-testid="ficha-guiada-leitura"><h1>{draft.name || "Personagem sem nome"}</h1>
      {msg && <Aviso erro={!msg.ok} t={msg.t}/>}
      <p className="notice" role="note">Este personagem usa uma versão anterior das regras. Abra a edição e atualize-o para SRD 2014 para usar a ficha de jogo.</p>
      <button type="button" className="btn-primary" onClick={editar}>Editar personagem</button></div>;
    const naoSalvo = sujo && !salvando && falhou.current === retrato;
    return <Suspense fallback={<div className="content"><p className="muted" role="status">Carregando ficha…</p></div>}>
      <FichaJogo draft={draft} campanha={campanha} memoria={`${userId}:${campaignId}:${idReal}`} onChange={mudar} onOpenContent={onOpenContent}
        onEditar={editar} onProgredir={editar} podeConceder={mestre} moedas={moedas}
        salvamento={<p className="muted ficha-salvamento" role="status" data-testid="estado-salvamento">{salvando ? "Salvando…" : conflito ? "Alterações não salvas: há um conflito." : naoSalvo ? "Não foi possível salvar." : sujo ? "Alterações pendentes…" : "Tudo salvo."}
          {naoSalvo && <>{" "}<button type="button" className="btn-secondary" onClick={() => void salvar(true)}>Tentar salvar de novo</button></>}</p>}
        avisos={<>{avisoConflito}
          {msg && <Aviso erro={!msg.ok} t={msg.t}/>}
          {recuperacao && <div className="notice" role="status">Existem alterações locais não salvas. <button type="button" className="btn-secondary" onClick={() => { setSecao("ficha"); setVisualizando(false); }}>Revisar recuperação no editor</button></div>}</>}
        combate={servidor ? <EstadoCombateFicha characterId={idReal}/> : undefined}/>
    </Suspense>;
  }

  const botoes = <div className="criador-acoes">
    {(existe || sujo) && <button type="button" className="btn-secondary" onClick={cancelarEdicao} disabled={salvando}>Cancelar</button>}
    <button type="button" className="btn-primary" onClick={() => void salvarEdicao()} disabled={salvando || (!base && !sujo && salvo !== null)}>{salvando ? "Salvando…" : "Salvar"}</button>
  </div>;
  return <div ref={raizEditor} className="content ficha auth wide criador">
    <div className="eyebrow">{campanha.toLocaleUpperCase("pt-BR")} · {base ? "EDITAR PERSONAGEM" : "CRIAR PERSONAGEM"} · {modern2014(draft) ? label2014(draft.classId).toLocaleUpperCase("pt-BR") : "GUERREIRO"} (SRD 2014)</div>
    <div className="criador-topo"><h1>{draft.name.trim() || "Novo personagem"}</h1>{botoes}</div>
    {saida && <div className="notice err criador-saida" role="alertdialog" aria-label="Alterações não salvas">
      <p>Há alterações nesta edição que ainda não foram salvas.</p>
      <div className="row"><button type="button" className="btn-primary" autoFocus onClick={() => setSaida(null)}>Continuar editando</button>
        <button type="button" className="btn-secondary" disabled={salvando} onClick={() => void salvarEdicao()}>Salvar e voltar</button>
        <button type="button" className="btn-secondary danger" onClick={() => { consumirEntradaDoHistorico(); descartarEdicao(); }}>Descartar alterações</button></div></div>}
    {servidor
      ? <p className="muted" role="note" data-testid="aviso-servidor">{somenteFicha ? "Ficha de outro jogador: você a edita como mestre. As escolhas da identidade pública continuam sendo do dono." : "A ficha é privada (você e o mestre). Os outros jogadores veem só a apresentação da aba Identidade pública."}</p>
      : <div className="notice" role="note" data-testid="aviso-armazenamento">Armazenamento <strong>experimental</strong>: o personagem fica só neste navegador, não sincroniza entre aparelhos e não é privado de quem usa o mesmo navegador.</div>}
    {avisoConflito}
    {recuperacao && <div className="notice" role="status" data-testid="aviso-recuperacao"><p>Há alterações deste personagem que não chegaram ao servidor ({recuperacao.motivo || "falha anterior"}), guardadas neste navegador em {new Date(recuperacao.em).toLocaleString("pt-BR")}.</p><div className="row"><button type="button" className="btn-primary" onClick={restaurar}>Restaurar essas alterações</button><button type="button" className="btn-secondary" onClick={descartarRecuperacao}>Descartar</button></div></div>}
    <nav className="ficha-subnav criador-abas" aria-label="Seções do personagem">{sec("ficha", "Ficha")}{sec("equipamento", "Equipamento inicial")}{sec("inventario", "Inventário")}{sec("identidade", "Identidade pública")}</nav>
    {msg && <Aviso erro={!msg.ok} t={msg.t}/>}
    {erro && <Aviso erro t={erro}/>}
    {sujo && <p className="muted" role="status">Alterações não salvas.</p>}

    {secao === "ficha" && <div className="criador-sec">
      {!modern2014(draft) && <Suspense fallback={<p role="status">Carregando opções de personagem…</p>}><Opcoes2014 draft={draft} onChange={mudarComEntrega}/></Suspense>}
      <section className="criador-principal" aria-label="Identificação">
        <CampoRetrato valor={draft.portrait ?? ""} campaignId={campaignId} onChange={portrait => mudar({ ...draft, portrait })}/>
        <div className="criador-campos">
          <label>Nome do personagem<input ref={nameRef} aria-label="Nome do personagem" value={draft.name} maxLength={120} onChange={e => mudar({ ...draft, name: e.target.value })}/></label>
          <label>Alcunha (opcional)<input aria-label="Alcunha" value={draft.nickname ?? ""} maxLength={120} onChange={e => mudar({ ...draft, nickname: e.target.value })}/></label>
          <label>Nível<select aria-label="Nível" value={draft.level} onChange={e => alterarNivel(Number(e.target.value))}>{(modern2014(draft) ? Array.from({ length: 20 }, (_, i) => i + 1) : [1, 2, 3, 4, 5, 6]).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        </div>
      </section>
      {modern2014(draft) && <Suspense fallback={<p role="status">Carregando opções de personagem…</p>}><Opcoes2014 draft={draft} onChange={mudarComEntrega}/></Suspense>}{!modern2014(draft) && <p className="muted">Raça: Anão · Antecedente: Acólito · Classe: Guerreiro</p>}
      <fieldset><legend>Atributos-base (antes dos bônus raciais)</legend>
        <label>Método<select aria-label="Método de atributos" value={metodo} onChange={e => trocarMetodo(e.target.value as Metodo)}><option value="point-buy">Compra de pontos (27)</option><option value="standard-array">Matriz padrão</option><option value="manual">Rolagens manuais (3–18)</option>{metodo === "preserved" && <option value="preserved">Valores preservados da ficha</option>}</select></label>
        {metodo === "point-buy" && <p className="muted">Pontos gastos: {pointBuySpent(draft.baseAbilities)} / {POINT_BUY_BUDGET}</p>}
        {metodo === "preserved" && <p role="note">Os atributos desta ficha foram preservados. Selecione outro método somente se deseja redistribuí-los; nada será salvo automaticamente.</p>}{metodo === "manual" && <p>Role 4d6, descarte o menor dado e informe a soma dos três restantes em cada atributo, antes dos bônus raciais.</p>}
        <div className="criador-atributos">{ABILITY_ORDER.map(a => <label key={a}>{rotuloAtributo(a)}
          {metodo === "point-buy" && <button type="button" className="btn-secondary" aria-label={"− Diminuir " + rotuloAtributo(a)} disabled={draft.baseAbilities[a] <= 8} onClick={() => alterarAtributo(a, draft.baseAbilities[a] - 1)}>−</button>}
          {metodo === "manual" ? <input type="number" aria-label={"Atributo " + a} min={3} max={18} value={draft.baseAbilities[a]} onChange={e => alterarAtributo(a, Number(e.target.value))}/> : <select disabled={metodo === "preserved"} aria-label={"Atributo " + a} value={draft.baseAbilities[a]} onChange={e => alterarAtributo(a, Number(e.target.value))}>
            {(metodo === "preserved" ? [draft.baseAbilities[a]] : metodo === "standard-array" ? [15, 14, 13, 12, 10, 8] : [8, 9, 10, 11, 12, 13, 14, 15]).map(v => <option key={v} value={v}>{v}</option>)}</select>}
          {metodo === "point-buy" && <button type="button" className="btn-secondary" aria-label={"+ Aumentar " + rotuloAtributo(a)} disabled={draft.baseAbilities[a] >= 15 || pointBuySpent({ ...draft.baseAbilities, [a]: draft.baseAbilities[a] + 1 }) > POINT_BUY_BUDGET} onClick={() => alterarAtributo(a, draft.baseAbilities[a] + 1)}>+</button>}</label>)}</div>
        {erroAtrib && <p role="alert" className="notice err">{erroAtrib}</p>}
      </fieldset>
      {escolhasDoNivel.map(ch => ch.count > 1
        ? <fieldset key={ch.id}><legend>Perícias do Guerreiro (escolha {ch.count})</legend>
          <div className="criador-pericias">{ch.options.map(o => { const marcadas = draft.decisions.find(d => d.id === ch.id)?.optionIds ?? [];
            return <label key={o.id} className="check"><input type="checkbox" aria-label={"Perícia " + o.id} checked={marcadas.includes(o.id)} disabled={!marcadas.includes(o.id) && marcadas.length >= ch.count}
              onChange={e => mudar({ ...draft, decisions: [...draft.decisions.filter(d => d.id !== ch.id), { id: ch.id, optionIds: e.target.checked ? [...marcadas, o.id] : marcadas.filter(x => x !== o.id) }] })}/> {rotuloPericia(o.id)}</label>; })}</div></fieldset>
        : <label key={ch.id}>{ch.id === "fighter-style-1" ? "Estilo de luta (nível 1)" : ch.id === "fighter-archetype-3" ? "Arquétipo marcial (nível 3)" : `Melhoria de atributo (nível ${ch.level})`}
          <select aria-label={ch.id === "fighter-asi-4" ? "Melhoria de atributo" : ch.id} value={draft.decisions.find(d => d.id === ch.id)?.optionIds[0] ?? ""}
            onChange={e => mudar({ ...draft, decisions: [...draft.decisions.filter(d => d.id !== ch.id), ...(e.target.value ? [{ id: ch.id, optionIds: [e.target.value] }] : [])] })}>
            <option value="">Selecione uma opção</option>{ch.options.map(o => <option key={o.id} value={o.id}>{rotuloOpcao(o.id)}</option>)}</select></label>)}
      <fieldset className="criador-historia"><legend>História e personalidade (opcional, privado)</legend>
        {CAMPOS_HISTORIA.map(([chave, rotulo]) => <label key={chave} className={chave === "historia" ? "criador-largo" : undefined}>{rotulo}<textarea aria-label={rotulo} rows={chave === "historia" ? 6 : 3} maxLength={chave === "historia" ? 8000 : 1500} value={draft.story?.[chave] ?? ""} onChange={e => mudar({ ...draft, story: { ...draft.story, [chave]: e.target.value } })}/></label>)}
      </fieldset>
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

    {secao === "ficha" && modern2014(draft) && !erro && <Suspense fallback={<p role="status">Carregando resumo…</p>}><Resumo2014 draft={draft} onChange={mudarComEntrega}/></Suspense>}
    {secao === "equipamento" && modern2014(draft) && <Suspense fallback={<p role="status">Carregando equipamento…</p>}><Equipamento2014 draft={draft} onChange={mudarComEntrega}/></Suspense>}{secao === "equipamento" && !modern2014(draft) && <div className="criador-sec">
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
        <span><strong>{nomeDaInstancia(item)}</strong> · quantidade {item.quantity}{item.origin === "starting" ? " · inicial" : ""}{def?.peso != null ? ` · ${String(def.peso * item.quantity).replace(".", ",")} kg` : ""}</span>
        <span className="row">
          {def && <button type="button" className="btn-secondary" aria-label={`Consultar no Compêndio: ${nomeDaInstancia(item)}`} onClick={() => onOpenContent(itemSpec(item.itemId, nomeDaInstancia(item)))}>Consultar no Compêndio</button>}
          <button type="button" className="btn-secondary" aria-label={`+1: adicionar quantidade de ${nomeDaInstancia(item)}`} onClick={() => mudar(changeInventoryInstanceQuantity(draft, item.id, 1))}>+1</button>
          <button type="button" className="btn-secondary" aria-label={`−1: remover quantidade de ${nomeDaInstancia(item)}`} onClick={() => mudar(changeInventoryInstanceQuantity(draft, item.id, -1))}>−1</button></span></li>; })}</ul>
      <div style={{ position: "relative", maxWidth: 520 }}>
        <label htmlFor="criador-busca-item">Adicionar item do catálogo</label>
        <input id="criador-busca-item" type="search" role="combobox" aria-autocomplete="list" aria-expanded={resultadosBusca.length > 0} aria-controls="criador-sugestoes-item" aria-label="Buscar item para adicionar" value={busca} placeholder="Digite ao menos 2 letras" onChange={e => setBusca(e.target.value)}/>
        {busca.trim().length >= 2 && <div id="criador-sugestoes-item" role="listbox" aria-label="Resultados da pesquisa de itens" style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, maxHeight: 260, overflowY: "auto", background: "var(--surface, #20242b)", border: "1px solid var(--border, #626b78)", borderRadius: 8, padding: 8, boxShadow: "0 8px 20px #0005" }}>
          {resultadosBusca.length === 0 && <p className="muted" role="status">Nenhum item mundano encontrado.</p>}
          {resultadosBusca.map(l => <div role="option" aria-selected={false} key={l.key} className="row-between" style={{ gap: 8, padding: "6px 0" }}><span>{l.name}</span><button type="button" className="btn-secondary" aria-label={`Adicionar ${l.name}`} onClick={() => { mudar(addInventoryInstance(draft, { id: crypto.randomUUID(), itemId: l.ref.id, quantity: 1, equipped: false, origin: "acquired" })); setBusca(""); }}><Plus size={14} aria-hidden="true"/> Adicionar</button></div>)}
        </div>}
      </div>
    </section>}

    {secao === "identidade" && <div className="criador-sec">
      {somenteFicha ? <Aviso t="A identidade pública pertence ao dono do personagem. Como mestre, você edita a ficha, mas não altera nem lê a identidade privada dele."/> : <>
      <PublicIdentityEditor key={draft.id} source={origem} initialIdentity={identity} onChange={x => { setIdentity(x); setMsg(null); }}/></>}
    </div>}

    <div className="row criador-rodape">
      {servidor ? <p className="muted" data-testid="exclusao-indisponivel">A exclusão e a transferência de personagens salvos na campanha seguem o fluxo narrativo (ainda não disponível aqui); por isso não há botão de excluir.</p>
        : !excluindo ? <button type="button" className="btn-secondary danger" onClick={() => setExcluindo(true)} disabled={salvo === null}><Trash2 size={15} aria-hidden="true"/> Excluir personagem</button>
        : <><button type="button" className="btn-secondary danger" onClick={() => { store.excluir(id); setSalvo(null); registrarTitulo(id, "Personagem excluído"); avisarRegistros(); setDraft(novoRascunho(id)); setIdentity(defaultPublicIdentity()); setEscolhas(escolhasDoInventario(novoRascunho(id))); setExcluindo(false); setMsg({ ok: true, t: "Personagem excluído deste navegador." }); }}>Confirmar exclusão</button>
          <button type="button" className="btn-secondary" onClick={() => setExcluindo(false)}>Cancelar</button></>}
    </div>
  </div>;
}
