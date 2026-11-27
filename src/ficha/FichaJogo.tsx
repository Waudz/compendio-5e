// Ficha de jogo (D&D 5e 2014): cabeçalho compartilhado e exatamente três abas (Ficha, Habilidades, Inventário), iguais no computador e no
// celular. Os cálculos vêm do motor `regras-2014`; o que muda durante o jogo é guardado no próprio rascunho (`estadoJogo`). A aba, a
// rolagem de cada aba e a exibição do inventário são lembradas nesta sessão do navegador, por personagem.
import {useCiclo} from "../CicloPersonagens";
import './ficha.css';
import { ChevronsUp, Coffee, Droplet, Flame, Image as ImageIcon, Minus, Moon, MoreHorizontal, Pencil, Plus, Shield, Skull, Snowflake, X, Zap, type LucideIcon } from "lucide-react";
import { Indicador, IndicadorPV } from "../dnd/elementos";
import { CampoRetrato } from "../criador/CampoRetrato";
import { Modal } from "../ui/Modal";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { label2014, raceTraits2014, selected2014, sheet2014, statistics2014 } from "../criador/regras-2014";
import { origem2014 } from "../criador/origens-2014";
import { retratoValido } from "../fichas";
import { RetratoQuadrado } from "../RetratoCombate";
import { CONDICOES_5E, CONDICOES_TEXTO } from "../rules/condicoes-5e";
import type { CharacterDraft } from "../rules/character-domain";
import { useFecharMenu } from "../useFecharMenu";
import type { TabSpec } from "../workspace";
import { AbaFicha } from "./AbaFicha";
import { AbaHabilidades, type FiltroHab } from "./AbaHabilidades";
import { abaVizinha, useGestoAbas } from "./gestoAbas";
import { useVersaoCatalogo } from "../catalogue/campanha";
import { AbaInventario, type FiltroInv, type VistaInv } from "./AbaInventario";
import { defesasDerivadas, descansoCurto, descansoLongo, lerEstadoJogo, ROTULO_DEFESA, somaTemporaria, type AlvoMod } from "./estadoJogo";
import type { AcaoVital } from "../vitais/vitais";
import { metros, sinal } from "./tipos";
import type { ChaveMoeda } from "../moedas/moedas";

export type AbaId = "ficha" | "habilidades" | "inventario" | "identidade";
const ABAS: [AbaId, string][] = [["ficha", "Ficha"], ["habilidades", "Habilidades"], ["inventario", "Inventário"], ["identidade", "Identidade"]];
type Memoria = { aba: AbaId; rolagem: Partial<Record<AbaId, number>>; vista: VistaInv; filtro: FiltroInv; filtroHab: FiltroHab };
const PADRAO: Memoria = { aba: "ficha", rolagem: {}, vista: "lista", filtro: "todos", filtroHab: "todas" };
const lerMemoria = (chave: string): Memoria => {
  try { const m = JSON.parse(sessionStorage.getItem(chave) ?? "null") as Partial<Memoria> | null; return m && ABAS.some(([a]) => a === m.aba) ? { ...PADRAO, ...m, rolagem: { ...m.rolagem } } : { ...PADRAO, rolagem: {} }; }
  catch { return { ...PADRAO, rolagem: {} }; }
};
/** Quem rola a ficha: o primeiro ancestral (ou ela mesma) com rolagem própria; senão, o documento. */
function quemRola(el: HTMLElement): Element {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if (o === "auto" || o === "scroll") return n; }
  return document.scrollingElement ?? document.documentElement;
}
/** Para qual aba um arrasto leva (ou `null` se não for um gesto horizontal claro). */
export function abaDoGesto(atual: AbaId, dx: number, dy: number): AbaId | null {
  return abaVizinha(ABAS.map(([id]) => id), atual, dx, dy);
}

