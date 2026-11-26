// Ficha de jogo (D&D 5e 2014): cabeçalho compartilhado e exatamente três abas (Ficha, Habilidades, Inventário), iguais no computador e no
// celular. Os cálculos vêm do motor `regras-2014`; o que muda durante o jogo é guardado no próprio rascunho (`estadoJogo`). A aba, a
// rolagem de cada aba e a exibição do inventário são lembradas nesta sessão do navegador, por personagem.
import './ficha.css';
import { Minus, MoreHorizontal, Pencil, Plus, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { class2014, label2014, raceTraits2014, selected2014, sheet2014, statistics2014 } from "../criador/regras-2014";
import { retratoValido } from "../fichas";
import { RetratoQuadrado } from "../RetratoCombate";
import { CONDICOES_5E, CONDICOES_TEXTO } from "../rules/condicoes-5e";
import type { CharacterDraft } from "../rules/character-domain";
import { useFecharMenu } from "../useFecharMenu";
import type { TabSpec } from "../workspace";
import { AbaFicha } from "./AbaFicha";
import { AbaHabilidades } from "./AbaHabilidades";
import { AbaInventario, type FiltroInv, type VistaInv } from "./AbaInventario";
import { causarDano, comEstado, curar, defesasDerivadas, definirTemporarios, descansoCurto, descansoLongo, lerEstadoJogo, ROTULO_DEFESA, somaTemporaria, type AlvoMod } from "./estadoJogo";
import { metros, sinal } from "./tipos";
import type { ChaveMoeda } from "../moedas/moedas";

export type AbaId = "ficha" | "habilidades" | "inventario";
const ABAS: [AbaId, string][] = [["ficha", "Ficha"], ["habilidades", "Habilidades"], ["inventario", "Inventário"]];
type Memoria = { aba: AbaId; rolagem: Partial<Record<AbaId, number>>; vista: VistaInv; filtro: FiltroInv };
const PADRAO: Memoria = { aba: "ficha", rolagem: {}, vista: "lista", filtro: "todos" };
const lerMemoria = (chave: string): Memoria => {
  try { const m = JSON.parse(sessionStorage.getItem(chave) ?? "null") as Partial<Memoria> | null; return m && ABAS.some(([a]) => a === m.aba) ? { ...PADRAO, ...m, rolagem: { ...m.rolagem } } : { ...PADRAO, rolagem: {} }; }
  catch { return { ...PADRAO, rolagem: {} }; }
};
/** Quem rola a ficha: o primeiro ancestral (ou ela mesma) com rolagem própria; senão, o documento. */
function quemRola(el: HTMLElement): Element {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if (o === "auto" || o === "scroll") return n; }
  return document.scrollingElement ?? document.documentElement;
}
/** Margem das bordas reservada ao gesto de voltar do celular. */
const BORDA = 28;
/** O toque começou num controle, ou numa área com rolagem lateral própria: não é gesto de troca de aba. */
function toqueEmControle(alvo: EventTarget | null, limite: Element) {
  if (!(alvo instanceof Element)) return true;
  if (alvo.closest("input,textarea,select,button,a,summary,label,[contenteditable],[role=menu],.sem-gesto")) return true;
  for (let n: Element | null = alvo; n && n !== limite; n = n.parentElement) if (n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true;
  return false;
}
/** Para qual aba um arrasto leva (ou `null` se não for um gesto horizontal claro). Sem volta ao início: as pontas param. */
export function abaDoGesto(atual: AbaId, dx: number, dy: number): AbaId | null {
  if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.6) return null;
  const i = ABAS.findIndex(([a]) => a === atual) + (dx < 0 ? 1 : -1);
  return ABAS[i]?.[0] ?? null;
}

