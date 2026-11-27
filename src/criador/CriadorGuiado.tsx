import { metodoPreservado, manualValido, type MetodoAtributos } from './atributos-2014';
import { consumirItem } from "../ficha/inventarioAcoes";
import { useVitais } from "../vitais/loja";
import { aplicarAcao, comVitais, novaOperacao, vitaisDoDraft, type AcaoVital } from "../vitais/vitais";
import type { ResultadoItem } from "../fichas";
// Criador guiado SRD 2014; mantém leitura/edição versionada das fichas legadas. Reaproveita as regras de `src/rules` e o catálogo
// canônico; não duplica lógica. Ficha, equipamento inicial, inventário (dentro da ficha) e identidade pública em seções.
// Persistência por `RepositorioPersonagem`: SERVIDOR (Supabase, ficha privada + identidade pública, revisão otimista) quando há conta e a API de fichas;
// senão o armazenamento local EXPERIMENTAL (`armazenamento.ts`: sem segurança entre usuários e sem sincronização).
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useRef, lazy, Suspense } from "react";
import { useAuth } from "../AuthContext";
import { useCampaigns } from "../CampaignsContext";
import { useFichas, useMoedasDaCampanha } from "../RegistrosContext";
import { Aviso } from "../Diario";
import { ERRO_CONFLITO_REVISAO, retratoValido } from "../fichas";
import { avisarRegistros, registrarTitulo } from "../registrosStore";
import { buildPilotCharacterCatalog } from "../rules/character-catalogue-adapter";
import { ABILITY_ORDER, validatePointBuy } from "../rules/ability-generation-2014";
import { createCharacterSheet, type CharacterDraft } from "../rules/character-domain";
import { fighter2014Advancements } from "../rules/fighter-2014";
import { defaultPublicIdentity, publicIdentityCard, type PublicIdentity } from "../rules/public-identity";
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
const AtivarRegras2014 = lazy(async () => { await carregar2014(); return { default: (await import('./Opcoes2014')).AtivarRegras2014 }; });
const AssistentePersonagem = lazy(async () => { await carregar2014(); return { default: (await import('./AssistentePersonagem')).AssistentePersonagem }; });
const SubirNivel = lazy(async () => { await carregar2014(); return { default: (await import('./SubirNivel')).SubirNivel }; });
const modern2014 = (d: CharacterDraft) => d.catalogueVersion === 'character-srd-2014-v2';
const sheet2014 = (d: CharacterDraft) => { if (!regras2014) throw new Error('Carregando regras de personagem…'); return regras2014.sheet2014(d); };
const label2014 = (id: string) => regras2014?.label2014(id) ?? id;
const FichaJogo = lazy(async () => { await carregar2014(); return import("../ficha/FichaJogo"); });
import { origemPublica } from "./rotulos";
import { AbaIdentidade } from "../ficha/AbaIdentidade";
import type { Etapa } from "./AssistentePersonagem";

const { catalog } = buildPilotCharacterCatalog(criadorRules, { race: criadorRefs.race, background: criadorRefs.background, class: criadorRefs.class }, fighter2014Advancements);
/** PV guardado acima do máximo atual (nível ou Constituição mudaram depois do combate) é mostrado no máximo, nunca impede abrir a ficha. */
const dentroDoMaximo = (draft: CharacterDraft): CharacterDraft => {
  if (!modern2014(draft)) return draft;
  const maximo = sheet2014({ ...draft, name: draft.name.trim() || "Sem nome", currentHp: 0 }).maxHp;
  return draft.currentHp > maximo ? { ...draft, currentHp: maximo } : draft;
};
const calcularFicha = (draft: CharacterDraft) => modern2014(draft) ? sheet2014(dentroDoMaximo(draft)) : createCharacterSheet(draft, catalog);
type Metodo = MetodoAtributos;
const maxHpBase = (con: number) => 10 + Math.floor((con + 2 - 10) / 2);   // 10 + modificador de Constituição (Anão: +2 racial), nível 1