export type FichaJogoProps = {
  draft: CharacterDraft; campanha: string;
  /** Identifica usuário, campanha e personagem (memória de aba e rolagem). */
  memoria: string;
  onChange: (d: CharacterDraft) => void; onOpenContent: (s: TabSpec) => void;
  onEditar: () => void; onProgredir: () => void;
  /** Moedas em uso na campanha (`null` enquanto carregam). */
  moedas?: readonly ChaveMoeda[] | null;
  /** O mestre pode entregar talentos, magias e habilidades. */
  podeConceder?: boolean;
  /** Estado do salvamento e avisos (conflito, recuperação, sincronização). */
  salvamento?: ReactNode; avisos?: ReactNode;
  /** Conteúdo da aba Identidade (a projeção pública do mesmo personagem). */
  identidade?: ReactNode;
  /** PV, temporários, condições e salvaguardas contra a morte: operações aplicadas na fonte única. */
  vital: (acao: AcaoVital) => void;
  /** Usa uma unidade de um item, com a cura informada. Devolve a mensagem de erro, ou `null`. */
  usarItem: (instancia: string, cura: number) => Promise<string | null>;
  /** Transfere unidades a outro personagem da campanha. Ausente quando não há ficha no servidor. */
  transferir?: (destino: string, instancia: string, quantidade: number) => Promise<string | null>;
  /** Identificador deste personagem (para não se oferecer como destino). */
  personagemId?: string; campaignId?: string;
};