export type FichaJogoProps = {
  draft: CharacterDraft; campanha: string;
  /** Identifica usuário, campanha e personagem (memória de aba e rolagem). */
  memoria: string;
  onChange: (d: CharacterDraft) => void; onOpenContent: (s: TabSpec) => void;
  onEditar: () => void; onProgredir: () => void;
  /** Moedas em uso na campanha. */
  moedas?: readonly ChaveMoeda[];
  /** O mestre pode entregar talentos, magias e habilidades. */
  podeConceder?: boolean;
  /** Estado do salvamento, avisos (conflito, recuperação) e estado em combate informado pelo mestre. */
  salvamento?: ReactNode; avisos?: ReactNode; combate?: ReactNode;
};

export default function FichaJogo({ draft, campanha, memoria, onChange, onOpenContent, onEditar, onProgredir, salvamento, avisos, combate, podeConceder, moedas }: FichaJogoProps) {
  const sheet = useMemo(() => sheet2014({ ...draft, name: draft.name.trim() || "Sem nome" }), [draft]);
  const base = useMemo(() => statistics2014({ ...draft, name: draft.name.trim() || "Sem nome" }), [draft]);
  const estado = lerEstadoJogo(draft);
  const chave = `compendio5e:ficha:${memoria}`;
  const [mem, setMem] = useState<Memoria>(() => lerMemoria(chave));
  const guardada = useRef(mem);
  const guardar = useCallback((m: Memoria) => { guardada.current = m; try { sessionStorage.setItem(chave, JSON.stringify(m)); } catch { /* sem armazenamento: só não lembra */ } }, [chave]);
  const mudarMemoria = (patch: Partial<Memoria>) => { const m = { ...guardada.current, ...patch }; guardar(m); setMem(m); };
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = raiz.current; if (!el) return;
    const rola = quemRola(el), alvo: EventTarget = rola === document.scrollingElement ? window : rola;
    // elemento oculto (outra aba do espaço de trabalho) informa rolagem zero: não sobrescreve a posição lembrada
    const aoRolar = () => { if (el.getClientRects().length) guardar({ ...guardada.current, rolagem: { ...guardada.current.rolagem, [guardada.current.aba]: rola.scrollTop } }); };
    alvo.addEventListener("scroll", aoRolar, { passive: true });
    return () => alvo.removeEventListener("scroll", aoRolar);
  }, [guardar]);
  // restaura a posição da aba ao montar (volta de outro menu) e ao trocar de aba
  useLayoutEffect(() => {
    const el = raiz.current; if (!el) return;
    const y = guardada.current.rolagem[mem.aba];
    if (y !== undefined) quemRola(el).scrollTop = y;
  }, [mem.aba]);

  const trocarAba = (aba: AbaId) => {
    if (aba === mem.aba) return;
    const el = raiz.current, atual = el ? quemRola(el).scrollTop : 0;
    // aba ainda não visitada: mantém o cabeçalho onde está, sem pular para o meio do conteúdo
    const abas = el?.querySelector<HTMLElement>(".ficha-subnav");
    mudarMemoria({ aba, rolagem: { ...guardada.current.rolagem, [mem.aba]: atual, [aba]: guardada.current.rolagem[aba] ?? Math.min(atual, abas?.offsetTop ?? 0) } });
  };

  const toque = useRef<{ x: number; y: number } | null>(null);
  const gesto = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      toque.current = e.touches.length !== 1 || t.clientX < BORDA || t.clientX > window.innerWidth - BORDA || toqueEmControle(e.target, e.currentTarget) ? null : { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const inicio = toque.current; toque.current = null;
      if (!inicio || window.matchMedia?.("(min-width:701px)").matches) return;
      const t = e.changedTouches[0], aba = abaDoGesto(mem.aba, t.clientX - inicio.x, t.clientY - inicio.y);
      if (aba) trocarAba(aba);
    },
    onTouchCancel: () => { toque.current = null; },
  };

  const temp = (a: AlvoMod) => somaTemporaria(estado, a);
  // os modificadores temporários entram só no que é exibido; a construção do personagem não muda
  const stats = base;
  const raca = label2014(draft.raceId), subclasse = selected2014(draft, "subclass")[0];
  const defesas = [...defesasDerivadas(draft, raceTraits2014(draft), selected2014(draft, "dragon-ancestry")[0]), ...estado.defesas];
  const numero = (rotulo: string, valor: string, alvo?: AlvoMod) => <div className="ficha-numero"><span>{rotulo}</span><strong>{valor}</strong>{alvo && temp(alvo) !== 0 && <small className="ficha-temp">{sinal(temp(alvo))} temp.</small>}</div>;
  const propsAba = { draft, sheet, stats, estado, onChange, onOpenContent };

  return <div ref={raiz} className="content ficha auth wide ficha-jogo" data-testid="ficha-guiada-leitura" {...gesto}>
    <div className="eyebrow">{campanha.toLocaleUpperCase("pt-BR")} · FICHA DE PERSONAGEM · SRD 2014</div>
    <section className="ficha-cabecalho" aria-label="Resumo do personagem">
      <div className="ficha-identidade">
        <RetratoQuadrado tipo="personagem" tamanho={72} src={retratoValido(draft.portrait) ? draft.portrait : null}/>
        <div className="ficha-nomes"><h1>{draft.name.trim() || "Personagem sem nome"}</h1>
          {draft.nickname?.trim() && <p className="identidade-alcunha"><em>{draft.nickname.trim()}</em></p>}
          <p className="muted">{[raca, label2014(draft.classId) + (subclasse ? ` (${label2014(subclasse)})` : ""), `Nível ${draft.level}`, label2014(draft.backgroundId)].join(" · ")}</p></div>
        <div className="ficha-acoes"><button type="button" className="btn-secondary ficha-botao" aria-label="Editar personagem" onClick={onEditar}><Pencil size={14} aria-hidden="true"/> Editar<span className="ficha-so-largo"> personagem</span></button>
          <MenuAcoes draft={draft} maximo={sheet.maxHp} onChange={onChange} onProgredir={onProgredir}/></div>
      </div>
      <Vida draft={draft} maximo={sheet.maxHp} onChange={onChange}/>
      <div className="ficha-numeros">
        {numero("CA", String(stats.ac + temp("ac")), "ac")}
        {numero("Iniciativa", sinal(stats.initiative + temp("initiative")), "initiative")}
        {numero("Deslocamento", metros(Math.max(0, stats.speed + temp("speed"))), "speed")}
        {numero("Percepção passiva", String(stats.passivePerception + temp("passivePerception")), "passivePerception")}
        {numero("Proficiência", sinal(stats.prof))}
      </div>
      <Condicoes draft={draft} onChange={onChange}/>
      {defesas.length > 0 && <p className="ficha-defesas">{(Object.keys(ROTULO_DEFESA) as (keyof typeof ROTULO_DEFESA)[]).flatMap(tipo => { const l = defesas.filter(d => d.tipo === tipo).map(d => d.texto); return l.length ? [<span key={tipo}><strong>{ROTULO_DEFESA[tipo]}:</strong> {[...new Set(l)].join(", ")}</span>] : []; })}</p>}
    </section>
    {salvamento}
    {avisos}
    {combate}
    {sheet.pending.length > 0 && <p className="notice" role="note">Ficha com escolhas pendentes. Use Editar personagem para concluir.</p>}
    <nav className="ficha-subnav" aria-label="Seções da ficha">{ABAS.map(([id, rotulo]) => <button key={id} type="button" className={mem.aba === id ? "active" : ""} aria-current={mem.aba === id ? "true" : undefined} onClick={() => trocarAba(id)}>{rotulo}</button>)}</nav>
    <div className="ficha-conteudo" data-aba={mem.aba}>
      {mem.aba === "ficha" && <AbaFicha {...propsAba}/>}
      {mem.aba === "habilidades" && <AbaHabilidades {...propsAba} podeConceder={podeConceder}/>}
      {mem.aba === "inventario" && <AbaInventario {...propsAba} moedas={moedas} mestre={podeConceder} vista={mem.vista} onVista={vista => mudarMemoria({ vista })} filtro={mem.filtro} onFiltro={filtro => mudarMemoria({ filtro })}/>}
    </div>
    <p className="muted ficha-dado">Dado de vida d{class2014(draft).data.hitDie} · cálculos das regras SRD 5.1 (2014).</p>
  </div>;
}

