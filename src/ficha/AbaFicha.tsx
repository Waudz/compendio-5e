// Aba "Ficha", na ordem aprovada: atributos, modificadores temporários, testes de resistência, perícias, inspiração, dados de vida e
// testes contra a morte, defesas e sentidos, proficiências e idiomas, história. Os valores vêm do motor 2014; nada aqui duplica regras.
import { ChevronDown, Plus, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { class2014, label2014, proficiency2014, proficiencyLabel2014, raceTraits2014, selected2014 } from "../criador/regras-2014";
import { rotuloAtributo, rotuloPericia } from "../criador/rotulos";
import { ABILITY_ORDER } from "../rules/ability-generation-2014";
import { comEstado, defesasDerivadas, ROTULO_ALVO, ROTULO_DEFESA, sentidosEspeciais, somaTemporaria, usarRecurso, type AlvoMod, type TipoDefesa } from "./estadoJogo";
import { CAMPOS_HISTORIA } from "./campos";
import { Marcadores } from "./Marcadores";
import { MolduraAtributo } from "../dnd/elementos";
import { novoId, sinal, type PropsAba } from "./tipos";

/** Atributo de cada perícia (SRD 5.1), só para a sigla ao lado do nome. */
const ATRIBUTO_DA_PERICIA: Record<string, (typeof ABILITY_ORDER)[number]> = {
  acrobatics: "dex", "animal-handling": "wis", arcana: "int", athletics: "str", deception: "cha", history: "int", insight: "wis", intimidation: "cha", investigation: "int",
  medicine: "wis", nature: "int", perception: "wis", performance: "cha", persuasion: "cha", religion: "int", "sleight-of-hand": "dex", stealth: "dex", survival: "wis",
};
const sigla = (a: (typeof ABILITY_ORDER)[number]) => rotuloAtributo(a).slice(0, 3).toLocaleUpperCase("pt-BR");
const PLURAL = { resistencia: "Resistências", imunidade: "Imunidades", vulnerabilidade: "Vulnerabilidades" } as const;

export function AbaFicha({ draft, sheet, stats, estado, onChange, vital }: PropsAba) {
  const profs = proficiency2014(draft).filter(p => !p.startsWith("save:"));
  const grupo = (prefixo: string) => [...new Set(profs.filter(p => p.startsWith(prefixo)).map(proficiencyLabel2014))];
  const testesTemp = somaTemporaria(estado, "saves");
  const tracos = raceTraits2014(draft), sentidos = sentidosEspeciais(tracos);
  const defesas = [...defesasDerivadas(draft, tracos, selected2014(draft, "dragon-ancestry")[0]), ...estado.defesas];
  const dados = sheet.resources["hit-dice"], dadoDeVida = class2014(draft).data.hitDie;
  const idiomas = [...new Set([...sheet.languages.map(label2014), ...grupo("language:")])];
  const morte = (chave: "sucessos" | "falhas", n: number) => vital({ tipo: "morte", ...estado.morte, [chave]: estado.morte[chave] === n ? n - 1 : n });
  const historia = CAMPOS_HISTORIA.flatMap(([chave, rotulo]) => { const texto = draft.story?.[chave]?.trim(); return texto ? [[rotulo, texto] as const] : []; });

  return <div className="ficha-pilha ficha-aba-ficha">
    <section className="ficha-bloco ficha-bloco-aberto" aria-label="Atributos">
      <h2>Atributos</h2>
      <div className="ficha-atributos">{ABILITY_ORDER.map(a => <MolduraAtributo key={a} nome={rotuloAtributo(a)} valor={sheet.abilities[a]} modificador={Math.floor((sheet.abilities[a] - 10) / 2)}/>)}</div>
    </section>

    <Temporarios draft={draft} estado={estado} onChange={onChange}/>

    <section className="ficha-bloco" aria-label="Testes de resistência">
      <h2>Testes de resistência {testesTemp !== 0 && <small className="ficha-temp">{sinal(testesTemp)} temporário</small>}</h2>
      <ul className="ficha-duas-colunas">{ABILITY_ORDER.map(a => { const prof = proficiency2014(draft).includes("save: " + a); return <li key={a}><Marca ativa={prof}/><span>{rotuloAtributo(a)}{prof && <span className="sr-only"> (proficiente)</span>}</span><strong>{sinal(stats.saves[a] + testesTemp)}</strong></li>; })}</ul>
    </section>

    <section className="ficha-bloco" aria-label="Perícias">
      <h2>Perícias</h2>
      <ul className="ficha-duas-colunas">{Object.entries(stats.skills).sort(([a], [b]) => rotuloPericia(a).localeCompare(rotuloPericia(b), "pt-BR")).map(([id, bonus]) => { const prof = sheet.skills.includes(id), atributo = ATRIBUTO_DA_PERICIA[id]; return <li key={id}><Marca ativa={prof}/><span>{rotuloPericia(id)}{atributo && <> <small>{sigla(atributo)}</small></>}{prof && <span className="sr-only"> (proficiente)</span>}</span><strong>{sinal(bonus)}</strong></li>; })}</ul>
    </section>

    <section className="ficha-bloco ficha-inspiracao" aria-label="Inspiração">
      <label className="check"><Sparkles size={15} aria-hidden="true"/> <span>Inspiração</span><input type="checkbox" aria-label="Inspiração" checked={estado.inspiracao} onChange={e => onChange(comEstado(draft, { inspiracao: e.target.checked }))}/></label>
    </section>

    <section className="ficha-bloco" aria-label="Dados de vida">
      <h2>Dados de vida</h2>
      {dados && <div className="ficha-recurso"><span>d{dadoDeVida}</span>
        <Marcadores rotulo="dado de vida" maximo={dados.maximum} disponiveis={dados.remaining} onUsar={d => onChange(usarRecurso(draft, sheet, "hit-dice", d))}/></div>}
      <details className="ficha-recolhivel" open={draft.currentHp === 0 || undefined}>
        <summary>Testes contra a morte <ChevronDown size={14} aria-hidden="true"/></summary>
        <fieldset className="ficha-morte" aria-label="Testes contra a morte">
          {(["sucessos", "falhas"] as const).map(k => <div key={k}><span>{k === "sucessos" ? "Sucessos" : "Falhas"}</span>{[1, 2, 3].map(n => <input key={n} type="checkbox" className={"ficha-circulo-morte " + k} aria-label={`${k === "sucessos" ? "Sucesso" : "Falha"} ${n}`} checked={estado.morte[k] >= n} onChange={() => morte(k, n)}/>)}</div>)}
        </fieldset>
      </details>
    </section>

    <section className="ficha-bloco" aria-label="Resistências e sentidos">
      <h2>Resistências e sentidos</h2>
      <dl className="ficha-dados">
        {(Object.keys(PLURAL) as TipoDefesa[]).map(t => <div key={t} className="ficha-par"><dt>{PLURAL[t]}</dt><dd>{[...new Set(defesas.filter(d => d.tipo === t).map(d => d.texto))].join(", ") || "nenhuma"}</dd></div>)}
        <div className="ficha-par"><dt>Percepção passiva</dt><dd>{stats.passivePerception + somaTemporaria(estado, "passivePerception")}</dd></div>
        {sentidos.length > 0 && <div className="ficha-par"><dt>Sentidos especiais</dt><dd>{sentidos.join(", ")}</dd></div>}
      </dl>
      <Defesas draft={draft} estado={estado} onChange={onChange}/>
    </section>

    <section className="ficha-bloco" aria-label="Proficiências e idiomas">
      <h2>Proficiências e idiomas</h2>
      <dl className="ficha-dados">
        {grupo("armor:").length > 0 && <div className="ficha-par"><dt>Armaduras</dt><dd>{grupo("armor:").join(", ")}</dd></div>}
        {grupo("weapon:").length > 0 && <div className="ficha-par"><dt>Armas</dt><dd>{grupo("weapon:").join(", ")}</dd></div>}
        {grupo("tool:").length > 0 && <div className="ficha-par"><dt>Ferramentas</dt><dd>{grupo("tool:").map(t => t.replace(/^Ferramenta: /, "")).join(", ")}</dd></div>}
        <div className="ficha-par"><dt>Idiomas</dt><dd>{idiomas.join(", ") || "Nenhum registrado"}</dd></div>
      </dl>
    </section>

    {historia.length > 0 && <section className="ficha-bloco" aria-label="História e personalidade">
      <details className="ficha-recolhivel"><summary><h2>História e personalidade</h2> <ChevronDown size={14} aria-hidden="true"/></summary>
        {historia.map(([rotulo, texto]) => <div key={rotulo}><h3>{rotulo}</h3><p className="ficha-texto">{texto}</p></div>)}</details>
    </section>}
  </div>;
}

const Marca = ({ ativa }: { ativa: boolean }) => <span className={"ficha-marca" + (ativa ? " ativa" : "")} aria-hidden="true"/>;

function Temporarios({ draft, estado, onChange }: Pick<PropsAba, "draft" | "estado" | "onChange">) {
  const [aberto, setAberto] = useState(false), [nome, setNome] = useState(""), [alvo, setAlvo] = useState<AlvoMod>("ac"), [valor, setValor] = useState("1");
  const n = Number(valor), valido = Number.isInteger(n) && n !== 0 && Math.abs(n) <= 30;
  const total = estado.modificadores.length;
  return <section className="ficha-bloco" aria-label="Modificadores temporários">
    <details className="ficha-recolhivel" open={total > 0 || undefined}>
      <summary><SlidersHorizontal size={14} aria-hidden="true"/> <span>Modificadores temporários{total > 0 ? ` (${total})` : ""}</span> <ChevronDown size={14} aria-hidden="true"/></summary>
      {total > 0 && <ul className="ficha-chips">{estado.modificadores.map(m => <li key={m.id} className="ficha-chip"><span>{m.nome || "Efeito"} · {ROTULO_ALVO[m.alvo]} {sinal(m.valor)}</span>
        <button type="button" aria-label={`Remover modificador ${m.nome || ROTULO_ALVO[m.alvo]}`} onClick={() => onChange(comEstado(draft, { modificadores: estado.modificadores.filter(x => x.id !== m.id) }))}><X size={12} aria-hidden="true"/></button></li>)}</ul>}
      {!aberto && <button type="button" className="ficha-acao-discreta" aria-label="Adicionar efeito temporário" disabled={total >= 20} onClick={() => setAberto(true)}><Plus size={13} aria-hidden="true"/> Adicionar efeito</button>}
      {aberto && <form className="ficha-campos" onSubmit={e => { e.preventDefault(); if (!valido) return; onChange(comEstado(draft, { modificadores: [...estado.modificadores, { id: novoId(), nome: nome.trim(), alvo, valor: n }] })); setNome(""); setAberto(false); }}>
        <label>Afeta<select aria-label="Alvo do modificador" value={alvo} onChange={e => setAlvo(e.target.value as AlvoMod)}>{Object.entries(ROTULO_ALVO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Valor<input aria-label="Valor do modificador" type="number" min={-30} max={30} value={valor} onChange={e => setValor(e.target.value)}/></label>
        <label className="ficha-campo-largo">Nome (opcional)<input aria-label="Nome do efeito temporário" placeholder="Ex.: Escudo da Fé" maxLength={60} value={nome} onChange={e => setNome(e.target.value)}/></label>
        <div className="ficha-campo-largo row"><button type="submit" className="btn-primary" disabled={!valido}>Aplicar</button><button type="button" className="btn-secondary" onClick={() => setAberto(false)}>Cancelar</button></div>
      </form>}
    </details>
  </section>;
}

function Defesas({ draft, estado, onChange }: Pick<PropsAba, "draft" | "estado" | "onChange">) {
  const [aberto, setAberto] = useState(false), [tipo, setTipo] = useState<TipoDefesa>("resistencia"), [texto, setTexto] = useState("");
  return <div className="ficha-anotadas" role="group" aria-label="Defesas anotadas">
    {estado.defesas.length > 0 && <ul className="ficha-chips">{estado.defesas.map(d => <li key={d.id} className="ficha-chip"><span>{ROTULO_DEFESA[d.tipo]}: {d.texto}</span>
      <button type="button" aria-label={`Remover ${ROTULO_DEFESA[d.tipo]} ${d.texto}`} onClick={() => onChange(comEstado(draft, { defesas: estado.defesas.filter(x => x.id !== d.id) }))}><X size={12} aria-hidden="true"/></button></li>)}</ul>}
    {!aberto && <button type="button" className="ficha-acao-discreta" aria-label="Anotar defesa" disabled={estado.defesas.length >= 30} onClick={() => setAberto(true)}><Plus size={13} aria-hidden="true"/> Anotar defesa</button>}
    {aberto && <form className="ficha-campos" onSubmit={e => { e.preventDefault(); if (!texto.trim()) return; onChange(comEstado(draft, { defesas: [...estado.defesas, { id: novoId(), tipo, texto: texto.trim() }] })); setTexto(""); setAberto(false); }}>
      <label>Tipo<select aria-label="Tipo de defesa" value={tipo} onChange={e => setTipo(e.target.value as TipoDefesa)}>{Object.entries(ROTULO_DEFESA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>Contra o quê<input aria-label="Contra o que" placeholder="Ex.: fogo" maxLength={80} value={texto} onChange={e => setTexto(e.target.value)}/></label>
      <div className="ficha-campo-largo row"><button type="submit" className="btn-primary" disabled={!texto.trim()}>Anotar</button><button type="button" className="btn-secondary" onClick={() => setAberto(false)}>Cancelar</button></div>
    </form>}
  </div>;
}
