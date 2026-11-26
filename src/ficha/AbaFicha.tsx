// Aba "Ficha": a construção do personagem (atributos, salvaguardas, perícias, proficiências) e, claramente separados, os dados
// temporários do jogo (inspiração, efeitos, dados de vida, morte, defesas anotadas). Nada aqui duplica regras: vêm do motor 2014.
// Em painel largo: salvaguardas e dados da mesa numa coluna estreita; perícias em duas colunas e o restante ao lado.
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { class2014, label2014, proficiency2014, proficiencyLabel2014, raceTraits2014 } from "../criador/regras-2014";
import { rotuloAtributo, rotuloPericia } from "../criador/rotulos";
import { ABILITY_ORDER } from "../rules/ability-generation-2014";
import { comEstado, ROTULO_ALVO, ROTULO_DEFESA, sentidosEspeciais, somaTemporaria, usarRecurso, type AlvoMod, type TipoDefesa } from "./estadoJogo";
import { CAMPOS_HISTORIA } from "./campos";
import { Marcadores } from "./Marcadores";
import { novoId, sinal, type PropsAba } from "./tipos";

export function AbaFicha({ draft, sheet, stats, estado, onChange, vital }: PropsAba) {
  const profs = proficiency2014(draft).filter(p => !p.startsWith("save:"));
  const grupo = (prefixo: string) => [...new Set(profs.filter(p => p.startsWith(prefixo)).map(proficiencyLabel2014))];
  const salvasTemp = somaTemporaria(estado, "saves");
  const sentidos = sentidosEspeciais(raceTraits2014(draft));
  const dados = sheet.resources["hit-dice"];
  const idiomas = [...sheet.languages.map(label2014), ...grupo("language:")];
  const morte = (chave: "sucessos" | "falhas", n: number) => vital({ tipo: "morte", ...estado.morte, [chave]: estado.morte[chave] === n ? n - 1 : n });
  const historia = CAMPOS_HISTORIA.flatMap(([chave, rotulo]) => { const texto = draft.story?.[chave]?.trim(); return texto ? [[rotulo, texto] as const] : []; });

  return <div className="ficha-grade">
    <section className="ficha-bloco ficha-area-atributos" aria-label="Atributos">
      <h2>Atributos</h2>
      <div className="ficha-atributos">{ABILITY_ORDER.map(a => <div key={a} className="ficha-atributo"><span>{rotuloAtributo(a)}</span><strong>{sinal(Math.floor((sheet.abilities[a] - 10) / 2))}</strong><small>{sheet.abilities[a]}</small></div>)}</div>
    </section>

    <div className="ficha-area-lateral ficha-pilha">
      <section className="ficha-bloco" aria-label="Salvaguardas">
        <h2>Salvaguardas {salvasTemp !== 0 && <small className="ficha-temp">{sinal(salvasTemp)} temporário</small>}</h2>
        <ul className="ficha-linhas ficha-compactas">{ABILITY_ORDER.map(a => { const prof = proficiency2014(draft).includes("save: " + a); return <li key={a}><span><Marca ativa={prof}/> {rotuloAtributo(a)}{prof && <span className="sr-only"> (proficiente)</span>}</span><strong>{sinal(stats.saves[a] + salvasTemp)}</strong></li>; })}</ul>
      </section>

      <section className="ficha-bloco" aria-label="Jogo">
        <h2>Durante o jogo</h2>
        <label className="check"><input type="checkbox" checked={estado.inspiracao} onChange={e => onChange(comEstado(draft, { inspiracao: e.target.checked }))}/> Inspiração</label>
        {dados && <div className="ficha-recurso"><span>Dados de vida (d{class2014(draft).data.hitDie})</span>
          <Marcadores rotulo="dado de vida" maximo={dados.maximum} disponiveis={dados.remaining} onUsar={d => onChange(usarRecurso(draft, sheet, "hit-dice", d))}/></div>}
        <fieldset className="ficha-morte"><legend>Salvaguardas contra a morte</legend>
          {(["sucessos", "falhas"] as const).map(k => <div key={k}><span>{k === "sucessos" ? "Sucessos" : "Falhas"}</span>{[1, 2, 3].map(n => <input key={n} type="checkbox" aria-label={`${k === "sucessos" ? "Sucesso" : "Falha"} ${n}`} checked={estado.morte[k] >= n} onChange={() => morte(k, n)}/>)}</div>)}
        </fieldset>
      </section>
    </div>

    <div className="ficha-area-principal ficha-pilha">
      <section className="ficha-bloco ficha-bloco-pericias" aria-label="Perícias">
        <h2>Perícias</h2>
        <ul className="ficha-linhas ficha-compactas ficha-pericias">{Object.entries(stats.skills).sort(([a], [b]) => rotuloPericia(a).localeCompare(rotuloPericia(b), "pt-BR")).map(([id, bonus]) => { const prof = sheet.skills.includes(id); return <li key={id}><span><Marca ativa={prof}/> {rotuloPericia(id)}{prof && <span className="sr-only"> (proficiente)</span>}</span><strong>{sinal(bonus)}</strong></li>; })}</ul>
      </section>

      <section className="ficha-bloco" aria-label="Sentidos, idiomas e proficiências">
        <h2>Sentidos, idiomas e proficiências</h2>
        <dl className="ficha-dados">
          <dt>Sentidos especiais</dt><dd>{sentidos.join(", ") || "Nenhum"}</dd>
          <dt>Idiomas</dt><dd>{[...new Set(idiomas)].join(", ") || "Nenhum registrado"}</dd>
          <dt>Armaduras</dt><dd>{grupo("armor:").join(", ") || "Nenhuma"}</dd>
          <dt>Armas</dt><dd>{grupo("weapon:").join(", ") || "Nenhuma"}</dd>
          <dt>Ferramentas</dt><dd>{grupo("tool:").map(t => t.replace(/^Ferramenta: /, "")).join(", ") || "Nenhuma"}</dd>
        </dl>
      </section>

      <div className="ficha-dupla">
        <Temporarios draft={draft} estado={estado} onChange={onChange}/>
        <Defesas draft={draft} estado={estado} onChange={onChange}/>
      </div>

      {historia.length > 0 && <section className="ficha-bloco" aria-label="História e personalidade">
        <h2>História e personalidade</h2>
        {historia.map(([rotulo, texto]) => <details key={rotulo}><summary>{rotulo}</summary><p className="ficha-texto">{texto}</p></details>)}
      </section>}
    </div>
  </div>;
}

