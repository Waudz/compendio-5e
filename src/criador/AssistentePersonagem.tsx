// Criação e edição do personagem D&D 5e (2014) por etapas, sobre o motor `regras-2014` (nada de regras é recalculado aqui). Na criação,
// as etapas seguem uma ordem sugerida (história, opcional, por último), mas se pode saltar, avançar com pendências e salvar incompleto. Na edição, cada categoria é
// aberta direto. Nada do que pertence à mesa (PV atuais, moedas, inventário, recursos, condições) é editado aqui.
import "./etapas-criador.css";
import { Anchor, BookOpen, Compass, Crown, Feather, Hammer, HeartHandshake, Home, Mountain, Music, Scroll, Shield, Swords, Theater, VenetianMask, type LucideIcon } from "lucide-react";
import { useState, type ReactNode, type Ref } from "react";
import { srdItem } from "../catalogue/srd-2014-items";
import { MolduraAtributo, SeloNivel } from "../dnd/elementos";
import "../dnd/dnd.css";
import { CAMPOS_HISTORIA } from "../ficha/campos";
import { entregarNasAtivas, type ChaveMoeda } from "../moedas/moedas";
import { ABILITY_ORDER, POINT_BUY_BUDGET, pointBuySpent } from "../rules/ability-generation-2014";
import type { CharacterDraft, CharacterSheet } from "../rules/character-domain";
import { publicIdentityCard, type PublicIdentity, type SheetPublicSource } from "../rules/public-identity";
import { CartoesDeEscolha, Etapas, type EtapaInfo } from "../ui/Etapas";
import { Modal } from "../ui/Modal";
import { RetratoQuadrado } from "../RetratoCombate";
import { retratoValido } from "../fichas";
import type { MetodoAtributos } from "./atributos-2014";
import { CampoRetrato } from "./CampoRetrato";
import PublicIdentityEditor from "./identidade-publica-editor";
import { Equipamento2014, ListaDeEscolhas } from "./Opcoes2014";
import { CLASSE_VISUAL, iconeDaClasse, iconeDaRaca, numerosDaRaca, RACA_VISUAL } from "./opcoesVisuais";
import { ferramentasDaCategoria, origem2014, ORIGENS_2014, ROTULO_VEICULO } from "./origens-2014";
import { equipamentoDaClasseAceito, etapaDaEscolha, pendencias2014, type EtapaId, type Pendencia } from "./pendencias";
import {
  automaticSpells2014, canonicalItem2014, change2014, choices2014, class2014, classes2014, decide2014, featureDescription2014, grantBackground2014, hpMode2014, hpRoll2014,
  label2014, origemEntregue2014, pacoteDaOrigem2014, proficiencyLabel2014, races2014, raceTraits2014, removerOrigem2014, selected2014, shortId, statistics2014,
} from "./regras-2014";
import { rotuloAtributo, rotuloPericia } from "./rotulos";

export type Etapa = EtapaId;
const ETAPAS_DE_CRIACAO: [Etapa, string][] = [["identidade", "Identidade"], ["raca", "Raça"], ["classe", "Classe"], ["origem", "Origem"], ["atributos", "Atributos"], ["equipamento", "Equipamentos iniciais"], ["revisao", "Revisão e identidade pública"], ["historia", "História e personalidade"]];
const CATEGORIAS_DE_EDICAO: [Etapa, string][] = [["identidade", "Identidade"], ["raca", "Raça"], ["classe", "Classe e nível"], ["origem", "Origem"], ["atributos", "Atributos"], ["equipamento", "Equipamento inicial"], ["publica", "Identidade pública"], ["historia", "História e personalidade"]];

const ICONE_ORIGEM: Record<string, LucideIcon> = { acolyte: HeartHandshake, entertainer: Music, "guild-artisan": Hammer, charlatan: Theater, criminal: VenetianMask, hermit: Mountain, outlander: Compass, "folk-hero": Shield, sailor: Anchor, noble: Crown, urchin: Home, sage: BookOpen, soldier: Swords, custom: Feather };