export default function FichaJogo({ draft, campanha, memoria, onChange, onOpenContent, onEditar, onProgredir, salvamento, avisos, vital, usarItem, transferir, personagemId, campaignId, podeConceder, moedas, identidade }: FichaJogoProps) {
  const ciclo=useCiclo();
  const catalogo = useVersaoCatalogo();
  const sheet = useMemo(() => sheet2014({ ...draft, name: draft.name.trim() || "Sem nome" }), [draft, catalogo]);
  const base = useMemo(() => statistics2014({ ...draft, name: draft.name.trim() || "Sem nome" }), [draft, catalogo]);
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

  const abas = identidade ? ABAS : ABAS.filter(([id]) => id !== "identidade");
  const aba: AbaId = abas.some(([id]) => id === mem.aba) ? mem.aba : "ficha";
  const gesto = useGestoAbas(abas.map(([id]) => id), aba, trocarAba);

  const temp = (a: AlvoMod) => somaTemporaria(estado, a);
  // os modificadores temporários entram só no que é exibido; a construção do personagem não muda
  const stats = base;
  const raca = label2014(draft.raceId), subclasse = selected2014(draft, "subclass")[0];
  const defesas = [...defesasDerivadas(draft, raceTraits2014(draft), selected2014(draft, "dragon-ancestry")[0]), ...estado.defesas];
  const extra = (alvo: AlvoMod) => (temp(alvo) !== 0 ? <small className="ficha-temp">{sinal(temp(alvo))} temp.</small> : null);
  const propsAba = { draft, sheet, stats, estado, onChange, onOpenContent, vital };

  const origem = origem2014(draft.backgroundId)?.nome ?? label2014(draft.backgroundId);
  const [editandoRetrato, setEditandoRetrato] = useState(false);
  const nomeExibido = draft.name.trim() || "Personagem sem nome";
  return <div ref={raiz} className="content ficha auth wide ficha-jogo sistema-dnd" data-testid="ficha-guiada-leitura" {...gesto}><div className="ficha-largura">
    <div className="eyebrow">{campanha.toLocaleUpperCase("pt-BR")} · FICHA DE PERSONAGEM · SRD 2014</div>
    <section className="ficha-cabecalho" aria-label="Resumo do personagem">
      <div className="ficha-identidade">
        {retratoValido(draft.portrait)
          // com imagem: tocar nela só amplia; trocar ou enquadrar é o botão separado
          ? <span className="ficha-retrato-caixa"><RetratoQuadrado tipo="personagem" tamanho={104} src={draft.portrait} ampliar={nomeExibido}/>
            <button type="button" className="ficha-retrato-editar" aria-label="Alterar retrato" title="Alterar retrato e enquadramento" onClick={() => setEditandoRetrato(true)}><Pencil size={12} aria-hidden="true"/></button></span>
          : <button type="button" className="ficha-retrato" aria-label="Alterar retrato" title="Alterar retrato" onClick={() => setEditandoRetrato(true)}><RetratoQuadrado tipo="personagem" tamanho={104} src={null}/></button>}
        <div className="ficha-nomes"><h1>{nomeExibido}</h1>
          {draft.nickname?.trim() && <p className="identidade-alcunha"><em>{draft.nickname.trim()}</em></p>}
          <p className="ficha-linha-origem">{[raca, label2014(draft.classId) + (subclasse ? ` (${label2014(subclasse)})` : ""), origem].join(" · ")}</p>
          <p className="ficha-linha-nivel">Nível {draft.level}</p>
          <div className="ficha-acoes">
            <button type="button" className="ficha-botao" aria-label="Editar personagem" onClick={onEditar}><Pencil size={13} aria-hidden="true"/> Editar</button>
            <button type="button" className="ficha-botao" disabled={draft.level >= 20} onClick={onProgredir}><ChevronsUp size={13} aria-hidden="true"/> Subir de nível</button>
            <MenuAcoes onRetrato={() => setEditandoRetrato(true)} ciclo={personagemId && ciclo.disponivel ? (podeConceder ? { rotulo: "Gerenciar personagem", acao: () => ciclo.gerenciar(personagemId) } : { rotulo: "Excluir personagem", perigo: true, acao: () => ciclo.pedirRenuncia(personagemId) }) : undefined}/></div>
        </div>
      </div>
      <div className="ficha-numeros">
        <Indicador tipo="ca" rotulo="CA" valor={stats.ac + temp("ac")} extra={extra("ac")}/>
        <IndicadorPV atual={draft.currentHp} maximo={sheet.maxHp} temporarios={draft.temporaryHp}/>
        <Indicador tipo="iniciativa" rotulo="Iniciativa" valor={sinal(stats.initiative + temp("initiative"))} extra={extra("initiative")}/>
        <Indicador tipo="percepcao" rotulo="Percepção passiva" valor={stats.passivePerception + temp("passivePerception")} extra={extra("passivePerception")}/>
        <Indicador tipo="deslocamento" rotulo="Deslocamento" valor={metros(Math.max(0, stats.speed + temp("speed")))} extra={extra("speed")}/>
        <Indicador tipo="proficiencia" rotulo="Proficiência" valor={sinal(stats.prof)}/>
      </div>
      <div className="ficha-painel-jogo">
        <div className="ficha-controles">
          <Vida draft={draft} maximo={sheet.maxHp} vital={vital}/>
          <Condicoes draft={draft} vital={vital}/>
        </div>
        {defesas.length > 0 && <div className="ficha-defesas">{(Object.keys(ROTULO_DEFESA) as (keyof typeof ROTULO_DEFESA)[]).map(tipo => { const l = [...new Set(defesas.filter(d => d.tipo === tipo).map(d => d.texto))]; return l.length ? <p key={tipo}><span className="ficha-defesas-rotulo">{PLURAL_DEFESA[tipo]}</span>{l.map(t => { const Icone = iconeDeDano(t); return <span key={t} className="ficha-etiqueta"><Icone size={12} aria-hidden="true"/> {t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1)}</span>; })}</p> : null; })}</div>}
        <Descansos draft={draft} maximo={sheet.maxHp} onChange={onChange} vital={vital}/>
      </div>
    </section>
    <nav className="ficha-subnav" aria-label="Seções da ficha">{abas.map(([id, rotulo]) => <button key={id} type="button" className={aba === id ? "active" : ""} aria-current={aba === id ? "true" : undefined} onClick={() => trocarAba(id)}>{rotulo}</button>)}</nav>
    {salvamento}
    {avisos}
    {sheet.pending.length > 0 && <p className="notice" role="note">Ficha com escolhas pendentes. Use Editar personagem para concluir.</p>}
    {editandoRetrato && <Modal titulo={`Retrato de ${nomeExibido}`} onFechar={() => setEditandoRetrato(false)} sistema="sistema-dnd" largura={520}>
      <div className="criador"><CampoRetrato valor={draft.portrait ?? ""} campaignId={campaignId ?? ""} onChange={portrait => onChange({ ...draft, portrait })}/></div>
    </Modal>}
    <div className="ficha-conteudo" data-aba={aba}>
      {aba === "ficha" && <AbaFicha {...propsAba}/>}
      {aba === "habilidades" && <AbaHabilidades {...propsAba} podeConceder={podeConceder} filtro={mem.filtroHab} onFiltro={filtroHab => mudarMemoria({ filtroHab })}/>}
      {aba === "inventario" && <AbaInventario {...propsAba} usarItem={usarItem} transferir={transferir} personagemId={personagemId} campaignId={campaignId} moedas={moedas} mestre={podeConceder} vista={mem.vista} onVista={vista => mudarMemoria({ vista })} filtro={mem.filtro} onFiltro={filtro => mudarMemoria({ filtro })}/>}
      {aba === "identidade" && identidade}
    </div>
    <p className="muted ficha-dado">Cálculos das regras SRD 5.1 (2014).</p>
  </div></div>;
}