function Vida({ draft, maximo, onChange }: { draft: CharacterDraft; maximo: number; onChange: (d: CharacterDraft) => void }) {
  const [valor, setValor] = useState("1");
  const n = Number(valor), inteiro = valor.trim() !== "" && Number.isSafeInteger(n) && n >= 0 && n <= 999, valido = inteiro && n > 0;
  const aplicar = (f: () => CharacterDraft) => { onChange(f()); setValor("1"); };
  return <div className="ficha-vida">
    <div className="ficha-vida-total"><span>PV</span><strong data-testid="ficha-pv">{draft.currentHp} / {maximo}</strong>{draft.temporaryHp > 0 && <small className="ficha-pv-temp" data-testid="ficha-pv-temp">+{draft.temporaryHp} temporários</small>}{draft.currentHp === 0 && <small className="ficha-caido">caído</small>}</div>
    <div className="ficha-barra" role="meter" aria-label="Pontos de vida" aria-valuemin={0} aria-valuemax={maximo} aria-valuenow={Math.min(draft.currentHp, maximo)}><span style={{ width: `${Math.min(100, maximo ? (draft.currentHp / maximo) * 100 : 0)}%` }} className={draft.currentHp <= maximo / 4 ? "excesso" : ""}/></div>
    <form className="ficha-vida-ajuste" onSubmit={e => e.preventDefault()}>
      <button type="button" className="ficha-passo dano" disabled={!valido} aria-label="Aplicar dano" title="Aplicar dano" onClick={() => aplicar(() => causarDano(draft, n))}><Minus size={16} aria-hidden="true"/></button>
      <input type="number" inputMode="numeric" min={0} max={999} aria-label="Quantidade de pontos de vida" value={valor} onFocus={e => e.target.select()} onChange={e => setValor(e.target.value)} onBlur={() => { if (!inteiro) setValor("1"); }}/>
      <button type="button" className="ficha-passo cura" disabled={!valido} aria-label="Curar" title="Curar (até o máximo)" onClick={() => aplicar(() => curar(draft, maximo, n))}><Plus size={16} aria-hidden="true"/></button>
      <button type="button" className="ficha-temp-botao" disabled={!inteiro} aria-label="Definir PV temporários" title="Define os PV temporários com a quantidade digitada (não se acumulam; 0 remove)" onClick={() => aplicar(() => definirTemporarios(draft, n))}>Temp.</button>
    </form>
  </div>;
}

