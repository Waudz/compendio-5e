// Anotações pessoais para mestre e jogador. VÁRIOS PLANEJAMENTOS (ex.: "Sessão 1", "Sessão 2") + as ANOTAÇÕES PERMANENTES, que valem para a campanha toda.
// Cada planejamento é um quadro: COLUNAS lado a lado (largura ajustável) -> SEÇÕES empilhadas (título próprio, normal ou grande) -> CARTÕES (páginas privadas).
// O cartão é só o texto: título no cabeçalho, conteúdo inteiro abaixo; clique no texto para editar ali mesmo (salva sozinho). O rascunho vive aqui no painel:
// mover, arrastar, trocar de planejamento ou clicar em outro cartão nunca perde o que foi digitado; se o salvamento falhar o texto continua na tela.
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, pointerWithin, rectIntersection, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ClipboardList, GripVertical, MoreHorizontal, Pin, Plus, Trash2, Type } from "lucide-react";
import { Fragment, createContext, useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent as RKeyEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { useAbrirEmAba } from "./abrirEmAba";
import { useAuth } from "./AuthContext";
import { useCampaigns } from "./CampaignsContext";
import { ConflitoAviso } from "./ConflitoAviso";
import { ConteudoLeve, temConteudo } from "./ConteudoLeve";
import { EditorLazy } from "./EditorLazy";
import type { BlocoTexto } from "./inicio";
import { LARGURA_MAX, LARGURA_MIN, LARGURA_PADRAO, adicionarCartao, alternarTituloGrande, alternarTituloSecao, excluirSecoes, lerQuadro, limitarLargura, novaColuna, novaSecaoDepois, novoId, redimensionarColuna, removerCartao, renomearSecao, soltarCartao, soltarSecao, todosCartoes, type Quadro, type Secao } from "./quadro";
import { validarTitulo, type Registro } from "./registros";
import { useRegistros } from "./RegistrosContext";
import { novaOrigem, publicarExclusao, publicarRegistro, useAssinaturaGeral, type Conflito } from "./registrosStore";
import { useUnsavedGuard } from "./unsaved";
import type { TabSpec } from "./workspace";

/** Estado de edição de um cartão (rascunho incluído). `editando` = editor aberto; fora disso o cartão mostra o conteúdo em leitura. */
type Ed = { editando: boolean; titulo: string; blocos: BlocoTexto[]; editou: boolean; base: Registro; chave: number; conflito: Conflito | null; salvando: boolean; erro: string | null };
export const edSujo = (e: Ed) => e.editou || e.titulo !== e.base.title;
const novoEd = (r: Registro, editando = false): Ed => ({ editando, titulo: r.title, blocos: r.content, editou: false, base: r, chave: 0, conflito: null, salvando: false, erro: null });
export const ATRASO_AUTOSSALVAR = 900;   // ms depois da última alteração
const NOME_PERMANENTE = "Anotações permanentes";
const ehPermanente = (b: Registro) => (b.meta as { permanente?: unknown }).permanente === true;
const ordemPlano = (b: Registro) => { const n = (b.meta as { ordem?: unknown }).ordem; return typeof n === "number" && Number.isFinite(n) ? n : new Date(b.createdAt).getTime(); };
const ordenarPlanos = (bs: Registro[]) => [...bs].sort((a, b) => Number(ehPermanente(b)) - Number(ehPermanente(a)) || ordemPlano(a) - ordemPlano(b) || a.createdAt.localeCompare(b.createdAt));
const quadroInicial = (titulo: string) => ({ colunas: [{ id: novoId(), secoes: [{ id: novoId(), titulo, cartoes: [] }] }] });
/** Criação das anotações permanentes e do primeiro planejamento: UMA vez por campanha mesmo com várias leituras simultâneas (StrictMode, dois grupos abertos). */
const emCriacao = new Map<string, Promise<{ ok: true; data: Registro[] } | { ok: false; error: string }>>();
function garantirPlanos(api: NonNullable<ReturnType<typeof useRegistros>>, cid: string, uid: string, falta: { permanente: boolean; plano: boolean }) {
  const key = `${uid}:${cid}`;
  let p = emCriacao.get(key);
  if (!p) {
    p = (async () => {
      const novos: Registro[] = [];
      if (falta.permanente) { const c = await api.create({ kind: "board", campaignId: cid, title: NOME_PERMANENTE, visibility: "private", meta: { permanente: true, ...quadroInicial("Anotações") } }); if (!c.ok) return c; novos.push(c.data); }
      if (falta.plano) { const c = await api.create({ kind: "board", campaignId: cid, title: "Sessão 1", visibility: "private", meta: quadroInicial("Seção 1") }); if (!c.ok) return c; novos.push(c.data); }
      return { ok: true as const, data: novos };
    })();
    emCriacao.set(key, p); void p.finally(() => emCriacao.delete(key));
  }
  return p;
}
const chavePlano = (uid: string | undefined, cid: string) => `compendio5e:plano-ativo:${uid ?? "?"}:${cid}`;
const lerPlanoSalvo = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravarPlanoSalvo = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

export function PlanningPanel({ initialBoardId, onOpenContent }: { initialBoardId?: string; onOpenContent?: (s: TabSpec) => void } = {}) {
  const { active } = useCampaigns(), api = useRegistros(), { user } = useAuth(), { aoClicarDireito, abrirMenuEm } = useAbrirEmAba();
  const cid = active?.campaign.id;
  const origem = useRef(novaOrigem()).current;
  const [boards, setBoards] = useState<Registro[]>([]), [boardId, setBoardId] = useState<string | null>(null);
  const [cenas, setCenas] = useState<Record<string, Registro>>({}); const cenasRef = useRef(cenas); cenasRef.current = cenas;
  const [ed, setEd] = useState<Record<string, Ed>>({}); const edRef = useRef(ed); edRef.current = ed;
  const [sel, setSel] = useState<string[]>([]);
  const [confirmarSecoes, setConfirmarSecoes] = useState<{ ids: string[]; mensagem: string } | null>(null);
  const [confirmarGuia, setConfirmarGuia] = useState<{ id: string; mensagem: string } | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches);
  useEffect(() => { const mq = window.matchMedia("(max-width: 700px)"); const atualizar = () => setMobile(mq.matches); atualizar(); mq.addEventListener?.("change", atualizar); return () => mq.removeEventListener?.("change", atualizar); }, []);   // seções selecionadas com o mouse
  const [carregado, setCarregado] = useState(false), [erro, setErro] = useState<string | null>(null), [aviso, setAviso] = useState<string | null>(null);
  const board = boards.find(b => b.id === boardId) ?? null;
  const boardRef = useRef<Registro | null>(null); boardRef.current = board;
  const boardIdRef = useRef(boardId); boardIdRef.current = boardId;
  const fila = useRef<Promise<unknown>>(Promise.resolve());   // grava o quadro em ordem, uma operação por vez (versão otimista)
  const versoes = useRef(new Map<string, number>());          // versão de cada planejamento no servidor
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const chave = cid ? chavePlano(user?.id, cid) : "";

  const substituirBoard = (r: Registro) => { versoes.current.set(r.id, r.version); setBoards(bs => bs.map(b => b.id === r.id ? r : b)); };

  const carregar = useCallback(async () => {
    if (!api || !cid) return;
    const [b, s] = await Promise.all([api.list(cid, "board"), api.list(cid, "scene")]);
    if (!b.ok || !s.ok) { setErro(!b.ok ? b.error : (s as { error: string }).error); setCarregado(true); return; }
    // Quadros de anotações são pessoais: nunca misturar quadros de outros participantes.
    let lista = b.data.filter(registro => registro.ownerId === user?.id && registro.visibility === "private");
    const falta = { permanente: !lista.some(ehPermanente), plano: !lista.some(x => !ehPermanente(x)) };
    if (falta.permanente || falta.plano) {
      const c = await garantirPlanos(api, cid, user?.id ?? "anonimo", falta);
      if (!c.ok) { setErro(c.error); setCarregado(true); return; }
      lista = [...lista, ...c.data.filter(n => !lista.some(o => o.id === n.id))];
    }
    lista = ordenarPlanos(lista);
    for (const x of lista) versoes.current.set(x.id, x.version);
    const salvo = lerPlanoSalvo(chave);
    const atual = lista.find(x => x.id === initialBoardId) ?? lista.find(x => x.id === boardIdRef.current) ?? lista.find(x => x.id === salvo) ?? lista.find(x => !ehPermanente(x)) ?? lista[0];
    setErro(null); setBoards(lista); setBoardId(atual.id);
    setCenas(prev => { const novo = Object.fromEntries(s.data.filter(r => r.ownerId === user?.id && r.visibility === "private").map(r => [r.id, r])); for (const id of Object.keys(edRef.current)) if (prev[id] && !novo[id]) novo[id] = prev[id]; return novo; });   // cartão com rascunho nunca some numa recarga
    setCarregado(true);
  }, [api, cid, chave, user?.id, initialBoardId]);
  useEffect(() => { setCarregado(false); setBoards([]); setBoardId(null); setEd({}); setSel([]); void carregar(); }, [carregar]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  /** Aplica a mudança do quadro ATIVO na tela já e grava em fila; em conflito ou erro recarrega do servidor. */
  const gravar = (fn: (q: Quadro) => Quadro) => {
    const atual = boardRef.current; if (!atual || !api) return;
    const novo = fn(lerQuadro(atual.meta)); if (JSON.stringify(novo) === JSON.stringify(lerQuadro(atual.meta))) return;
    setAviso(null);
    const otimista = { ...atual, meta: { ...atual.meta, colunas: novo.colunas } }; boardRef.current = otimista; setBoards(bs => bs.map(b => b.id === atual.id ? otimista : b));
    fila.current = fila.current.then(async () => {
      const r = await api.update(otimista.id, versoes.current.get(otimista.id) ?? otimista.version, { meta: otimista.meta });
      if (r.ok) versoes.current.set(r.data.id, r.data.version); else { setAviso(r.error); await carregar(); }
    });
  };

  const removerLocal = (id: string) => { timers.current.delete(id); setCenas(c => { const n = { ...c }; delete n[id]; return n; }); setEd(p => { const n = { ...p }; delete n[id]; return n; }); gravar(q => removerCartao(q, id)); };

  // Alterações salvas em OUTRO lugar (aba do mesmo registro em outro grupo): atualiza título/conteúdo e, se o cartão não tem rascunho, o texto; senão, avisa o conflito.
  useAssinaturaGeral(e => {
    if (e.origem === origem || !boardRef.current) return;
    if (!e.registro) {
      const x = edRef.current[e.id];
      if (x && edSujo(x)) setEd(p => p[e.id] ? { ...p, [e.id]: { ...p[e.id], conflito: { registro: null } } } : p);
      else if (todosCartoes(lerQuadro(boardRef.current.meta)).includes(e.id)) removerLocal(e.id);
      return;
    }
    const r = e.registro;
    setCenas(c => c[r.id] && r.version > c[r.id].version ? { ...c, [r.id]: r } : c);
    setEd(p => {
      const x = p[r.id]; if (!x || r.version <= x.base.version) return p;
      return { ...p, [r.id]: edSujo(x) ? { ...x, conflito: { registro: r } } : { ...x, base: r, titulo: r.title, blocos: r.content, editou: false, chave: x.chave + 1, conflito: null } };
    });
  });

  /** Atualiza o estado de edição do cartão (criando-o a partir do registro salvo se ainda não existir). */
  const mexer = (id: string, f: (x: Ed) => Ed) => setEd(p => { const x = p[id] ?? (cenasRef.current[id] ? novoEd(cenasRef.current[id]) : null); return x ? { ...p, [id]: f(x) } : p; });

  const salvar = useCallback(async (id: string): Promise<boolean> => {
    const t = timers.current.get(id); if (t) { clearTimeout(t); timers.current.delete(id); }
    const x = edRef.current[id]; if (!x || !api) return true;
    if (!edSujo(x)) return true;
    if (x.salvando) { timers.current.set(id, setTimeout(() => { timers.current.delete(id); void salvar(id); }, 300)); return false; }
    const tituloPersistido = x.titulo.trim() || "Novo cartão";
    const bad = validarTitulo(tituloPersistido); if (bad) { mexer(id, y => ({ ...y, erro: bad })); return false; }
    mexer(id, y => ({ ...y, salvando: true, erro: null }));
    const r = await api.update(x.base.id, x.base.version, { title: tituloPersistido, content: x.blocos });
    if (!r.ok) {
      let conflito: Conflito | null = null;
      if (/alterou/i.test(r.error)) { const g = await api.get(id); if (g.ok) conflito = { registro: g.data }; }
      mexer(id, y => ({ ...y, salvando: false, erro: r.error, conflito: conflito ?? y.conflito })); return false;
    }
    let sobrou = false;   // o que foi digitado durante o salvamento é salvo na sequência
    mexer(id, y => { sobrou = y.blocos !== x.blocos || y.titulo !== x.titulo; return { ...y, salvando: false, base: r.data, editou: y.blocos === x.blocos ? false : y.editou, titulo: y.titulo === x.titulo ? r.data.title : y.titulo, conflito: null }; });
    setCenas(c => ({ ...c, [id]: r.data })); publicarRegistro(r.data, origem);
    if (sobrou) timers.current.set(id, setTimeout(() => { timers.current.delete(id); void salvar(id); }, 200));
    return true;
  }, [api, origem]); // eslint-disable-line react-hooks/exhaustive-deps

  const agendar = (id: string) => { const t = timers.current.get(id); if (t) clearTimeout(t); timers.current.set(id, setTimeout(() => { timers.current.delete(id); void salvar(id); }, ATRASO_AUTOSSALVAR)); };

  // Clicar fora do cartão que está sendo editado: salva e volta a mostrar o conteúdo em leitura (popovers do editor não contam como "fora").
  useEffect(() => {
    const h = (e: PointerEvent) => {
      const alvo = e.target as Element | null; if (!alvo || alvo.closest("[class*='mantine'], [class*='bn-']")) return;
      const dentro = alvo.closest("[data-cartao]")?.getAttribute("data-cartao");
      for (const [id, x] of Object.entries(edRef.current)) if (x.editando && id !== dentro) { if (edSujo(x)) void salvar(id); setEd(p => p[id] ? { ...p, [id]: { ...p[id], editando: false } } : p); }
    };
    document.addEventListener("pointerdown", h, true); return () => document.removeEventListener("pointerdown", h, true);
  }, [salvar]);

  // Fechar a aba do Planejamento ou trocar de planejamento com algo ainda não salvo (falha de rede, por exemplo) pede confirmação e oferece salvar.
  const algumSujo = Object.values(ed).some(edSujo);
  const salvarTodos = useCallback(async () => { let ok = true; for (const [id, x] of Object.entries(edRef.current)) if (edSujo(x)) ok = (await salvar(id)) && ok; return ok; }, [salvar]);
  useUnsavedGuard("secao:planejamento", algumSujo, salvarTodos);

  /** Troca de planejamento: salva o que estiver pendente; se não der, pergunta antes de descartar. */
  const trocarPlano = async (id: string) => {
    if (id === boardIdRef.current) return;
    if (!(await salvarTodos()) && !window.confirm("Há alterações que não puderam ser salvas neste planejamento. Trocar mesmo assim e descartá-las?")) return;
    timers.current.forEach(clearTimeout); timers.current.clear();
    setEd({}); setSel([]); setAviso(null); boardIdRef.current = id; setBoardId(id); gravarPlanoSalvo(chave, id);
  };

  // Seleção de seções pelo mouse: clique seleciona; Ctrl/Shift/Cmd+clique soma ou tira; Esc limpa; Delete exclui as selecionadas.
  const clicarSecao = (id: string, e: RMouseEvent) => setSel(s => (e.ctrlKey || e.metaKey || e.shiftKey) ? (s.includes(id) ? s.filter(x => x !== id) : [...s, id]) : (s.length === 1 && s[0] === id ? [] : [id]));

  const excluirSecoesUI = (ids: string[]) => {
    const q = lerQuadro(boardRef.current?.meta); const { cartoes } = excluirSecoes(q, ids);
    const nomes = ids.map(i => q.colunas.flatMap(c => c.secoes).find(s => s.id === i)?.titulo).filter(Boolean).join(", ");
    const pendentes = cartoes.filter(c => edRef.current[c] && edSujo(edRef.current[c])).length;
    if (cartoes.length === 0) { void confirmarExclusaoSecoes(ids); return; }
    setConfirmarSecoes({ ids, mensagem: `Excluir ${ids.length === 1 ? "a seção" : `as ${ids.length} seções`} “${nomes}”${cartoes.length ? ` e ${cartoes.length} cartão(ões) dentro dela(s)` : ""}? Essa ação não pode ser desfeita.${pendentes ? " Alterações não salvas serão perdidas." : ""}` });
  };
  const confirmarExclusaoSecoes = async (ids: string[]) => {
    const { cartoes } = excluirSecoes(lerQuadro(boardRef.current?.meta), ids);
    setConfirmarSecoes(null);
    if (!api) return;
    const apagados: string[] = [];
    for (const c of cartoes) { const r = await api.remove(c); if (r.ok) apagados.push(c); }
    for (const c of apagados) { timers.current.delete(c); publicarExclusao(c, origem); }
    setCenas(cs => { const n = { ...cs }; for (const c of apagados) delete n[c]; return n; });
    setEd(p => { const n = { ...p }; for (const c of apagados) delete n[c]; return n; });
    gravar(x => { let r = x; for (const c of apagados) r = removerCartao(r, c); for (const i of ids) r = excluirSecoesVazia(r, i); return r; });   // só remove a seção se ficou vazia (falha parcial preserva o que não foi apagado)
    setSel(s => s.filter(i => !ids.includes(i)));
    if (apagados.length < cartoes.length) setAviso(`Não foi possível excluir ${cartoes.length - apagados.length} cartão(ões); eles continuam no quadro.`);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.matches("input, textarea, select, [contenteditable=true]") || el.closest(".page-editor"))) return;
      if (e.key === "Escape") setSel([]);
      else if ((e.key === "Delete" || e.key === "Backspace") && sel.length) { e.preventDefault(); void excluirSecoesUI(sel); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // -------- planejamentos: criar, renomear, excluir
  const alternarFixacao = async (b: Registro) => {
    if (!api) return;
    await fila.current;
    const atual = boards.find(x => x.id === b.id) ?? b;
    const permanente = !ehPermanente(atual);
    const r = await api.update(atual.id, versoes.current.get(atual.id) ?? atual.version, { meta: { ...atual.meta, permanente, ordem: Date.now() } });
    if (!r.ok) { setAviso(r.error); return; }
    versoes.current.set(r.data.id, r.data.version);
    setBoards(bs => ordenarPlanos(bs.map(x => x.id === r.data.id ? r.data : x)));
  };
  const moverPlano = async (id: string, direcao: -1 | 1, alvoId?: string) => {
    if (!api) return;
    const atual = boards.find(b => b.id === id); if (!atual) return;
    const grupo = ordenarPlanos(boards.filter(b => ehPermanente(b) === ehPermanente(atual)));
    const i = grupo.findIndex(b => b.id === id), j = alvoId ? grupo.findIndex(b => b.id === alvoId) : i + direcao;
    if (j < 0 || j >= grupo.length) return;
    const vizinho = grupo[j], outro = grupo[j + direcao];
    const referencia = ordemPlano(vizinho);
    const limite = outro ? ordemPlano(outro) : referencia + direcao * 1000;
    const ordem = (referencia + limite) / 2;
    await fila.current;
    const r = await api.update(atual.id, versoes.current.get(atual.id) ?? atual.version, { meta: { ...atual.meta, ordem } });
    if (!r.ok) { setAviso(r.error); return; }
    versoes.current.set(r.data.id, r.data.version);
    setBoards(bs => ordenarPlanos(bs.map(b => b.id === id ? r.data : b)));
  };
  const novoPlano = async () => {
    if (!api || !cid) return;
    if (!(await salvarTodos())) return;
    const existentes = new Set(boards.map(b => b.title.trim().toLocaleLowerCase("pt-BR")));
    let n = 1;
    while (existentes.has(`nova guia ${n}`)) n++;
    const r = await api.create({ kind: "board", campaignId: cid, title: `Nova guia ${n}`, visibility: "private", meta: { ...quadroInicial("Seção 1"), ordem: Date.now() } });
    if (!r.ok) { setAviso(r.error); return; }
    versoes.current.set(r.data.id, r.data.version); setBoards(bs => ordenarPlanos([...bs, r.data])); setEd({}); setSel([]); boardIdRef.current = r.data.id; setBoardId(r.data.id); gravarPlanoSalvo(chave, r.data.id);
  };
  const renomearPlano = async (b: Registro, titulo: string) => {
    const nome = titulo.trim(); if (!api || !nome || nome === b.title) return;
    const bad = validarTitulo(nome); if (bad) { setAviso(bad); return; }
    await fila.current;   // espera gravações do quadro para não conflitar a versão
    const r = await api.update(b.id, versoes.current.get(b.id) ?? b.version, { title: nome });
    if (r.ok) substituirBoard({ ...r.data, meta: boardRef.current?.id === r.data.id ? boardRef.current.meta : r.data.meta }); else setAviso(r.error);
  };
  const solicitarExclusaoPlano = (b: Registro) => {
    const quadro = lerQuadro(b.meta);
    const secoes = quadro.colunas.flatMap(c => c.secoes);
    const cartoes = todosCartoes(quadro);
    if (secoes.length > 0 && cartoes.length > 0) {
      setConfirmarGuia({ id: b.id, mensagem: `Excluir a guia “${b.title}”, suas ${secoes.length} seção(ões) e ${cartoes.length} cartão(ões)? Essa ação não pode ser desfeita.` });
      return;
    }
    void excluirPlano(b);
  };
  const excluirPlano = async (b: Registro) => {
    if (!api) return;
    setConfirmarGuia(null);
    const cartoes = todosCartoes(lerQuadro(b.meta));
    for (const c of cartoes) { const r = await api.remove(c); if (r.ok) publicarExclusao(c, origem); }
    const r = await api.remove(b.id); if (!r.ok) { setAviso(r.error); return; }
    const resto = boards.filter(x => x.id !== b.id);
    setCenas(cs => { const n = { ...cs }; for (const c of cartoes) delete n[c]; return n; }); setEd({}); setSel([]);
    let lista = resto, prox = resto[0];
    if (!prox && cid) {
      const c = await api.create({ kind: "board", campaignId: cid, title: "Nova guia", visibility: "private", meta: quadroInicial("Seção 1") });
      if (c.ok) { prox = c.data; lista = [c.data]; versoes.current.set(c.data.id, c.data.version); } else setAviso(c.error);
    }
    prox = prox ?? resto[0]; setBoards(lista); boardIdRef.current = prox?.id ?? null; setBoardId(prox?.id ?? null); if (prox) gravarPlanoSalvo(chave, prox.id);
  };

  if (!active) return <div className="content"><h1>Anotações</h1><div className="notice" role="status">As anotações pertencem a uma campanha. Escolha uma campanha ativa na barra lateral.</div></div>;
  if (!api) return <div className="content"><h1>Anotações</h1><div className="notice" role="status">Conta necessária para usar Anotações.</div></div>;

  const quadro: Quadro = lerQuadro(board?.meta);
  const novoCartao = async (secaoId: string, titulo: string) => {
    const nome = titulo.trim() || "Novo cartão";   // o nome é opcional: dá para renomear no próprio cartão
    const bad = validarTitulo(nome); if (bad) { setAviso(bad); return false; }
    const r = await api.create({ kind: "scene", campaignId: active.campaign.id, title: nome, visibility: "private" });
    if (!r.ok) { setAviso(r.error); return false; }
    setCenas(c => ({ ...c, [r.data.id]: r.data })); setEd(p => ({ ...p, [r.data.id]: novoEd(r.data, true) })); gravar(q => adicionarCartao(q, secaoId, r.data.id)); return true;
  };
  const excluirCartao = async (id: string) => {
    const r = await api.remove(id); if (!r.ok) { setAviso(r.error); return; }
    removerLocal(id); publicarExclusao(id, origem);
  };
  const soltar = (e: DragEndEvent) => {
    const a = String(e.active.id), o = e.over ? String(e.over.id) : null;
    setArrastando(null);
    if (mobile) return;
    if (a.startsWith("secao:")) gravar(q => soltarSecao(q, a.slice(6), o)); else gravar(q => soltarCartao(q, a, o));
  };

  return <div className="content planejamento" data-testid="planejamento">
    <style>{`@media(max-width:700px){.planejamento .quadro-mobile{display:flex;flex-direction:column;overflow:visible;gap:12px}.planejamento .quadro-mobile .coluna{min-width:0!important;width:100%!important;flex-basis:100%!important;max-width:100%!important}.planejamento .quadro-mobile .coluna-redim{display:none}.planejamento .quadro-mobile .secao{width:100%;max-width:100%}}`}</style>
    {confirmarSecoes && <div className="confirmacao-fundo" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmarSecoes(null); }}>
      <div className="confirmacao-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="confirmacao-titulo" aria-describedby="confirmacao-mensagem">
        <h2 id="confirmacao-titulo">Excluir seção?</h2>
        <p id="confirmacao-mensagem">{confirmarSecoes.mensagem}</p>
        <div className="confirmacao-acoes">
          <button type="button" className="btn" onClick={() => setConfirmarSecoes(null)}>Cancelar</button>
          <button type="button" className="btn danger" onClick={() => void confirmarExclusaoSecoes(confirmarSecoes.ids)}>Excluir seção</button>
        </div>
      </div>
    </div>}
    {confirmarGuia && <div className="confirmacao-fundo" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmarGuia(null); }}>
      <div className="confirmacao-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="confirmacao-guia-titulo" aria-describedby="confirmacao-guia-mensagem">
        <h2 id="confirmacao-guia-titulo">Excluir guia?</h2>
        <p id="confirmacao-guia-mensagem">{confirmarGuia.mensagem}</p>
        <div className="confirmacao-acoes">
          <button type="button" className="btn" onClick={() => setConfirmarGuia(null)}>Cancelar</button>
          <button type="button" className="btn danger" onClick={() => { const b = boards.find(x => x.id === confirmarGuia.id); if (b) void excluirPlano(b); else setConfirmarGuia(null); }}>Excluir guia</button>
        </div>
      </div>
    </div>}
    <div className="eyebrow">{active.campaign.name.toLocaleUpperCase("pt-BR")}</div>
    <h1>Anotações</h1>
    {carregado && boards.length > 0 && <Planos boards={boards} ativo={boardId} onTrocar={id => void trocarPlano(id)} onNovo={() => void novoPlano()} onFixar={b => void alternarFixacao(b)} onMover={(id, d, alvo) => void moverPlano(id, d, alvo)} onRenomear={(b, t) => void renomearPlano(b, t)} onExcluir={solicitarExclusaoPlano} onAbrirEmAba={onOpenContent ? b => onOpenContent({ kind: "secao", ref: `planejamento:${b.id}`, title: `Anotações · ${b.title}` }) : undefined}/>}
    {erro && <div className="notice err" role="alert">{erro} <button className="btn-link" onClick={() => { setErro(null); setCarregado(false); void carregar(); }}>Tentar de novo</button></div>}
    {aviso && <div className="notice err" role="alert">{aviso}</div>}
    {!carregado && <p className="muted" role="status">Carregando anotações…</p>}
    {sel.length > 0 && <div className="selecao-barra" role="toolbar" aria-label="Seções selecionadas"><strong>{sel.length} {sel.length === 1 ? "seção selecionada" : "seções selecionadas"}</strong>
      <button className="btn-secondary danger" onClick={() => void excluirSecoesUI(sel)}><Trash2 size={14} aria-hidden="true"/> Excluir {sel.length === 1 ? "seção" : "seções"}</button>
      <button className="btn-secondary" onClick={() => setSel([])}>Limpar seleção</button></div>}
    {carregado && board && <DndContext sensors={mobile ? [] : sensores} collisionDetection={args => { const hits = pointerWithin(args); return hits.length ? hits : rectIntersection(args).length ? rectIntersection(args) : closestCorners(args); }} onDragStart={e => setArrastando(String(e.active.id))} onDragCancel={() => setArrastando(null)} onDragEnd={soltar}><div className={mobile ? "quadro quadro-mobile" : "quadro"} role="list" aria-label="Colunas do planejamento" onClick={e => { if (e.target === e.currentTarget) setSel([]); }}>
      {quadro.colunas.map(col => <Coluna key={col.id} id={col.id} largura={col.largura ?? LARGURA_PADRAO} mobile={mobile} onLargura={w => gravar(q => redimensionarColuna(q, col.id, w))}>
        <SortableContext items={col.secoes.map(s => `secao:${s.id}`)} strategy={verticalListSortingStrategy}>
          {col.secoes.map(s => <Fragment key={s.id}><SecaoOrdenavel secao={s} selecionada={sel.includes(s.id)} aoClicar={e => clicarSecao(s.id, e)}
            cabecalho={<header className={s.grande ? "secao-topo grande" : "secao-topo"} onClick={e => { if ((e.target as HTMLElement).closest("input, button")) return; clicarSecao(s.id, e); }}>
              {!mobile && <SecaoAlca titulo={s.titulo}/>}
              {s.semTitulo
                ? <button type="button" className="secao-adicionar-titulo" aria-label={`Mostrar título da seção ${s.titulo}`} onClick={() => gravar(q => alternarTituloSecao(q, s.id))}>+ Título</button>
                : <input className="secao-titulo" aria-label={`Nome da seção ${s.titulo}`} defaultValue={s.titulo} maxLength={80} onPointerDown={e => e.stopPropagation()}
                    onFocus={() => setSel([])} onBlur={e => { if (e.target.value.trim() && e.target.value !== s.titulo) gravar(q => renomearSecao(q, s.id, e.target.value)); else e.target.value = s.titulo; }}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}/>}
              <button type="button" className="icon" aria-label={s.semTitulo ? `Exibir título da seção ${s.titulo}` : `Ocultar título da seção ${s.titulo}`} aria-pressed={!!s.semTitulo} title={s.semTitulo ? "Exibir título" : "Ocultar título"} onClick={() => gravar(q => alternarTituloSecao(q, s.id))}><Type size={13}/></button>
              <button type="button" className={s.grande ? "icon ativo" : "icon"} aria-label={`Título grande na seção ${s.titulo}`} aria-pressed={!!s.grande} title="Título grande" onClick={() => gravar(q => alternarTituloGrande(q, s.id))}><Type size={14}/></button>
              <button type="button" className="icon danger excluir-secao-discreto" aria-label={`Excluir seção ${s.titulo}`} title="Excluir seção" onClick={() => void excluirSecoesUI([s.id])}><Trash2 size={14}/></button>
            </header>}>
            <ListaSecao secaoId={s.id} ids={s.cartoes.filter(id => cenas[id])}>{s.cartoes.map(id => {
              const c = cenas[id]; if (!c) return null;
              const x = ed[id], sujo = !!x && edSujo(x), blocos = x?.blocos ?? c.content, spec: TabSpec = { kind: "documento", ref: id, title: c.title };
              const editar = () => mexer(id, y => ({ ...y, editando: true }));
              return <Ordenavel key={id} id={id} mobile={mobile} alca={`Arrastar o cartão ${c.title}`} onContextMenu={e => aoClicarDireito(e, spec)}>
                <CartaoTopo>
                  <div className="cartao-linha">
                    {(x?.titulo ?? c.title) === "Novo cartão"
                      ? <button type="button" className="cartao-adicionar-titulo" aria-label="Adicionar título ao cartão" onClick={() => { mexer(id, y => ({ ...y, titulo: "" })); }}>+ Título</button>
                      : <input className="cartao-titulo" aria-label={`Título do cartão ${c.title}`} value={x?.titulo ?? c.title} maxLength={120}
                          onChange={e => { const v = e.target.value; mexer(id, y => ({ ...y, titulo: v })); agendar(id); }}
                          onBlur={() => { const v = edRef.current[id]; if (v && !v.titulo.trim()) mexer(id, y => ({ ...y, titulo: "Novo cartão" })); void salvar(id); }}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}/>}
                    {(x?.titulo ?? c.title) === "" && <input className="cartao-titulo" aria-label="Novo título do cartão" autoFocus placeholder="Título (opcional)" maxLength={120} value=""
                      onChange={e => { mexer(id, y => ({ ...y, titulo: e.target.value })); agendar(id); }}
                      onBlur={() => { const v = edRef.current[id]; if (v && !v.titulo.trim()) mexer(id, y => ({ ...y, titulo: "Novo cartão" })); void salvar(id); }}
                      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}/>} 
                    <Estado x={x} sujo={sujo} onTentar={() => void salvar(id)}/>
                    <button className="icon" type="button" aria-label={`Mais ações de ${c.title}`} aria-haspopup="menu" onClick={e => abrirMenuEm(e.currentTarget, spec)}><MoreHorizontal size={14}/></button>
                  </div>
                </CartaoTopo>
                <div className="cartao-corpo" data-cartao={id}>
                  {x?.editando
                    ? <EditorLazy key={x.chave} inicial={x.blocos} focar rotulo={`Conteúdo de ${c.title}`} onChange={b => { mexer(id, y => ({ ...y, blocos: b, editou: true })); agendar(id); }}/>
                    : <div className="cartao-conteudo" role="button" tabIndex={0} aria-label={`Editar o texto de ${c.title}`} onClick={editar} onKeyDown={(e: RKeyEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); editar(); } }}>
                      {temConteudo(blocos) ? <ConteudoLeve blocos={blocos}/> : <span className="muted">Clique para escrever…</span>}</div>}
                  {x?.conflito && <ConflitoAviso conflito={x.conflito}
                    onUsarRemoto={() => mexer(id, y => { const r = x.conflito?.registro; return r ? { ...y, base: r, titulo: r.title, blocos: r.content, editou: false, chave: y.chave + 1, conflito: null } : y; })}
                    onManter={() => { mexer(id, y => x.conflito?.registro ? { ...y, base: { ...y.base, version: x.conflito.registro.version }, conflito: null } : { ...y, conflito: null }); agendar(id); }}
                    onFechar={() => mexer(id, y => ({ ...y, conflito: null }))}/>}
                  {x?.erro && <p role="alert" className="notice err">{x.erro} <button className="btn-link" onClick={() => void salvar(id)}>Tentar de novo</button></p>}
                </div>
                <div className="cartao-rodape">
                  <button className="icon danger excluir-cartao-discreto" aria-label={`Excluir cartão ${c.title}`} title="Excluir cartão" onClick={() => void excluirCartao(id)}><Trash2 size={13}/></button>
                </div>
              </Ordenavel>;
            })}</ListaSecao>
            <NovoCartao onCriar={t => novoCartao(s.id, t)}/>
          </SecaoOrdenavel>
          </Fragment>)}
          {col.secoes.length > 0 && <MaisAbaixo secaoId={col.secoes[col.secoes.length - 1].id} titulo={col.secoes[col.secoes.length - 1].titulo} onClick={() => gravar(q => novaSecaoDepois(q, col.secoes[col.secoes.length - 1].id))}/>}
        </SortableContext>
      </Coluna>)}
      {!mobile && <MaisColuna onClick={() => gravar(q => novaColuna(q))}/>}
    </div><DragOverlay>{!mobile && arrastando ? <div className="secao" style={{ padding: 16, minWidth: 200, opacity: 0.95, pointerEvents: "none" }}>{arrastando.startsWith("secao:") ? quadro.colunas.flatMap(c => c.secoes).find(s => s.id === arrastando.slice(6))?.titulo : cenas[arrastando]?.title}</div> : null}</DragOverlay></DndContext>}
    {carregado && board && quadro.colunas.length === 0 && <div className="placeholder"><ClipboardList size={30} aria-hidden="true"/><strong>Nenhuma coluna</strong><span>Use o “+” à direita para criar a primeira coluna.</span></div>}
  </div>;
}