/** Ajuste de PV: campo vazio vale 1 ao executar uma ação. */
function Vida({ draft, maximo, vital }: { draft: CharacterDraft; maximo: number; vital: (a: AcaoVital) => void }) {
  const [valor, setValor] = useState("1");
  const n = valor.trim() === "" ? 1 : Number(valor), inteiro = Number.isSafeInteger(n) && n >= 0 && n <= 999, valido = inteiro && n > 0 && !!draft;
  const aplicar = (a: AcaoVital) => { vital(a); setValor("1"); };
  return <form className="ficha-vida-ajuste" onSubmit={e => e.preventDefault()}>
    <button type="button" className="ficha-passo dano" disabled={!valido} aria-label="Aplicar dano" title="Aplicar dano" onClick={() => aplicar({ tipo: "dano", valor: n })}><Minus size={16} aria-hidden="true"/></button>
    <input type="number" inputMode="numeric" min={0} max={999} placeholder="1" aria-label="Quantidade de pontos de vida" value={valor} onFocus={e => e.target.select()} onChange={e => setValor(e.target.value)} onBlur={() => { if (!inteiro) setValor("1"); }}/>
    <button type="button" className="ficha-passo cura" disabled={!valido} aria-label="Curar" title="Curar (até o máximo)" onClick={() => aplicar({ tipo: "cura", valor: n, maximo })}><Plus size={16} aria-hidden="true"/></button>
    <button type="button" className="ficha-temp-botao" disabled={!inteiro} title="Define os PV temporários com a quantidade digitada (não se acumulam; 0 remove)" aria-label={`PV temp. ${draft.temporaryHp}: definir PV temporários`} onClick={() => aplicar({ tipo: "temporarios", valor: n })}>PV temp. {draft.temporaryHp}</button>
  </form>;
}

/** Condições ativas como indicadores compactos: o nome mostra o efeito; o "+" abre a lista para adicionar. */
function Condicoes({ draft, vital }: { draft: CharacterDraft; vital: (a: AcaoVital) => void }) {
  const ativas = lerEstadoJogo(draft).condicoes;
  const [aberto, setAberto] = useState(false), [vendo, setVendo] = useState<string | null>(null);
  const menu = useRef<HTMLDivElement>(null), gatilho = useRef<HTMLButtonElement>(null);
  useFecharMenu(aberto, menu, gatilho, () => setAberto(false));
  const disponiveis = CONDICOES_5E.filter(c => !ativas.includes(c));
  return <div className="ficha-condicoes" role="group" aria-label="Condições">
    {ativas.map(c => <span key={c} className="ficha-chip ativa"><button type="button" className="ficha-chip-nome" aria-expanded={vendo === c} onClick={() => setVendo(v => (v === c ? null : c))}>{c}</button>
      <button type="button" aria-label={`Remover condição ${c}`} onClick={() => { vital({ tipo: "condicao", nome: c, ativa: false }); setVendo(null); }}><X size={12} aria-hidden="true"/></button></span>)}
    <span className="ficha-menu">
      <button ref={gatilho} type="button" className="ficha-temp-botao" aria-label="Condições +: adicionar condição" aria-haspopup="true" aria-expanded={aberto} disabled={disponiveis.length === 0} onClick={() => setAberto(a => !a)}>Condições +</button>
      {aberto && <div ref={menu} className="barra-menu ficha-menu-lista ficha-lista-condicoes" role="group" aria-label="Escolher condição">
        {disponiveis.map(c => <button key={c} type="button" className="barra-item" title={CONDICOES_TEXTO[c]} onClick={() => { vital({ tipo: "condicao", nome: c, ativa: true }); setAberto(false); }}>{c}</button>)}
      </div>}
    </span>
    {vendo && ativas.includes(vendo) && <p className="ficha-efeito" role="note"><strong>{vendo}:</strong> {CONDICOES_TEXTO[vendo] ?? "Sem descrição cadastrada."}</p>}
  </div>;
}

