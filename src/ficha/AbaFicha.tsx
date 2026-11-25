// Aba "Ficha": a construção do personagem (atributos, salvaguardas, perícias, proficiências) e, claramente separados, os dados
// temporários do jogo (inspiração, modificadores, dados de vida, morte, defesas anotadas). Nada aqui duplica regras: vêm do motor 2014.
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { class2014, label2014, proficiency2014, proficiencyLabel2014, raceTraits2014 } from "../criador/regras-2014";
import { rotuloAtributo, rotuloPericia } from "../criador/rotulos";
import { ABILITY_ORDER } from "../rules/ability-generation-2014";
import { comEstado, ROTULO_ALVO, ROTULO_DEFESA, sentidosEspeciais, somaTemporaria, usarRecurso, type AlvoMod, type TipoDefesa } from "./estadoJogo";
import { novoId, sinal, type PropsAba } from "./tipos";

export function AbaFicha({ draft, sheet, stats, estado, onChange }: PropsAba) {
  const profs = proficiency2014(draft).filter(p => !p.startsWith("save:"));
  const grupo = (prefixo: string) => profs.filter(p => p.startsWith(prefixo)).map(proficiencyLabel2014);
  const salvasTemp = somaTemporaria(estado, "saves");
  const sentidos = sentidosEspeciais(raceTraits2014(draft));
  const dados = sheet.resources["hit-dice"];
  const idiomas = [...sheet.languages.map(label2014), ...grupo("language:")];
  const morte = (chave: "sucessos" | "falhas", n: number) => onChange(comEstado(draft, { morte: { ...estado.morte, [chave]: estado.morte[chave] === n ? n - 1 : n } }));

  return <div className="ficha-colunas">
    <section className="ficha-bloco ficha-larga" aria-label="Atributos">
      <h2>Atributos</h2>
      <div className="ficha-atributos">{ABILITY_ORDER.map(a => <div key={a} className="ficha-atributo"><span>{rotuloAtributo(a)}</span><strong>{sinal(Math.floor((sheet.abilities[a] - 10) / 2))}</strong><small>{sheet.abilities[a]}</small></div>)}</div>
    </section>

    <section className="ficha-bloco" aria-label="Salvaguardas">
      <h2>Salvaguardas {salvasTemp !== 0 && <small className="ficha-temp">{sinal(salvasTemp)} temporário</small>}</h2>
      <ul className="ficha-linhas">{ABILITY_ORDER.map(a => { const prof = proficiency2014(draft).includes("save: " + a); return <li key={a}><span><Marca ativa={prof}/> {rotuloAtributo(a)}{prof && <span className="sr-only"> (proficiente)</span>}</span><strong>{sinal(stats.saves[a] + salvasTemp)}</strong></li>; })}</ul>
    </section>

    <section className="ficha-bloco" aria-label="Perícias">
      <h2>Perícias</h2>
      <ul className="ficha-linhas">{Object.entries(stats.skills).sort(([a], [b]) => rotuloPericia(a).localeCompare(rotuloPericia(b), "pt-BR")).map(([id, bonus]) => { const prof = sheet.skills.includes(id); return <li key={id}><span><Marca ativa={prof}/> {rotuloPericia(id)}{prof && <span className="sr-only"> (proficiente)</span>}</span><strong>{sinal(bonus)}</strong></li>; })}</ul>
    </section>

    <section className="ficha-bloco" aria-label="Jogo">
      <h2>Durante o jogo</h2>
      <label className="check"><input type="checkbox" checked={estado.inspiracao} onChange={e => onChange(comEstado(draft, { inspiracao: e.target.checked }))}/> Inspiração</label>
      {dados && <div className="ficha-recurso"><span>Dados de vida (d{class2014(draft).data.hitDie}): <strong>{dados.remaining}/{dados.maximum}</strong></span>
        <span className="row"><button type="button" className="btn-secondary" disabled={dados.remaining === 0} onClick={() => onChange(usarRecurso(draft, sheet, "hit-dice", 1))} aria-label="Usar dado de vida">Usar</button>
          <button type="button" className="btn-secondary" disabled={!dados.spent} onClick={() => onChange(usarRecurso(draft, sheet, "hit-dice", -1))} aria-label="Devolver dado de vida">Devolver</button></span></div>}
      <fieldset className="ficha-morte"><legend>Salvaguardas contra a morte</legend>
        {(["sucessos", "falhas"] as const).map(k => <div key={k}><span>{k === "sucessos" ? "Sucessos" : "Falhas"}</span>{[1, 2, 3].map(n => <input key={n} type="checkbox" aria-label={`${k === "sucessos" ? "Sucesso" : "Falha"} ${n}`} checked={estado.morte[k] >= n} onChange={() => morte(k, n)}/>)}</div>)}
      </fieldset>
    </section>

    <Temporarios draft={draft} estado={estado} onChange={onChange}/>

    <section className="ficha-bloco" aria-label="Sentidos, idiomas e proficiências">
      <h2>Sentidos, idiomas e proficiências</h2>
      <dl className="ficha-dados">
        <dt>Sentidos especiais</dt><dd>{sentidos.join(", ") || "Nenhum"}</dd>
        <dt>Idiomas</dt><dd>{[...new Set(idiomas)].join(", ") || "Nenhum registrado"}</dd>
        <dt>Armaduras</dt><dd>{grupo("armor:").join(", ") || "Nenhuma"}</dd>
        <dt>Armas</dt><dd>{grupo("weapon:").join(", ") || "Nenhuma"}</dd>
        <dt>Ferramentas</dt><dd>{grupo("tool:").join(", ") || "Nenhuma"}</dd>
      </dl>
    </section>

    <Defesas draft={draft} estado={estado} onChange={onChange}/>
  </div>;
}