export type PropsAssistente = {
  modo: "criar" | "editar"; etapa: Etapa; onEtapa: (e: Etapa) => void;
  draft: CharacterDraft; sheet: CharacterSheet; onChange: (d: CharacterDraft) => void;
  campaignId: string; moedas: readonly ChaveMoeda[]; nomeRef?: Ref<HTMLInputElement>;
  metodo: MetodoAtributos; onMetodo: (m: MetodoAtributos) => void; onAtributo: (a: typeof ABILITY_ORDER[number], valor: number) => void; erroAtributo: string;
  onNivel: (n: number) => void;
  identity: PublicIdentity; onIdentity: (i: PublicIdentity) => void; origemPublica: SheetPublicSource; somenteFicha: boolean;
  /** Botão final da criação (salvar). */ concluir?: ReactNode;
};

export function AssistentePersonagem(p: PropsAssistente) {
  const { draft, sheet, modo } = p;
  const pendencias = pendencias2014(draft, sheet);
  const lista = modo === "criar" ? ETAPAS_DE_CRIACAO : CATEGORIAS_DE_EDICAO.filter(([id]) => id !== "equipamento" || !equipamentoDaClasseAceito(draft) || !origemEntregue2014(draft) || p.etapa === "equipamento");
  const atual = lista.some(([id]) => id === p.etapa) ? p.etapa : lista[0][0];
  // a identidade pública que acompanha a ficha já está pronta; só fica pendente se a personalização não apresentar nome nem alcunha
  const cartao = publicIdentityCard(p.identity, p.origemPublica);
  const publicaSemNome = !p.somenteFicha && p.identity.name.mode !== "sheet" && !cartao.name && !cartao.alias;
  const temHistoria = CAMPOS_HISTORIA.some(([chave]) => draft.story?.[chave]?.trim());
  const etapas: EtapaInfo<Etapa>[] = lista.map(([id, nome]) => {
    const publica = id === "publica" || id === "revisao";
    const n = publica ? Number(publicaSemNome) : pendencias.filter(x => x.etapa === id).length;
    return { id, nome, pendencias: n, concluida: !n && (id === "historia" ? temHistoria : !(publica && p.somenteFicha)) };
  });
  const irParaPendencia = (e: Etapa) => p.onEtapa(lista.some(([id]) => id === e) ? e : lista[0][0]);

  return <Etapas rotulo="Etapas do personagem" semNumeros etapas={etapas} atual={atual} onIr={p.onEtapa} sequencial={modo === "criar"} rodape={p.concluir}
    resumo={modo === "criar" ? <Resumo draft={draft} sheet={sheet} pendencias={pendencias} onIr={irParaPendencia}/> : undefined}>
    {atual === "identidade" && <EtapaIdentidade {...p}/>}
    {atual === "raca" && <EtapaRaca {...p}/>}
    {atual === "classe" && <EtapaClasse {...p}/>}
    {atual === "origem" && <EtapaOrigem {...p}/>}
    {atual === "atributos" && <EtapaAtributos {...p}/>}
    {atual === "equipamento" && <EtapaEquipamento {...p}/>}
    {atual === "historia" && <Historia {...p}/>}
    {atual === "publica" && <Publica {...p}/>}
    {atual === "revisao" && <>
      <ListaDePendencias pendencias={pendencias} onIr={irParaPendencia} nomes={new Map(lista)}/>
      <Resumo draft={draft} sheet={sheet} pendencias={[]} onIr={irParaPendencia} completo/>
      <Publica {...p}/>
    </>}
  </Etapas>;
}

function Titulo({ children, ajuda }: { children: ReactNode; ajuda?: ReactNode }) {
  return <div className="etapa-cabecalho"><h2 className="dnd-titulo">{children}</h2>{ajuda && <p className="muted">{ajuda}</p>}</div>;
}
/** Escolhas do motor que pertencem a uma etapa. */
function Escolhas({ draft, onChange, etapa }: { draft: CharacterDraft; onChange: (d: CharacterDraft) => void; etapa: "raca" | "classe" | "origem" }) {
  const lista = choices2014(draft).filter(c => etapaDaEscolha(c.id) === etapa);
  // trocar de raça, classe ou origem recomeça as seções de magia na primeira incompleta
  const dono = etapa === "raca" ? draft.raceId : etapa === "origem" ? draft.backgroundId : draft.classId;
  return lista.length ? <ListaDeEscolhas key={dono} draft={draft} escolhas={lista} onChange={onChange}/> : null;
}