/** Condições ativas como indicadores compactos: o nome mostra o efeito; o "+" abre a lista para adicionar. */
function Condicoes({ draft, onChange }: { draft: CharacterDraft; onChange: (d: CharacterDraft) => void }) {
  const ativas = lerEstadoJogo(draft).condicoes;
  const [aberto, setAberto] = useState(false), [vendo, setVendo] = useState<string | null>(null);
  const menu = useRef<HTMLDivElement>(null), gatilho = useRef<HTMLButtonElement>(null);
  useFecharMenu(aberto, menu, gatilho, () => setAberto(false));
  const disponiveis = CONDICOES_5E.filter(c => !ativas.includes(c));
  return <div className="ficha-condicoes" role="group" aria-label="Condições">
    <span className="ficha-condicoes-rotulo">Condições</span>
    {ativas.map(c => <span key={c} className="ficha-chip ativa"><button type="button" className="ficha-chip-nome" aria-expanded={vendo === c} onClick={() => setVendo(v => (v === c ? null : c))}>{c}</button>
      <button type="button" aria-label={`Remover condição ${c}`} onClick={() => { onChange(comEstado(draft, { condicoes: ativas.filter(x => x !== c) })); setVendo(null); }}><X size={12} aria-hidden="true"/></button></span>)}
    {ativas.length === 0 && <span className="muted">nenhuma</span>}
    <span className="ficha-menu">
      <button ref={gatilho} type="button" className="ficha-mais" aria-label="Adicionar condição" aria-haspopup="true" aria-expanded={aberto} disabled={disponiveis.length === 0} onClick={() => setAberto(a => !a)}><Plus size={14} aria-hidden="true"/></button>
      {aberto && <div ref={menu} className="barra-menu ficha-menu-lista ficha-lista-condicoes" role="group" aria-label="Escolher condição">
        {disponiveis.map(c => <button key={c} type="button" className="barra-item" title={CONDICOES_TEXTO[c]} onClick={() => { onChange(comEstado(draft, { condicoes: [...ativas, c] })); setAberto(false); }}>{c}</button>)}
      </div>}
    </span>
    {vendo && ativas.includes(vendo) && <p className="ficha-efeito" role="note"><strong>{vendo}:</strong> {CONDICOES_TEXTO[vendo] ?? "Sem descrição cadastrada."}</p>}
  </div>;
}