/** Reticências do cabeçalho: ações que não precisam ficar à vista. */
function MenuAcoes({ onRetrato, ciclo }: { onRetrato: () => void; ciclo?: { rotulo: string; perigo?: boolean; acao: () => void } }) {
  const [aberto, setAberto] = useState(false);
  const menu = useRef<HTMLDivElement>(null), gatilho = useRef<HTMLButtonElement>(null);
  useFecharMenu(aberto, menu, gatilho, () => setAberto(false));
  return <div className="ficha-menu">
    <button ref={gatilho} type="button" className="ficha-botao" aria-haspopup="true" aria-expanded={aberto} aria-label="Mais ações do personagem" title="Mais ações" onClick={() => setAberto(a => !a)}><MoreHorizontal size={15} aria-hidden="true"/></button>
    {aberto && <div ref={menu} className="barra-menu ficha-menu-lista" role="group" aria-label="Ações do personagem">
      <button type="button" className="barra-item" onClick={() => { setAberto(false); onRetrato(); }}><ImageIcon size={14} aria-hidden="true"/> Alterar retrato</button>{ciclo && <><hr/><button type="button" className={"barra-item" + (ciclo.perigo ? " danger" : "")} onClick={() => { setAberto(false); ciclo.acao(); }}>{ciclo.rotulo}</button></>}
    </div>}
  </div>;
}

/** Descanso curto e longo, com confirmação. */
function Descansos({ draft, maximo, onChange, vital }: { draft: CharacterDraft; maximo: number; onChange: (d: CharacterDraft) => void; vital: (a: AcaoVital) => void }) {
  const [confirmar, setConfirmar] = useState<"curto" | "longo" | null>(null), [aviso, setAviso] = useState("");
  const descansar = () => {
    if (confirmar === "curto") { onChange(descansoCurto(draft)); setAviso("Descanso curto registrado. Para recuperar PV, use dados de vida, role o dado e informe a cura."); }
    else { const r = descansoLongo(draft, maximo); if (r.ok) { onChange(r.draft); vital({ tipo: "descanso", maximo }); setAviso("Descanso longo registrado."); } else setAviso(r.motivo); }
    setConfirmar(null);
  };
  return <div className="ficha-descansos">
    <button type="button" onClick={() => { setAviso(""); setConfirmar("curto"); }}><Coffee size={13} aria-hidden="true"/> Descanso curto</button>
    <button type="button" onClick={() => { setAviso(""); setConfirmar("longo"); }}><Moon size={13} aria-hidden="true"/> Descanso longo</button>
    {aviso && <p role="status">{aviso}</p>}
    {confirmar && <Modal titulo={confirmar === "curto" ? "Descanso curto" : "Descanso longo"} onFechar={() => setConfirmar(null)} sistema="sistema-dnd"
      acoes={<><button type="button" className="btn-secondary" onClick={() => setConfirmar(null)}>Cancelar</button><button type="button" className="btn-primary" data-foco onClick={descansar}>Confirmar descanso</button></>}>
      <p>{confirmar === "curto" ? "Registrar descanso curto?" : "Registrar descanso longo? Os PV e os recursos serão recuperados."}</p>
    </Modal>}
  </div>;
}

const PLURAL_DEFESA = { resistencia: "Resistências", imunidade: "Imunidades", vulnerabilidade: "Vulnerabilidades" } as const;
const ICONES_DE_DANO: [RegExp, LucideIcon][] = [[/fogo/i, Flame], [/frio/i, Snowflake], [/el[ée]tric|rel[âa]mpago/i, Zap], [/[áa]cido/i, Droplet], [/veneno/i, Skull]];
const iconeDeDano = (texto: string): LucideIcon => ICONES_DE_DANO.find(([re]) => re.test(texto))?.[1] ?? Shield;