function EtapaIdentidade(p: PropsAssistente) {
  const { draft, onChange } = p;
  return <>
    <Titulo ajuda="O nome é a única informação obrigatória para salvar.">Identidade</Titulo>
    <div className="etapa-identidade">
      <div className="etapa-campos">
        <label>Nome do personagem<input ref={p.nomeRef} aria-label="Nome do personagem" value={draft.name} maxLength={120} onChange={e => onChange({ ...draft, name: e.target.value })}/></label>
        <label>Alcunha (opcional)<input aria-label="Alcunha" value={draft.nickname ?? ""} maxLength={120} onChange={e => onChange({ ...draft, nickname: e.target.value })}/></label>
      </div>
      <CampoRetrato valor={draft.portrait ?? ""} campaignId={p.campaignId} onChange={portrait => onChange({ ...draft, portrait })}/>
    </div>
  </>;
}

function Historia({ draft, onChange }: PropsAssistente) {
  const campos = <div className="etapa-historia">{CAMPOS_HISTORIA.map(([chave, rotulo]) => <label key={chave} className={chave === "historia" ? "etapa-largo" : undefined}>{rotulo}<textarea aria-label={rotulo} rows={chave === "historia" ? 6 : 3} maxLength={chave === "historia" ? 8000 : 1500} value={draft.story?.[chave] ?? ""} onChange={e => onChange({ ...draft, story: { ...draft.story, [chave]: e.target.value } })}/></label>)}</div>;
  return <><Titulo ajuda="Opcional. Só você e o mestre leem.">História e personalidade</Titulo>{campos}</>;
}