const novoRascunho = (id: string): CharacterDraft => {
  const draft: CharacterDraft = { id, name: "", ruleset: "5e-2014", catalogueVersion: "character-srd-2014-v2", baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
    raceId: "hill-dwarf", backgroundId: "acolyte", classId: "fighter", level: 1, decisions: [], inventory: [], currentHp: 0, temporaryHp: 0, spentResources: {} };
  return regras2014 ? { ...draft, currentHp: regras2014.sheet2014(draft).maxHp } : draft;
};
/** Erros do domínio estão em inglês; a interface mostra a versão em português. */
const erroDeAtributo = (e: unknown) => { const m = e instanceof Error ? e.message : String(e); return /budget exceeded/i.test(m) ? "A compra de pontos passa de 27 pontos. Reduza outro atributo antes." : /between 8 and 15/i.test(m) ? "Na compra de pontos cada atributo vai de 8 a 15." : m; };
/** Equipamento inicial da classe e da origem já confirmados (fichas de versão anterior não têm essa etapa). */
const gruposCompletos = (d: CharacterDraft) => !modern2014(d) || (d.decisions.some(x => x.id === 'equipment-accepted' && x.optionIds.includes('yes')) && d.decisions.some(x => x.id === 'background-equipment' && x.optionIds.includes('accepted')));
const pendente2014 = (sheet: { pending: string[] }, d: CharacterDraft) => sheet.pending.length > 0 || !gruposCompletos(d);

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
  const [etapa, setEtapa] = useState<Etapa>("identidade");
  const [subindo, setSubindo] = useState(false);
  // Ficha de jogo ou edição é estado desta tela, nunca da navegação: abrir um personagem já salvo mostra sempre a ficha.
  const [visualizando, setVisualizando] = useState(initialView);
  /** Estado no momento em que "Editar personagem" foi usado: é para onde Cancelar volta. `null` na criação. */
  const [base, setBase] = useState<{ draft: CharacterDraft; identity: PublicIdentity } | null>(null);
  const [saida, setSaida] = useState<"cancelar" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [metodo, setMetodo] = useState<Metodo>("point-buy"), [erroAtrib, setErroAtrib] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const aplicarCarregado = (p: { id: string; draft: CharacterDraft; identity: PublicIdentity; revision: number | null; somenteFicha: boolean }) => {
    calcularFicha(p.draft);   // dado inválido/de outra versão falha aqui, não na tela
    setDraft(p.draft); setIdentity(p.identity); setIdReal(p.id); setExiste(true); setRevisao(p.revision); setSomenteFicha(p.somenteFicha);
    setSalvo(JSON.stringify({ draft: p.draft, identity: p.identity }));
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
        if (p) { aplicarCarregado(p); setVisualizando(true); } else { const novo = novoRascunho(id); setDraft(novo); registrarTitulo(id, "Novo personagem"); }
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
  const configMoedas = useMoedasDaCampanha(campaignId), moedas = configMoedas.ativas;

  // ------------------------------------------------------------ estado vital (PV, temporários, condições, morte)
  // Com ficha salva no servidor, a única fonte é o servidor: a tela mostra o confirmado + operações a caminho, e nada disso passa pelo
  // salvamento da ficha inteira (que o banco ignora nesses campos). Antes do primeiro salvamento e no modo local, vive no rascunho.
  const fichas = useFichas();
  const sincronizado = servidor && existe && carga === "pronto" && modern2014(draft);
  const vit = useVitais(sincronizado ? fichas : null, sincronizado ? [idReal] : [], campaignId);
  const linha = sincronizado ? vit.ver(idReal) : undefined;
  const maximoDe = (d: CharacterDraft) => { try { return modern2014(d) && regras2014 ? regras2014.sheet2014({ ...d, name: d.name.trim() || "Sem nome", currentHp: 0 }).maxHp : null; } catch { return null; } };
  const maximo = carga === "pronto" ? maximoDe(draft) : null;
  const draftTela = useMemo(() => {
    const d = linha ? comVitais(draft, linha) : draft;
    return maximo !== null && d.currentHp > maximo ? { ...d, currentHp: maximo } : d;
  }, [draft, linha?.versao, linha?.pv, linha?.temp, linha?.condicoes, linha?.morte, maximo]);   // eslint-disable-line react-hooks/exhaustive-deps
  const vital = (acao: AcaoVital) => {
    if (sincronizado && vit.loja) { vit.loja.enviar(idReal, acao); return; }
    setDraft(d => comVitais(d, aplicarAcao(vitaisDoDraft(d), acao))); setMsg(null);
  };
  /** Mudanças feitas na ficha: o estado vital nunca vai junto (ele só muda por operação). */
  const mudarNaFicha = (proximo: CharacterDraft) => mudar(sincronizado ? comVitais(proximo, vitaisDoDraft(draft)) : proximo);

  /** Adota uma ficha devolvida por uma operação do servidor (consumo, transferência). */
  const adotar = (r: ResultadoItem) => {
    vit.loja?.receber(r, r.draft);
    setDraft(r.draft); setRevisao(r.revision); setSalvo(JSON.stringify({ draft: r.draft, identity }));
  };
  const [operando, setOperando] = useState(false);
  /** O mesmo identificador é reaproveitado até haver resposta: tentar de novo após uma falha de rede nunca repete o efeito. */
  const operacoes = useRef(new Map<string, string>());
  const operarNoServidor = async (chaveOp: string, fazer: (operacao: string) => Promise<{ ok: true; data: ResultadoItem } | { ok: false; error: string }>): Promise<string | null> => {
    if (operando || salvando) return "Aguarde a operação em andamento.";
    if (conflito || recuperacao) return "Resolva o aviso da ficha antes de continuar.";
    if (sujo && !(await salvarAtual.current(true))) return "Não foi possível salvar a ficha antes da operação. Nada foi alterado.";
    const operacao = operacoes.current.get(chaveOp) ?? novaOperacao();
    operacoes.current.set(chaveOp, operacao); setOperando(true);
    try {
      const r = await fazer(operacao);
      if (!r.ok) { if (r.error !== "Sem conexão com o servidor.") operacoes.current.delete(chaveOp); return r.error; }
      operacoes.current.delete(chaveOp); adotar(r.data); return null;
    } catch { return "Sem conexão com o servidor."; } finally { setOperando(false); }
  };
  const usarItem = async (instancia: string, cura: number): Promise<string | null> => {
    const max = maximoDe(draftTela) ?? draftTela.currentHp;
    if (sincronizado && fichas) return operarNoServidor(`usar:${instancia}:${cura}`, op => fichas.usarConsumivel(idReal, instancia, cura, max, op));
    const r = consumirItem(draft, instancia, cura, max);
    if (!r.ok) return r.erro;
    mudar(r.draft); return null;
  };
  const transferir = sincronizado && fichas
    ? (destino: string, instancia: string, quantidade: number) => operarNoServidor(`transferir:${instancia}:${destino}:${quantidade}`, op => fichas.transferirItem(idReal, destino, instancia, quantidade, op))
    : undefined;

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
    // personagem novo nasce com PV cheios; depois disso, PV só mudam por operação
    const novoMax = !existe ? maximoDe(draft) : null;
    const estado = { draft: novoMax !== null && !existe ? { ...draft, currentHp: novoMax, temporaryHp: 0 } : draft, identity };
    if (estado.draft !== draft) setDraft(estado.draft);
    const maxAnterior = existe && salvo ? maximoDe((JSON.parse(salvo) as { draft: CharacterDraft }).draft) : null;
    setSalvando(true);
    try {
      const r = await repo.salvar({ id: idReal, existe, revisao, estado, somenteFicha, source: origem });
      const gravado = { ...estado.draft, id: r.id };
      // o máximo mudou (nível, atributo...): o PV atual acompanha o ganho e nunca passa do novo máximo
      const maxNovo = maximoDe(estado.draft);
      if (maxAnterior !== null && maxNovo !== null && maxNovo !== maxAnterior) vital({ tipo: "ajustar", valor: Math.max(0, maxNovo - maxAnterior), maximo: maxNovo });
      // A resposta confirma o snapshot enviado, não alterações feitas enquanto
      // a requisição estava em andamento. Preservar o estado mais recente da UI.
      setDraft(atual => ({ ...atual, id: r.id })); setIdReal(r.id); setExiste(true); setRevisao(r.revision); setConflito(false); setRecuperacao(null);
      setSalvo(JSON.stringify({ draft: gravado, identity }));
      limparRecuperacao(userId, campaignId, id);
      falhou.current = null;
      if (servidor && ehPersonagemNovo(id)) { gravarMapaAba(userId, campaignId, id, r.id); registrarAliasPersonagem(r.id, id); }
      registrarTitulo(id, draft.name.trim()); registrarTitulo(r.id, draft.name.trim()); avisarRegistros();
      if (automatico === true) { setMsg(null); return true; }   // não muda de tela nem de aba
      const incompleto = pendente2014(sheet, draft);
      setMsg({ ok: true, t: servidor ? `${incompleto ? "Rascunho incompleto" : "Personagem"} salvo na campanha.` : `${incompleto ? "Rascunho incompleto salvo" : "Personagem salvo"} neste navegador (armazenamento experimental).` });
      if (!incompleto || base) { setBase(null); setSaida(null); setVisualizando(true); }

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
  const automatico = visualizando && carga === "pronto" && existe && modern2014(draft) && !!sheet && sujo && !salvando && !operando && !conflito && !recuperacao;
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

  // outra parte da ficha mudou no servidor (item recebido, entrega do mestre, outro aparelho): sem alterações minhas, recarrega sozinho
  const atrasada = !!linha && revisao !== null && linha.revision > revisao && visualizando && !sujo && !salvando && !operando && !conflito;
  useEffect(() => {
    if (!atrasada) return;
    let vivo = true;
    void repo.carregar(idRealRef.current).then(p => { if (vivo && p && p.revision !== null && p.revision > (revisao ?? 0)) { setDraft(p.draft); setIdentity(p.identity); setRevisao(p.revision); setSalvo(JSON.stringify({ draft: p.draft, identity: p.identity })); } }, () => {});
    return () => { vivo = false; };
  }, [atrasada, linha?.revision]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------ entrar e sair da edição
  const raizEditor = useRef<HTMLDivElement>(null);
  const marca = `edicao:${id}`, ignorarVoltar = useRef(false);
  const editar = () => {
    falhou.current = null;
    setBase({ draft, identity }); setEtapa("identidade"); setVisualizando(false); setMsg(null);
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
      const novo = novoRascunho(id); setDraft(novo); setIdentity(defaultPublicIdentity());
      pedirFechamento(`criador:${id}`); return;
    }
    const volta = base ?? (salvo ? JSON.parse(salvo) as { draft: CharacterDraft; identity: PublicIdentity } : null);
    if (volta) { setDraft(volta.draft); setIdentity(volta.identity); setMetodo(metodoPreservado(volta.draft.baseAbilities, volta.draft.abilityMethod)); }
    setBase(null); setVisualizando(true);
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
    setDraft({ ...recuperacao.estado.draft, id: idReal }); setMetodo(metodoPreservado(recuperacao.estado.draft.baseAbilities, recuperacao.estado.draft.abilityMethod)); setIdentity(recuperacao.estado.identity); limparRecuperacao(userId, campaignId, id); setRecuperacao(null); setMsg({ ok: true, t: "Alterações restauradas. Revise e clique em Salvar." }); };
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

  const avisoConflito = conflito && <div className="notice err" role="alert" data-testid="aviso-conflito"><p>{ERRO_CONFLITO_REVISAO}</p><div className="row"><button type="button" className="btn-primary" onClick={() => void recarregarServidor()}>Carregar a versão atual</button><button type="button" className="btn-secondary" onClick={() => setConflito(false)}>Continuar editando</button></div></div>;

  // Subida de nível: fluxo próprio sobre a ficha atual; a confirmação grava com a revisão (como qualquer mudança da ficha).
  if (visualizando && subindo && carga === "pronto" && existe && sheet && modern2014(draft) && draft.level < 20) {
    return <Suspense fallback={<div className="content"><p className="muted" role="status">Carregando a subida de nível…</p></div>}>
      <SubirNivel atual={draft} ocupado={salvando || operando} onCancelar={() => setSubindo(false)}
        onConfirmar={proximo => { falhou.current = null; setDraft(proximo); setSubindo(false); setMsg({ ok: true, t: `Nível ${proximo.level} aplicado.` }); }}/>
    </Suspense>;
  }

  // Ficha de jogo (três abas), independente das etapas do criador. Os mesmos dados do motor alimentam a edição e o jogo.
  if (visualizando && carga === "pronto" && existe && sheet) {
    if (!modern2014(draft)) return <div className="content ficha auth wide" data-testid="ficha-guiada-leitura"><h1>{draft.name || "Personagem sem nome"}</h1>
      {msg && <Aviso erro={!msg.ok} t={msg.t}/>}
      <p className="notice" role="note">Este personagem usa uma versão anterior das regras. Abra a edição e atualize-o para SRD 2014 para usar a ficha de jogo.</p>
      <button type="button" className="btn-primary" onClick={editar}>Editar personagem</button></div>;
    const naoSalvo = sujo && !salvando && falhou.current === retrato;
    return <Suspense fallback={<div className="content"><p className="muted" role="status">Carregando ficha…</p></div>}>
      <FichaJogo identidade={<AbaIdentidade identity={identity} source={origem} retrato={draft.portrait} editavel={!somenteFicha} onChange={proxima => { setIdentity(proxima); setMsg(null); }}/>} draft={draftTela} campanha={campanha} memoria={`${userId}:${campaignId}:${idReal}`} onChange={mudarNaFicha} vital={vital} usarItem={usarItem} transferir={transferir} personagemId={idReal} campaignId={campaignId} onOpenContent={onOpenContent}
        onEditar={editar} onProgredir={() => { setMsg(null); setSubindo(true); }} podeConceder={mestre} moedas={configMoedas.pronto ? moedas : null}
        salvamento={<p className="muted ficha-salvamento" role="status" data-testid="estado-salvamento">{salvando ? "Salvando…" : conflito ? "Alterações não salvas: há um conflito." : naoSalvo ? "Não foi possível salvar." : sujo ? "Alterações pendentes…" : "Tudo salvo."}
          {naoSalvo && <>{" "}<button type="button" className="btn-secondary" onClick={() => void salvar(true)}>Tentar salvar de novo</button></>}</p>}
        avisos={<>{avisoConflito}
          {sincronizado && vit.erro && <div className="notice err" role="alert" data-testid="aviso-sincronizacao"><p>{vit.erro}{vit.pendentes > 0 ? ` ${vit.pendentes} alteração(ões) aguardando envio.` : ""}</p><button type="button" className="btn-secondary" onClick={() => { vit.loja?.tentar(); void vit.loja?.ler([idReal]); }}>Tentar agora</button></div>}
          {msg && <Aviso erro={!msg.ok} t={msg.t}/>}
          {recuperacao && <div className="notice" role="status">Existem alterações locais não salvas. <button type="button" className="btn-secondary" onClick={() => setVisualizando(false)}>Revisar recuperação no editor</button></div>}</>}/>
    </Suspense>;
  }

  const botoes = <div className="criador-acoes">
    {(existe || sujo) && <button type="button" className="btn-secondary" onClick={cancelarEdicao} disabled={salvando}>Cancelar</button>}
    <button type="button" className="btn-primary" onClick={() => void salvarEdicao()} disabled={salvando || (!base && !sujo && salvo !== null)}>{salvando ? "Salvando…" : "Salvar"}</button>
  </div>;
  return <div ref={raizEditor} className="content ficha auth wide criador sistema-dnd">
    <div className="eyebrow">{campanha.toLocaleUpperCase("pt-BR")} · {base ? "EDITAR PERSONAGEM" : "CRIAR PERSONAGEM"} · D&amp;D 5e (2014)</div>
    <div className="criador-topo"><h1>{draft.name.trim() || "Novo personagem"}</h1>{botoes}</div>
    {saida && <div className="notice err criador-saida" role="alertdialog" aria-label="Alterações não salvas">
      <p>Há alterações nesta edição que ainda não foram salvas.</p>
      <div className="row"><button type="button" className="btn-primary" autoFocus onClick={() => setSaida(null)}>Continuar editando</button>
        <button type="button" className="btn-secondary" disabled={salvando} onClick={() => void salvarEdicao()}>Salvar e voltar</button>
        <button type="button" className="btn-secondary danger" onClick={() => { consumirEntradaDoHistorico(); descartarEdicao(); }}>Descartar alterações</button></div></div>}
    {!servidor && <div className="notice" role="note" data-testid="aviso-armazenamento">Armazenamento <strong>experimental</strong>: o personagem fica só neste navegador, não sincroniza entre aparelhos e não é privado de quem usa o mesmo navegador.</div>}
    {servidor && somenteFicha && <p className="muted" role="note" data-testid="aviso-servidor">Ficha de outro jogador: você a edita como mestre.</p>}
    {avisoConflito}
    {recuperacao && <div className="notice" role="status" data-testid="aviso-recuperacao"><p>Há alterações deste personagem que não chegaram ao servidor ({recuperacao.motivo || "falha anterior"}), guardadas neste navegador em {new Date(recuperacao.em).toLocaleString("pt-BR")}.</p><div className="row"><button type="button" className="btn-primary" onClick={restaurar}>Restaurar essas alterações</button><button type="button" className="btn-secondary" onClick={descartarRecuperacao}>Descartar</button></div></div>}
    {msg && <Aviso erro={!msg.ok} t={msg.t}/>}
    {erro && <Aviso erro t={erro}/>}
    {sujo && <p className="muted" role="status">Alterações não salvas.</p>}

    {!modern2014(draft)
      ? <Suspense fallback={<p role="status">Carregando opções de personagem…</p>}><p className="muted">Este personagem usa uma versão anterior das regras.</p><AtivarRegras2014 draft={draft} onChange={mudar}/></Suspense>
      : sheet && regras2014 ? <Suspense fallback={<p role="status">Carregando o criador…</p>}>
        <AssistentePersonagem modo={base ? "editar" : "criar"} etapa={etapa} onEtapa={setEtapa} draft={draft} sheet={sheet} onChange={mudar} campaignId={campaignId} moedas={moedas} nomeRef={nameRef}
          metodo={metodo} onMetodo={trocarMetodo} onAtributo={alterarAtributo} erroAtributo={erroAtrib} onNivel={alterarNivel}
          identity={identity} onIdentity={x => { setIdentity(x); setMsg(null); }} origemPublica={origem} somenteFicha={somenteFicha}
          concluir={<button type="button" className="btn-primary" disabled={salvando} onClick={() => void salvarEdicao()}>{salvando ? "Salvando…" : "Salvar personagem"}</button>}/>
      </Suspense> : null}

    {!servidor && salvo !== null && <div className="row criador-rodape">
      {!excluindo ? <button type="button" className="btn-secondary danger" onClick={() => setExcluindo(true)}><Trash2 size={15} aria-hidden="true"/> Excluir personagem</button>
        : <><button type="button" className="btn-secondary danger" onClick={() => { store.excluir(id); setSalvo(null); registrarTitulo(id, "Personagem excluído"); avisarRegistros(); setDraft(novoRascunho(id)); setIdentity(defaultPublicIdentity()); setExcluindo(false); setMsg({ ok: true, t: "Personagem excluído deste navegador." }); }}>Confirmar exclusão</button>
          <button type="button" className="btn-secondary" onClick={() => setExcluindo(false)}>Cancelar</button></>}
    </div>}
  </div>;
}