const Marca = ({ ativa }: { ativa: boolean }) => <span className={"ficha-marca" + (ativa ? " ativa" : "")} aria-hidden="true"/>;

function Temporarios({ draft, estado, onChange }: Pick<PropsAba, "draft" | "estado" | "onChange">) {
  const [aberto, setAberto] = useState(false), [nome, setNome] = useState(""), [alvo, setAlvo] = useState<AlvoMod>("ac"), [valor, setValor] = useState("1");
  const n = Number(valor), valido = Number.isInteger(n) && n !== 0 && Math.abs(n) <= 30;
  return <section className="ficha-bloco" aria-label="Modificadores temporários">
    <div className="ficha-titulo"><h2>Efeitos temporários</h2>
      {!aberto && <button type="button" className="ficha-mais" aria-label="Adicionar efeito temporário" disabled={estado.modificadores.length >= 20} onClick={() => setAberto(true)}><Plus size={14} aria-hidden="true"/></button>}</div>
    {estado.modificadores.length === 0 ? !aberto && <p className="muted">Nenhum. Magias, bênçãos e ajustes do mestre entram aqui.</p>
      : <ul className="ficha-chips">{estado.modificadores.map(m => <li key={m.id} className="ficha-chip"><span>{m.nome || "Efeito"} · {ROTULO_ALVO[m.alvo]} {sinal(m.valor)}</span>
        <button type="button" aria-label={`Remover modificador ${m.nome || ROTULO_ALVO[m.alvo]}`} onClick={() => onChange(comEstado(draft, { modificadores: estado.modificadores.filter(x => x.id !== m.id) }))}><X size={12} aria-hidden="true"/></button></li>)}</ul>}
    {aberto && <form className="ficha-campos" onSubmit={e => { e.preventDefault(); if (!valido) return; onChange(comEstado(draft, { modificadores: [...estado.modificadores, { id: novoId(), nome: nome.trim(), alvo, valor: n }] })); setNome(""); setAberto(false); }}>
      <label>Afeta<select aria-label="Alvo do modificador" value={alvo} onChange={e => setAlvo(e.target.value as AlvoMod)}>{Object.entries(ROTULO_ALVO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>Valor<input aria-label="Valor do modificador" type="number" min={-30} max={30} value={valor} onChange={e => setValor(e.target.value)}/></label>
      <label className="ficha-campo-largo">Nome (opcional)<input aria-label="Nome do efeito temporário" placeholder="Ex.: Escudo da Fé" maxLength={60} value={nome} onChange={e => setNome(e.target.value)}/></label>
      <div className="ficha-campo-largo row"><button type="submit" className="btn-primary" disabled={!valido}>Aplicar</button><button type="button" className="btn-secondary" onClick={() => setAberto(false)}>Cancelar</button></div>
    </form>}
  </section>;
}

function Defesas({ draft, estado, onChange }: Pick<PropsAba, "draft" | "estado" | "onChange">) {
  const [aberto, setAberto] = useState(false), [tipo, setTipo] = useState<TipoDefesa>("resistencia"), [texto, setTexto] = useState("");
  return <section className="ficha-bloco" aria-label="Defesas anotadas">
    <div className="ficha-titulo"><h2>Defesas anotadas</h2>
      {!aberto && <button type="button" className="ficha-mais" aria-label="Anotar defesa" disabled={estado.defesas.length >= 30} onClick={() => setAberto(true)}><Plus size={14} aria-hidden="true"/></button>}</div>
    {estado.defesas.length === 0 ? !aberto && <p className="muted">As de raça e classe aparecem no topo. Anote as de itens ou do mestre.</p>
      : <ul className="ficha-chips">{estado.defesas.map(d => <li key={d.id} className="ficha-chip"><span>{ROTULO_DEFESA[d.tipo]}: {d.texto}</span>
        <button type="button" aria-label={`Remover ${ROTULO_DEFESA[d.tipo]} ${d.texto}`} onClick={() => onChange(comEstado(draft, { defesas: estado.defesas.filter(x => x.id !== d.id) }))}><X size={12} aria-hidden="true"/></button></li>)}</ul>}
    {aberto && <form className="ficha-campos" onSubmit={e => { e.preventDefault(); if (!texto.trim()) return; onChange(comEstado(draft, { defesas: [...estado.defesas, { id: novoId(), tipo, texto: texto.trim() }] })); setTexto(""); setAberto(false); }}>
      <label>Tipo<select aria-label="Tipo de defesa" value={tipo} onChange={e => setTipo(e.target.value as TipoDefesa)}>{Object.entries(ROTULO_DEFESA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>Contra o quê<input aria-label="Contra o que" placeholder="Ex.: fogo" maxLength={80} value={texto} onChange={e => setTexto(e.target.value)}/></label>
      <div className="ficha-campo-largo row"><button type="submit" className="btn-primary" disabled={!texto.trim()}>Anotar</button><button type="button" className="btn-secondary" onClick={() => setAberto(false)}>Cancelar</button></div>
    </form>}
  </section>;
}