/** Remove a seção só se estiver vazia (usado após apagar os cartões: falha parcial preserva o que não foi apagado). */
function excluirSecoesVazia(q: Quadro, id: string): Quadro {
  const s = q.colunas.flatMap(c => c.secoes).find(x => x.id === id);
  return s && s.cartoes.length === 0 ? excluirSecoes(q, [id]).quadro : q;
}

/** Seletor de planejamentos: anotações permanentes (fixas, primeiro) e um planejamento por sessão. O ativo tem o nome editável. */
function Planos({ boards, ativo, onTrocar, onNovo, onFixar, onMover, onRenomear, onExcluir, onAbrirEmAba }: { boards: Registro[]; ativo: string | null; onTrocar: (id: string) => void; onNovo: () => void; onFixar: (b: Registro) => void; onMover: (id: string, direcao: -1 | 1, alvoId?: string) => void; onRenomear: (b: Registro, t: string) => void; onExcluir: (b: Registro) => void; onAbrirEmAba?: (b: Registro) => void }) {
  const [arrastada, setArrastada] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [listaAberta, setListaAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const toque = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rolagem = useRef<HTMLDivElement | null>(null);
  const fixadasRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { const el = (rolagem.current?.querySelector(`[data-guia-id="${ativo}"]`) ?? fixadasRef.current?.querySelector(`[data-guia-id="${ativo}"]`)) as HTMLElement | null; if (el) { const parent = el.parentElement; if (parent && (parent === rolagem.current || parent === fixadasRef.current)) { if (el.offsetLeft < parent.scrollLeft) parent.scrollTo({ left: el.offsetLeft, behavior: "smooth" }); else if (el.offsetLeft + el.offsetWidth > parent.scrollLeft + parent.clientWidth) parent.scrollTo({ left: el.offsetLeft + el.offsetWidth - parent.clientWidth, behavior: "smooth" }); } } }, [ativo, boards]);
  useEffect(() => { const teclado = (e: KeyboardEvent) => { if (!e.ctrlKey || e.key !== "Tab" || e.altKey || e.metaKey || (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable=true]"))) return; const atual = boards.findIndex(b => b.id === ativo); if (atual < 0 || boards.length < 2) return; e.preventDefault(); onTrocar(boards[(atual + (e.shiftKey ? boards.length - 1 : 1)) % boards.length].id); }; window.addEventListener("keydown", teclado); return () => window.removeEventListener("keydown", teclado); }, [boards, ativo, onTrocar]);
  const limparToque = () => { if (toque.current) clearTimeout(toque.current); toque.current = null; };
  const abrirMenu = (id: string, x: number, y: number) => { setMenu({ id, x: Math.max(8, Math.min(x, window.innerWidth - 200)), y: Math.max(8, Math.min(y, window.innerHeight - 230)) }); setListaAberta(false); };
  const fixadas = boards.filter(ehPermanente), comuns = boards.filter(b => !ehPermanente(b));
  const renderizar = (b: Registro, grupo: Registro[]) => {
    const perm = ehPermanente(b), on = b.id === ativo;
    const i = grupo.findIndex(x => x.id === b.id);
    const editar = renomeando === b.id;
    return <span key={b.id} data-guia-id={b.id} className={`plano ${on ? "ativo " : ""}${perm ? "fixada compacta" : "solta"}`} draggable
      onContextMenu={e => { e.preventDefault(); abrirMenu(b.id, e.clientX, e.clientY); }}
      onTouchStart={e => { limparToque(); const t = e.touches[0]; const x = t.clientX, y = t.clientY; toque.current = setTimeout(() => abrirMenu(b.id, x, y), 550); }}
      onTouchEnd={limparToque} onTouchMove={limparToque} onTouchCancel={limparToque}
      onDragStart={e => { if ((e.target as HTMLElement).closest("input,button")) { e.preventDefault(); return; } setArrastada(b.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={e => { if (arrastada && arrastada !== b.id && grupo.some(x => x.id === arrastada)) e.preventDefault(); }}
      onDrop={e => { e.preventDefault(); const de = grupo.findIndex(x => x.id === arrastada); if (de >= 0 && de !== i) onMover(arrastada!, de < i ? 1 : -1, b.id); setArrastada(null); }}
      onDragEnd={() => setArrastada(null)}>
      {editar ? <input aria-label="Renomear guia" autoFocus defaultValue={b.title} maxLength={60} onBlur={e => { if (e.target.value.trim() && e.target.value !== b.title) onRenomear(b, e.target.value); setRenomeando(null); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { e.currentTarget.value = b.title; e.currentTarget.blur(); } }}/>
        : <button type="button" className="plano-selecionar" aria-label={b.title} title={b.title} aria-pressed={on} onClick={() => { setMenu(null); onTrocar(b.id); }} onDoubleClick={e => { e.preventDefault(); setMenu(null); setRenomeando(b.id); }}>{perm ? <><Pin size={13} fill="currentColor" aria-hidden="true"/><span className="plano-fixada-titulo">{b.title}</span></> : b.title}</button>}
      {on && boards.length > 1 && <button type="button" className="plano-fechar" aria-label={`Excluir guia ${b.title}`} title="Excluir guia" onClick={() => { setMenu(null); onExcluir(b); }}>×</button>}
    </span>;
  };
  return <nav className="planos" aria-label="Planejamentos">
    <div className="planos-fixados" ref={fixadasRef} aria-label="Guias fixadas">{fixadas.map(b => renderizar(b, fixadas))}</div>
    <div className="planos-rolagem" ref={rolagem} aria-label="Outras guias">{comuns.map(b => renderizar(b, comuns))}<button type="button" className="plano mais" aria-label="Nova guia" title="Criar guia" onClick={onNovo}><Plus size={14}/></button></div>
    <div className="planos-lista-wrapper">
      <button type="button" className="plano mais" aria-label="Listar guias" title="Todas as guias" aria-expanded={listaAberta} onClick={() => { setListaAberta(v => !v); setMenu(null); }}><MoreHorizontal size={16}/></button>
      {listaAberta && <div className="planos-lista">
        <input aria-label="Pesquisar guias" placeholder="Pesquisar guias" value={busca} onChange={e => setBusca(e.target.value)}/>
        <div className="planos-lista-itens">{boards.filter(b => b.title.toLocaleLowerCase().includes(busca.toLocaleLowerCase())).map(b => <button type="button" key={b.id} onClick={() => { onTrocar(b.id); setListaAberta(false); setBusca(""); }}>{ehPermanente(b) && <Pin size={13} aria-hidden="true"/>}{b.title}</button>)}</div>
      </div>}
    </div>
    {menu && (() => {
      const b = boards.find(x => x.id === menu.id);
      if (!b) return null;
      const grupo = ehPermanente(b) ? fixadas : comuns;
      const i = grupo.findIndex(x => x.id === b.id);
      return <div className="plano-contexto" style={{ left: menu.x, top: menu.y }} role="menu" aria-label={`Opções de ${b.title}`}>
        {onAbrirEmAba && <button type="button" role="menuitem" onClick={() => { onAbrirEmAba(b); setMenu(null); }}>Abrir em nova aba</button>}
        <button type="button" role="menuitem" onClick={() => { onFixar(b); setMenu(null); }}>{ehPermanente(b) ? "Desafixar" : "Fixar"}</button>
        <button type="button" role="menuitem" onClick={() => { setRenomeando(b.id); setMenu(null); }}>Renomear</button>
        <button type="button" role="menuitem" disabled={i <= 0} onClick={() => { onMover(b.id, -1); setMenu(null); }}>Mover para esquerda</button>
        <button type="button" role="menuitem" disabled={i >= grupo.length - 1} onClick={() => { onMover(b.id, 1); setMenu(null); }}>Mover para direita</button>
        <button type="button" role="menuitem" disabled={boards.length <= 1} onClick={() => { onExcluir(b); setMenu(null); }}>Excluir</button>
      </div>;
    })()}
    {menu && <button type="button" className="planos-fechar-menu" aria-label="Fechar opções de guia" onClick={() => setMenu(null)}/>}
  </nav>;
}

/** Estado discreto do salvamento automático: nada quando salvo; "●" pendente; "salvando…"; falha com tentar de novo. */
function Estado({ x, sujo, onTentar }: { x?: Ed; sujo: boolean; onTentar: () => void }) {
  if (!x) return null;
  if (x.erro && sujo) return <button type="button" className="estado estado-erro" onClick={onTentar} title={x.erro}>não salvou</button>;
  if (x.salvando) return <span className="estado" role="status">salvando…</span>;
  if (sujo) return <span className="estado sujo" title="Alterações ainda não salvas (salvam sozinhas)" aria-label="alterações não salvas">●</span>;
  return null;
}

function NovoCartao({ onCriar }: { onCriar: (t: string) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  return <button type="button" className="mais mais-cartao" aria-label="Adicionar cartão" disabled={busy} onClick={async () => { if (busy) return; setBusy(true); try { await onCriar(""); } finally { setBusy(false); } }}>
    <Plus size={16} aria-hidden="true"/><span>Novo cartão</span>
  </button>;
}

/** "+" tracejado e transparente: clicar cria uma coluna nova (sem pedir nome); soltar um cartão ou seção aqui cria a coluna já com ele. */
function MaisColuna({ onClick }: { onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "nova-coluna" });
  return <button ref={setNodeRef} type="button" className={isOver ? "mais mais-coluna sobre" : "mais mais-coluna"} aria-label="Adicionar coluna" title="Adicionar coluna (ou arraste um cartão até aqui)" onClick={onClick}><Plus size={16} aria-hidden="true"/><span>Nova coluna</span></button>;
}
/** "+" tracejado embaixo de cada seção: clicar cria a próxima seção; soltar um cartão aqui cria a seção já com ele. */
function MaisAbaixo({ secaoId, titulo, onClick }: { secaoId: string; titulo: string; onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `abaixo:${secaoId}` });
  return <button ref={setNodeRef} type="button" className={isOver ? "mais mais-abaixo sobre" : "mais mais-abaixo"} aria-label={`Adicionar seção abaixo de ${titulo}`} title="Adicionar seção abaixo (ou arraste um cartão até aqui)" onClick={onClick}><Plus size={16} aria-hidden="true"/><span>Nova seção</span></button>;
}

/** Lista de cartões de uma seção: zona de soltura (inclusive seção vazia) e contexto de ordenação. */
function ListaSecao({ secaoId, ids, children }: { secaoId: string; ids: string[]; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `sec:${secaoId}` });
  return <SortableContext items={ids} strategy={verticalListSortingStrategy}><ul ref={setNodeRef} className={isOver ? "cartoes sobre" : "cartoes"}>{children}</ul></SortableContext>;
}

const SecaoCtx = createContext<{ attributes: Record<string, unknown>; listeners: Record<string, unknown> }>({ attributes: {}, listeners: {} });
/** Seção arrastável (pela alça do cabeçalho) e selecionável (clique no cabeçalho). */
function SecaoOrdenavel({ secao, selecionada, aoClicar, cabecalho, children }: { secao: Secao; selecionada: boolean; aoClicar: (e: RMouseEvent) => void; cabecalho: ReactNode; children: ReactNode }) {
  const s = useSortable({ id: `secao:${secao.id}` });
  return <SecaoCtx.Provider value={{ attributes: s.attributes as unknown as Record<string, unknown>, listeners: (s.listeners ?? {}) as Record<string, unknown> }}>
    <section ref={s.setNodeRef} className={"secao" + (selecionada ? " selecionada" : "") + (s.isDragging ? " arrastando" : "")} aria-label={`Seção ${secao.titulo}`} data-selecionada={selecionada} data-secao={secao.id} onClick={e => { if (e.target === e.currentTarget) aoClicar(e); }}   // clicar no fundo da seção (entre os cartões) também seleciona
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition }}>{cabecalho}{children}</section></SecaoCtx.Provider>;
}
function SecaoAlca({ titulo }: { titulo: string }) {
  const c = useContext(SecaoCtx);
  return <button type="button" className="alca-coluna" aria-label={`Arrastar a seção ${titulo}`} {...c.attributes} {...c.listeners}><GripVertical size={14}/></button>;
}

const CartaoCtx = createContext<Record<string, unknown>>({});
/** Cabeçalho do cartão: arrastar (movimento > 6px) move o cartão. A alça continua para teclado e acessibilidade. */
function CartaoTopo({ children }: { children: ReactNode }) {
  const l = useContext(CartaoCtx);
  return <div className="cartao-topo arrastavel" {...l}>{children}</div>;
}
function Ordenavel({ id, alca, mobile, onContextMenu, children }: { id: string; alca: string; mobile: boolean; onContextMenu: (e: RMouseEvent) => void; children: ReactNode }) {
  const s = useSortable({ id });
  return <CartaoCtx.Provider value={(s.listeners ?? {}) as Record<string, unknown>}><li ref={s.setNodeRef} className={s.isDragging ? "cartao arrastando" : "cartao"} style={{ transform: CSS.Transform.toString(s.transform), transition: s.transition }} onContextMenu={onContextMenu}>
    {!mobile && <button type="button" className="alca" aria-label={alca} {...s.attributes} {...s.listeners}><GripVertical size={14}/></button>}{children}</li></CartaoCtx.Provider>;
}

/** Coluna: faixa vertical com largura própria (borda direita arrastável), que empilha as seções. */
function Coluna({ id, largura, mobile, onLargura, children }: { id: string; largura: number; mobile: boolean; onLargura: (w: number) => void; children: ReactNode }) {
  const [vivo, setVivo] = useState<number | null>(null);   // largura durante o arraste; só vira dado ao soltar
  const ref = useRef<{ x: number; w: number } | null>(null);
  const w = vivo ?? largura;
  const comecar = (e: RPointerEvent) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); ref.current = { x: e.clientX, w: largura }; setVivo(largura); };
  const mover = (e: RPointerEvent) => { if (ref.current) setVivo(limitarLargura(ref.current.w + e.clientX - ref.current.x)); };
  const soltar = (e: RPointerEvent) => { if (!ref.current) return; const nova = limitarLargura(ref.current.w + e.clientX - ref.current.x); ref.current = null; setVivo(null); if (nova !== largura) onLargura(nova); };
  const teclas = (e: RKeyEvent) => { const d = e.key === "ArrowRight" ? 20 : e.key === "ArrowLeft" ? -20 : 0; if (d) { e.preventDefault(); onLargura(limitarLargura(largura + d)); } };
  return <div className={"coluna" + (vivo !== null ? " redimensionando" : "")} role="listitem" data-coluna={id} style={mobile ? { flexBasis: "100%", width: "100%", maxWidth: "100%" } : { flexBasis: w, width: w }}>{children}
    {!mobile && <div className="coluna-redim" role="separator" aria-orientation="vertical" aria-label="Redimensionar a coluna" aria-valuemin={LARGURA_MIN} aria-valuemax={LARGURA_MAX} aria-valuenow={w} tabIndex={0}
      onPointerDown={comecar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} onKeyDown={teclas} title="Arraste para ajustar a largura da coluna"/>}
  </div>;
}