function EtapaRaca({ draft, onChange }: PropsAssistente) {
  const [erro, setErro] = useState("");
  const trocar = (raceId: string) => {
    if (raceId === draft.raceId) return;
    try { onChange(change2014(draft, { raceId, decisions: draft.decisions.filter(c => etapaDaEscolha(c.id) !== "raca" && c.id !== "background-replacement-skill") })); setErro(""); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível trocar a raça."); }
  };
  return <>
    <Titulo ajuda="A raça define bônus de atributo, deslocamento e traços.">Raça</Titulo>
    {erro && <p role="alert" className="notice err">{erro}</p>}
    <CartoesDeEscolha rotulo="Raça" valor={draft.raceId} onEscolher={trocar} opcoes={races2014.map(r => { const Icone = iconeDaRaca(r.id); return { id: r.id, nome: r.name, resumo: RACA_VISUAL[r.id]?.resumo ?? "", selo: numerosDaRaca(r.id), icone: <Icone size={20}/> }; })}/>
    <section className="etapa-detalhes" aria-label={`Detalhes: ${label2014(draft.raceId)}`}>
      <h3>{label2014(draft.raceId)}</h3>
      <Escolhas draft={draft} onChange={onChange} etapa="raca"/>
      <div className="etapa-tracos">{raceTraits2014(draft).map(t => <details key={t.index}><summary>{t.name}</summary><p className="ficha-texto">{t.desc.join("\n\n")}</p></details>)}</div>
    </section>
  </>;
}

function EtapaClasse(p: PropsAssistente) {
  const { draft, onChange, sheet } = p;
  const [pedido, setPedido] = useState<string | null>(null), [erro, setErro] = useState("");
  const aplicar = (classId: string) => {
    try {
      // as decisões de equipamento ficam: o conjunto inicial já entregue não é concedido de novo
      onChange(change2014(draft, { classId, decisions: draft.decisions.filter(c => etapaDaEscolha(c.id) !== "classe" || /^equipment-/.test(c.id)), spentResources: {}, hpRolls: undefined }));
      setErro("");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível trocar a classe."); }
    setPedido(null);
  };
  // trocar de classe só pede confirmação quando há o que perder
  const temEscolhas = draft.decisions.some(c => etapaDaEscolha(c.id) === "classe" && !/^equipment-/.test(c.id) && c.optionIds.length > 0) || !!draft.hpRolls || Object.values(draft.spentResources).some(n => n > 0);
  const trocar = (id: string) => { if (id === draft.classId) return; if (temEscolhas) setPedido(id); else aplicar(id); };
  const dado = class2014(draft).data.hitDie;
  return <>
    <Titulo ajuda="A classe define dado de vida, proficiências e habilidades.">{p.modo === "editar" ? "Classe e nível" : "Classe"}</Titulo>
    {erro && <p role="alert" className="notice err">{erro}</p>}
    <CartoesDeEscolha rotulo="Classe" valor={draft.classId} onEscolher={trocar} opcoes={classes2014.map(c => { const id = shortId(c.id), Icone = iconeDaClasse(id), d = c as unknown as { data: { hitDie: number } }; return { id, nome: label2014(c.id), resumo: CLASSE_VISUAL[id]?.resumo ?? "", selo: `Dado de vida d${d.data.hitDie}`, icone: <Icone size={20}/> }; })}/>
    {pedido && <Modal titulo={`Trocar para ${label2014(pedido)}?`} onFechar={() => setPedido(null)} sistema="sistema-dnd"
      acoes={<><button type="button" className="btn-secondary" data-foco onClick={() => setPedido(null)}>Cancelar troca de classe</button><button type="button" className="btn-primary" onClick={() => aplicar(pedido)}>Confirmar troca de classe</button></>}>
      <p>As escolhas de {label2014(draft.classId)}, os recursos e as rolagens de PV são reiniciados. Nome, atributos, raça, origem e inventário continuam.</p>
    </Modal>}
    <section className="etapa-detalhes" aria-label={`Detalhes: ${label2014(draft.classId)}`}>
      <h3>{label2014(draft.classId)}</h3>
      <div className="etapa-nivel">
        <label>Nível<select aria-label="Nível" value={draft.level} onChange={e => p.onNivel(Number(e.target.value))}>{Array.from({ length: 20 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <label>PV a cada nível<select aria-label="Ganho de PV por nível" value={draft.hpRolls ? "rolled" : "fixed"} onChange={e => onChange(hpMode2014(draft, e.target.value === "rolled"))}><option value="fixed">Valor fixo (média do d{dado})</option><option value="rolled">Rolagens informadas</option></select></label>
        <p className="muted">PV máximo: <strong>{sheet.maxHp}</strong></p>
      </div>
      {draft.hpRolls && <RolagensDePV draft={draft} onChange={onChange}/>}
      <p className="muted">Testes de resistência e proficiências: {statisticaDeClasse(draft)}</p>
      <Escolhas draft={draft} onChange={onChange} etapa="classe"/>
      {sheet.features.some(id => featureDescription2014(id)) && <details><summary>Características da classe até o nível {draft.level}</summary>{sheet.features.filter(id => featureDescription2014(id)).map(id => <details key={id}><summary>{label2014(id)}</summary><p className="ficha-texto">{featureDescription2014(id)}</p></details>)}</details>}
      {automaticSpells2014(draft).length > 0 && <p className="muted">Magias concedidas pela raça ou subclasse (não contam no preparo): {automaticSpells2014(draft).map(m => m.name).join(", ")}.</p>}
    </section>
  </>;
}
const statisticaDeClasse = (d: CharacterDraft) => class2014(d).effects.filter(e => e.type === "proficiency").map(e => proficiencyLabel2014(`${e.category}: ${e.target}`)).join(", ") || "nenhuma";

export function RolagensDePV({ draft, onChange, niveis }: { draft: CharacterDraft; onChange: (d: CharacterDraft) => void; niveis?: number[] }) {
  const dado = class2014(draft).data.hitDie;
  return <div className="etapa-rolagens">
    <p className="muted">No 1º nível vale o máximo do dado. Informe o resultado de cada rolagem e confirme.</p>
    {(draft.hpRolls ?? []).map((v, i) => ({ v, nivel: i + 2 })).filter(r => !niveis || niveis.includes(r.nivel)).map(({ v, nivel }) => <div key={nivel} className="etapa-rolagem">
      <label>PV rolados no nível {nivel} (d{dado})<input type="number" min={1} max={dado} value={v} onChange={e => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && n >= 1 && n <= dado) onChange(hpRoll2014(draft, nivel, n)); }}/></label>
      {selected2014(draft, "hp-roll-confirmed-" + nivel)[0] !== String(v)
        ? <button type="button" className="btn-secondary" onClick={() => onChange(decide2014(draft, "hp-roll-confirmed-" + nivel, [String(v)]))}>Confirmar PV do nível {nivel}</button>
        : <span className="muted">confirmado</span>}
    </div>)}
  </div>;
}

function EtapaOrigem({ draft, onChange }: PropsAssistente) {
  const origem = origem2014(draft.backgroundId), [erro, setErro] = useState("");
  const trocar = (backgroundId: string) => {
    if (backgroundId === draft.backgroundId) return;
    try { onChange(change2014(draft, { backgroundId, decisions: draft.decisions.filter(c => !/^background-(languages|tool|skills|training|replacement-skill|feature|package)$/.test(c.id)) })); setErro(""); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível trocar a origem."); }
  };
  const pericias = origem?.pericias.map(rotuloPericia).join(", ");
  const ferramentas = [...(origem?.ferramentas ?? []).map(f => ROTULO_VEICULO[f] ?? srdItem(f)?.nome ?? f)];
  return <>
    <Titulo ajuda="A origem conta o passado do personagem: perícias, idiomas, ferramentas, equipamento e uma característica. Não muda atributos.">Origem</Titulo>
    {erro && <p role="alert" className="notice err">{erro}</p>}
    <CartoesDeEscolha rotulo="Origem" valor={draft.backgroundId} onEscolher={trocar} opcoes={ORIGENS_2014.map(o => { const Icone = ICONE_ORIGEM[o.id] ?? Scroll; return { id: o.id, nome: o.nome, resumo: o.pericias.length ? o.pericias.map(rotuloPericia).join(" e ") : "Duas perícias à escolha", selo: o.fonte === "srd" ? "SRD 5.1" : o.fonte === "personalizada" ? "Monte a sua" : undefined, icone: <Icone size={20}/> }; })}/>
    {origem && <section className="etapa-detalhes" aria-label={`Detalhes: ${origem.nome}`}>
      <h3>{origem.nome}</h3>
      <p>{origem.resumo}</p>
      <dl className="ficha-dados">
        {pericias && <><dt>Perícias</dt><dd>{pericias}</dd></>}
        {origem.idiomas > 0 && <><dt>Idiomas</dt><dd>{origem.idiomas} à escolha</dd></>}
        {(ferramentas.length > 0 || origem.escolhaFerramenta) && <><dt>Ferramentas</dt><dd>{[...ferramentas, origem.escolhaFerramenta ? `1 à escolha (${ferramentasDaCategoria(origem.escolhaFerramenta).length} opções)` : ""].filter(Boolean).join(", ")}</dd></>}
        {draft.backgroundId !== "custom" && <><dt>Característica</dt><dd>{origem.caracteristica}</dd><dt>Dinheiro</dt><dd>{origem.ouro} PO</dd></>}
      </dl>
      {draft.backgroundId === "custom" && <label className="etapa-largo">Característica da origem combinada com o mestre<textarea maxLength={500} value={selected2014(draft, "background-feature")[0] ?? ""} onChange={e => onChange(decide2014(draft, "background-feature", [e.target.value]))}/></label>}
      <Escolhas draft={draft} onChange={onChange} etapa="origem"/>
      <p className="muted">O equipamento e o dinheiro da origem são adicionados na etapa de equipamentos iniciais.</p>
    </section>}
  </>;
}

function EtapaAtributos({ draft, sheet, metodo, onMetodo, onAtributo, erroAtributo }: PropsAssistente) {
  // a conta de pontos só existe na compra de pontos (valores rolados passam de 15 e não entram nela)
  const gastos = metodo === "point-buy" ? pointBuySpent(draft.baseAbilities) : 0;
  return <>
    <Titulo ajuda="Valores antes dos bônus raciais; a moldura mostra o total com os bônus.">Atributos</Titulo>
    <div className="etapa-nivel">
      <label>Método<select aria-label="Método de atributos" value={metodo} onChange={e => onMetodo(e.target.value as MetodoAtributos)}><option value="point-buy">Compra de pontos (27)</option><option value="standard-array">Matriz padrão</option><option value="manual">Rolagens manuais (3–18)</option>{metodo === "preserved" && <option value="preserved">Valores preservados da ficha</option>}</select></label>
      {metodo === "point-buy" && <p className="muted" role="status">Pontos gastos: {gastos} / {POINT_BUY_BUDGET}</p>}
      {metodo === "manual" && <p className="muted">Role 4d6, descarte o menor e informe a soma dos três.</p>}
      {metodo === "preserved" && <p role="note" className="muted">Os atributos desta ficha foram preservados. Escolha outro método só para redistribuí-los.</p>}
    </div>
    <div className="etapa-atributos">{ABILITY_ORDER.map(a => {
      const base = draft.baseAbilities[a], total = sheet.abilities[a];
      return <MolduraAtributo key={a} nome={rotuloAtributo(a)} valor={total} modificador={Math.floor((total - 10) / 2)} nota={total !== base ? `${base} + ${total - base} de bônus` : undefined}
        controles={<span className="etapa-atributo-controle">
          {metodo === "point-buy" && <button type="button" className="btn-secondary" aria-label={"− Diminuir " + rotuloAtributo(a)} disabled={base <= 8} onClick={() => onAtributo(a, base - 1)}>−</button>}
          {metodo === "manual" ? <input type="number" aria-label={"Atributo " + a} min={3} max={18} value={base} onChange={e => onAtributo(a, Number(e.target.value))}/>
            : <select aria-label={"Atributo " + a} disabled={metodo === "preserved"} value={base} onChange={e => onAtributo(a, Number(e.target.value))}>{(metodo === "preserved" ? [base] : metodo === "standard-array" ? [15, 14, 13, 12, 10, 8] : [8, 9, 10, 11, 12, 13, 14, 15]).map(v => <option key={v} value={v}>{v}</option>)}</select>}
          {metodo === "point-buy" && <button type="button" className="btn-secondary" aria-label={"+ Aumentar " + rotuloAtributo(a)} disabled={base >= 15 || pointBuySpent({ ...draft.baseAbilities, [a]: base + 1 }) > POINT_BUY_BUDGET} onClick={() => onAtributo(a, base + 1)}>+</button>}
        </span>}/>;
    })}</div>
    {erroAtributo && <p role="alert" className="notice err">{erroAtributo}</p>}
  </>;
}

function EtapaEquipamento({ draft, onChange, moedas }: PropsAssistente) {
  const [simbolo, setSimbolo] = useState(() => { const i = draft.inventory.find(x => x.id === "background-acolyte:symbol")?.itemId; return ["amulet", "emblem", "reliquary"].find(s => canonicalItem2014("srd51:item/" + s) === i) ?? "amulet"; });
  const [msg, setMsg] = useState("");
  /** O dinheiro entregue chega nas moedas que a campanha usa. */
  const entregar = (proximo: CharacterDraft) => onChange(proximo.currency === draft.currency ? proximo : { ...proximo, currency: { cp: 0, sp: 0, gp: 0, ...entregarNasAtivas(draft.currency, proximo.currency, moedas) } });
  const pacote = pacoteDaOrigem2014(draft), origem = origem2014(pacote)!, entregue = origemEntregue2014(draft), outra = !!entregue && entregue.pacote !== pacote;
  const itens = pacote === "acolyte"
    ? [srdItem(canonicalItem2014("srd51:item/" + simbolo))?.nome ?? "Símbolo sagrado", "Livro de orações", "5 varetas de incenso", "Vestes sacerdotais", "Roupas comuns"]
    : origem.equipamento.map(e => e.nome ?? srdItem(e.itemId)?.nome ?? e.itemId);
  const conceder = () => {
    try { entregar(grantBackground2014(outra ? removerOrigem2014(draft) : draft, simbolo)); setMsg("Equipamento da origem adicionado ao inventário."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Não foi possível adicionar o equipamento da origem."); }
  };
  return <>
    <Titulo ajuda="Confirme uma vez o equipamento da classe e o da origem. Depois, tudo é cuidado no inventário da ficha.">Equipamentos iniciais</Titulo>
    {equipamentoDaClasseAceito(draft)
      ? <p className="notice" role="note">Equipamento inicial da classe já confirmado. Mudanças são feitas no inventário.</p>
      : <Equipamento2014 draft={draft} onChange={entregar}/>}
    <section className="etapa-detalhes" aria-label="Equipamento da origem">
      <h3>Equipamento da origem — {origem2014(draft.backgroundId)?.nome}</h3>
      {draft.backgroundId === "custom" && <label>Pacote de equipamento<select aria-label="Pacote de equipamento da origem" value={pacote} onChange={e => onChange(decide2014(draft, "background-package", [e.target.value]))}>{ORIGENS_2014.filter(o => o.id !== "custom").map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></label>}
      {pacote === "acolyte" && <label>Símbolo sagrado<select aria-label="Símbolo sagrado da origem" value={simbolo} onChange={e => setSimbolo(e.target.value)}>{["amulet", "emblem", "reliquary"].map(s => <option key={s} value={s}>{srdItem(canonicalItem2014("srd51:item/" + s))?.nome ?? s}</option>)}</select></label>}
      <ul aria-label="Itens concedidos pela origem">{itens.map(i => <li key={i}>{i}</li>)}<li>{origem.ouro} peças de ouro (PO)</li></ul>
      {outra && <p className="notice" role="note">O inventário tem o equipamento de outra origem. Trocar retira aqueles itens e o ouro deles antes de adicionar os novos.</p>}
      <div><button type="button" className="btn-secondary" disabled={!!entregue && !outra && pacote !== "acolyte"} onClick={conceder}>{outra ? "Trocar o equipamento da origem" : entregue ? (pacote === "acolyte" ? "Atualizar símbolo sagrado da origem" : "Equipamento da origem já adicionado") : "Adicionar equipamento da origem"}</button></div>
      {msg && <p role="status">{msg}</p>}
    </section>
  </>;
}

function Publica(p: PropsAssistente) {
  return p.somenteFicha ? <p className="notice" role="note">A identidade pública pertence ao dono do personagem. Como mestre, você edita a ficha, mas não altera a apresentação dele.</p>
    : <PublicIdentityEditor key={p.draft.id} source={p.origemPublica} initialIdentity={p.identity} onChange={p.onIdentity}/>;
}

function ListaDePendencias({ pendencias, onIr, nomes }: { pendencias: Pendencia[]; onIr: (e: Etapa) => void; nomes: Map<Etapa, string> }) {
  if (!pendencias.length) return <p className="notice ok" role="status">Todas as escolhas estão concluídas.</p>;
  return <section className="etapa-detalhes" aria-label="Escolhas pendentes">
    <h3>Falta resolver ({pendencias.length})</h3>
    <ul className="etapa-pendencias">{pendencias.map(x => <li key={x.chave}><span>{x.texto}</span><button type="button" className="btn-secondary" onClick={() => onIr(x.etapa)}>Ir para {nomes.get(x.etapa) ?? "a etapa"}</button></li>)}</ul>
    <p className="muted">Você pode salvar agora e concluir depois.</p>
  </section>;
}

function Resumo({ draft, sheet, pendencias, onIr, completo }: { draft: CharacterDraft; sheet: CharacterSheet; pendencias: Pendencia[]; onIr: (e: Etapa) => void; completo?: boolean }) {
  const stats = statistics2014({ ...draft, name: draft.name.trim() || "Sem nome" });
  return <div className={"resumo-personagem" + (completo ? " completo" : "")} role="region" aria-label="Resumo do personagem em criação">
    <div className="resumo-topo"><RetratoQuadrado tipo="personagem" tamanho={44} src={retratoValido(draft.portrait) ? draft.portrait : null}/>
      <div><strong>{draft.name.trim() || "Sem nome"}</strong><small>{[label2014(draft.raceId), label2014(draft.classId), origem2014(draft.backgroundId)?.nome].filter(Boolean).join(" · ")}</small></div>
      <SeloNivel nivel={draft.level}/></div>
    <p className="resumo-numeros"><span>PV {sheet.maxHp}</span><span>CA {stats.ac}</span><span>Prof. +{stats.prof}</span></p>
    <p className="resumo-atributos">{ABILITY_ORDER.map(a => <span key={a}><abbr title={rotuloAtributo(a)}>{rotuloAtributo(a).slice(0, 3)}</abbr> {sheet.abilities[a]}</span>)}</p>
    {completo && <p className="muted">Perícias: {sheet.skills.map(rotuloPericia).join(", ") || "nenhuma"}</p>}
    {pendencias.length > 0 && <><p className="resumo-pendencias">{pendencias.length} escolha(s) pendente(s)</p>
      <ul className="etapa-pendencias compacta">{pendencias.slice(0, 4).map(x => <li key={x.chave}><button type="button" className="ficha-link" onClick={() => onIr(x.etapa)}>{x.texto}</button></li>)}</ul></>}
  </div>;
}