const Marca = ({ ativa }: { ativa: boolean }) => <span className={"ficha-marca" + (ativa ? " ativa" : "")} aria-hidden="true"/>;

function Temporarios({ draft, estado, onChange }: Pick<PropsAba, "draft" | "estado" | "onChange">) {
  const [nome, setNome] = useState(""), [alvo, setAlvo] = useState<AlvoMod>("ac"), [valor, setValor] = useState("1");
  const n = Number(valor), valido = Number.isInteger(n) && n !== 0 && Math.abs(n) <= 30;
  return <section className="ficha-bloco" aria-label="Modificadores temporários">
    <h2>Modificadores temporários</h2>
    <p className="muted">Efeitos do momento (magias, bênçãos, ajustes do mestre). Não mudam a construção do personagem.</p>
    {estado.modificadores.length > 0 && <ul className="ficha-linhas">{estado.modificadores.map(m => <li key={m.id}><span>{m.nome || "Efeito"} · {ROTULO_ALVO[m.alvo]} {sinal(m.valor)}</span>
      <button type="button" className="ficha-remover" aria-label={`Remover modificador ${m.nome || ROTULO_ALVO[m.alvo]}`} onClick={() => onChange(comEstado(draft, { modificadores: estado.modificadores.filter(x => x.id !== m.id) }))}><X size={14} aria-hidden="true"/></button></li>)}</ul>}
    <form className="ficha-form" onSubmit={e => { e.preventDefault(); if (!valido) return; onChange(comEstado(draft, { modificadores: [...estado.modificadores, { id: novoId(), nome: nome.trim(), alvo, valor: n }] })); setNome(""); }}>
      <input aria-label="Nome do efeito temporário" placeholder="Efeito (ex.: Escudo da Fé)" maxLength={60} value={nome} onChange={e => setNome(e.target.value)}/>
      <select aria-label="Alvo do modificador" value={alvo} onChange={e => setAlvo(e.target.value as AlvoMod)}>{Object.entries(ROTULO_ALVO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input aria-label="Valor do modificador" type="number" min={-30} max={30} value={valor} onChange={e => setValor(e.target.value)}/>
      <button type="submit" className="btn-secondary" disabled={!valido || estado.modificadores.length >= 20}><Plus size={14} aria-hidden="true"/> Aplicar</button>
    </form>
  </section>;
}

function Defesas({ draft, estado, onChange }: Pick<PropsAba, "draft" | "estado" | "onChange">) {
  const [tipo, setTipo] = useState<TipoDefesa>("resistencia"), [texto, setTexto] = useState("");
  return <section className="ficha-bloco" aria-label="Defesas anotadas">
    <h2>Defesas anotadas</h2>
    <p className="muted">As defesas de raça e classe já aparecem no topo. Anote aqui as concedidas por itens ou pelo mestre.</p>
    {estado.defesas.length > 0 && <ul className="ficha-linhas">{estado.defesas.map(d => <li key={d.id}><span>{ROTULO_DEFESA[d.tipo]}: {d.texto}</span>
      <button type="button" className="ficha-remover" aria-label={`Remover ${ROTULO_DEFESA[d.tipo]} ${d.texto}`} onClick={() => onChange(comEstado(draft, { defesas: estado.defesas.filter(x => x.id !== d.id) }))}><X size={14} aria-hidden="true"/></button></li>)}</ul>}
    <form className="ficha-form" onSubmit={e => { e.preventDefault(); if (!texto.trim()) return; onChange(comEstado(draft, { defesas: [...estado.defesas, { id: novoId(), tipo, texto: texto.trim() }] })); setTexto(""); }}>
      <select aria-label="Tipo de defesa" value={tipo} onChange={e => setTipo(e.target.value as TipoDefesa)}>{Object.entries(ROTULO_DEFESA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input aria-label="Contra o que" placeholder="Ex.: fogo" maxLength={80} value={texto} onChange={e => setTexto(e.target.value)}/>
      <button type="submit" className="btn-secondary" disabled={!texto.trim() || estado.defesas.length >= 30}><Plus size={14} aria-hidden="true"/> Anotar</button>
    </form>
  </section>;
}