function MenuAcoes({ draft, maximo, onChange, onProgredir }: { draft: CharacterDraft; maximo: number; onChange: (d: CharacterDraft) => void; onProgredir: () => void }) {
  const [aberto, setAberto] = useState(false), [confirmar, setConfirmar] = useState<"curto" | "longo" | null>(null), [aviso, setAviso] = useState("");
  const menu = useRef<HTMLDivElement>(null), gatilho = useRef<HTMLButtonElement>(null);
  useFecharMenu(aberto, menu, gatilho, () => { setAberto(false); setConfirmar(null); });
  const fechar = () => { setAberto(false); setConfirmar(null); };
  const descansar = () => {
    if (confirmar === "curto") { onChange(descansoCurto(draft)); setAviso("Descanso curto registrado. Para recuperar PV, use dados de vida, role o dado e informe a cura."); }
    else { const r = descansoLongo(draft, maximo); if (r.ok) { onChange(r.draft); setAviso("Descanso longo registrado."); } else setAviso(r.motivo); }
    fechar();
  };
  return <div className="ficha-menu">
    <button ref={gatilho} type="button" className="btn-secondary ficha-botao" aria-haspopup="true" aria-expanded={aberto} aria-label="Ações" title="Descansos, progressão e outras ações" onClick={() => { if (aberto) fechar(); else { setAberto(true); setAviso(""); } }}><MoreHorizontal size={16} aria-hidden="true"/></button>
    {aberto && <div ref={menu} className="barra-menu ficha-menu-lista" role="group" aria-label="Ações do personagem">
      {confirmar ? <>
        <p>{confirmar === "curto" ? "Registrar descanso curto?" : "Registrar descanso longo? Os PV e os recursos serão recuperados."}</p>
        <button type="button" className="btn-primary" onClick={descansar}>Confirmar descanso</button>
        <button type="button" className="btn-secondary" onClick={() => setConfirmar(null)}>Cancelar</button>
      </> : <>
        <button type="button" className="barra-item" onClick={() => { fechar(); onProgredir(); }}>Progressão de nível</button>
        <button type="button" className="barra-item" onClick={() => setConfirmar("curto")}>Descanso curto</button>
        <button type="button" className="barra-item" onClick={() => setConfirmar("longo")}>Descanso longo</button>
      </>}
    </div>}
    {aviso && <p role="status" className="ficha-menu-aviso">{aviso}</p>}
  </div>;
}
