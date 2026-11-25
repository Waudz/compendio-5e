// Aba "Habilidades": ataques, magias (com espaços), recursos e características. Seções sem conteúdo não aparecem.
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { automaticSpells2014, choices2014, featureDescription2014, label2014, raceTraits2014, resourceLabel2014, selected2014, spells2014, type Spell2014 } from "../criador/regras-2014";
import { rotuloOpcao } from "../criador/rotulos";
import { comEstado, recargaDe, somaTemporaria, usarRecurso } from "./estadoJogo";
import { novoId, sinal, type PropsAba } from "./tipos";

/** Magias escolhidas e concedidas, cada uma com a origem (truque, conhecida, grimório, preparada, concedida). */
export function magiasDaFicha(draft: PropsAba["draft"]): { magia: Spell2014; origens: string[] }[] {
  const mapa = new Map<string, Set<string>>();
  const add = (id: string, origem: string) => { (mapa.get(id) ?? mapa.set(id, new Set()).get(id)!).add(origem); };
  for (const c of choices2014(draft).filter(c => c.kind === "spell")) {
    const origem = c.id === "spells-prepared" ? "preparada" : c.id.startsWith("spellbook-level-") ? "grimório" : c.id === "spells-known" ? (draft.classId === "wizard" ? "grimório" : "conhecida") : c.id === "cantrips" ? "classe" : c.id === "racial-cantrip" ? "raça" : "característica";
    for (const id of selected2014(draft, c.id)) add(id, origem);
  }
  for (const m of automaticSpells2014(draft)) add(m.id, "concedida");
  return [...mapa].flatMap(([id, o]) => { const magia = spells2014.find(s => s.id === id); return magia ? [{ magia, origens: [...o] }] : []; })
    .sort((a, b) => a.magia.level - b.magia.level || a.magia.name.localeCompare(b.magia.name, "pt-BR"));
}

export function AbaHabilidades({ draft, sheet, stats, estado, onChange }: PropsAba) {
  const magias = magiasDaFicha(draft);
  const espacos = Object.entries(sheet.resources).filter(([id]) => id.startsWith("spell-slot-")).sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const recursos = Object.entries(sheet.resources).filter(([id]) => id !== "hit-dice" && !id.startsWith("spell-slot-"));
  const raciais = raceTraits2014(draft);
  const origem = selected2014(draft, "background-feature")[0];
  const temMagia = magias.length > 0 || espacos.length > 0 || stats.spellDc != null;
  const ataqueTemp = somaTemporaria(estado, "attacks");
  const circulos = [...new Set(magias.map(m => m.magia.level))];

  const usos = (id: string, rotulo: string) => { const r = sheet.resources[id]; return <li key={id} className="ficha-recurso">
    <span><strong>{rotulo}</strong> <span className="ficha-usos">{r.maximum === null ? "ilimitado" : `${r.remaining}/${r.maximum}`}</span> <small className="muted">volta no descanso {recargaDe(id, draft.classId, draft.level)}</small></span>
    <span className="row"><button type="button" className="btn-secondary" disabled={r.remaining === 0} aria-label={`Usar ${rotulo}`} onClick={() => onChange(usarRecurso(draft, sheet, id, 1))}>Usar</button>
      <button type="button" className="btn-secondary" disabled={!r.spent} aria-label={`Recuperar ${rotulo}`} onClick={() => onChange(usarRecurso(draft, sheet, id, -1))}>Recuperar</button></span></li>; };

  return <div className="ficha-colunas">
    <section className="ficha-bloco ficha-larga" aria-label="Ataques">
      <h2>Ataques {ataqueTemp !== 0 && <small className="ficha-temp">{sinal(ataqueTemp)} temporário no ataque</small>}</h2>
      {stats.attacks.length + estado.ataques.length > 0 ? <ul className="ficha-linhas">
        {stats.attacks.map((a, i) => <li key={a.id + i}><span><strong>{a.name}</strong>{!a.proficient && <small className="muted"> sem proficiência</small>}{a.heavyDisadvantage && <small className="muted"> arma pesada: desvantagem para tamanho Pequeno</small>}</span>
          <span>{sinal(a.bonus + ataqueTemp)} · {a.damage} {sinal(a.damageBonus)}</span></li>)}
        {estado.ataques.map(a => <li key={a.id}><span><strong>{a.nome}</strong> <small className="muted">personalizado{a.notas ? ` · ${a.notas}` : ""}</small></span>
          <span>{[a.bonus, a.dano].filter(Boolean).join(" · ")} <button type="button" className="ficha-remover" aria-label={`Remover ataque ${a.nome}`} onClick={() => onChange(comEstado(draft, { ataques: estado.ataques.filter(x => x.id !== a.id) }))}><X size={14} aria-hidden="true"/></button></span></li>)}
      </ul> : <p className="muted">Equipe uma arma no Inventário ou crie um ataque personalizado.</p>}
      <NovoAtaque draft={draft} estado={estado} onChange={onChange}/>
    </section>

    {temMagia && <section className="ficha-bloco ficha-larga" aria-label="Magias">
      <h2>Magias</h2>
      {stats.spellDc != null && <p><strong>CD das magias:</strong> {stats.spellDc} · <strong>Ataque mágico:</strong> {sinal((stats.spellAttack ?? 0) + ataqueTemp)}</p>}
      {espacos.length > 0 && <ul className="ficha-linhas" aria-label="Espaços de magia">{espacos.map(([id]) => usos(id, resourceLabel2014(id)))}</ul>}
      {circulos.map(n => <div key={n} className="ficha-circulo"><h3>{n === 0 ? "Truques" : `${n}º círculo`}</h3>
        {magias.filter(m => m.magia.level === n).map(({ magia, origens }) => <details key={magia.id}><summary><span>{magia.name}</span> <small className="muted">{origens.join(", ")}{magia.ritual ? " · ritual" : ""}</small></summary>
          {magia.details && <p className="muted">{magia.details}</p>}<p className="ficha-texto">{magia.description}</p></details>)}</div>)}
      {magias.length === 0 && <p className="muted">Nenhuma magia escolhida. Use Editar personagem para escolher.</p>}
    </section>}

    {recursos.length > 0 && <section className="ficha-bloco" aria-label="Recursos de classe e raça">
      <h2>Recursos</h2>
      <ul className="ficha-linhas">{recursos.map(([id]) => usos(id, resourceLabel2014(id)))}</ul>
    </section>}

    {sheet.features.length > 0 && <section className="ficha-bloco" aria-label="Características de classe e subclasse">
      <h2>Classe e subclasse</h2>
      {sheet.features.map((f, i) => <Caracteristica key={f + i} nome={label2014(f) === f ? rotuloOpcao(f) : label2014(f)} texto={featureDescription2014(f)}/>)}
    </section>}

    {raciais.length > 0 && <section className="ficha-bloco" aria-label="Traços raciais">
      <h2>Traços raciais</h2>
      {raciais.map(t => <Caracteristica key={t.index} nome={t.name} texto={t.desc.join("\n\n")}/>)}
    </section>}

    {origem && <section className="ficha-bloco" aria-label="Característica de origem">
      <h2>Origem</h2>
      <Caracteristica nome={label2014(origem)} texto={featureDescription2014(origem)}/>
    </section>}
  </div>;
}

function Caracteristica({ nome, texto }: { nome: string; texto: string }) {
  return texto ? <details><summary>{nome}</summary><p className="ficha-texto">{texto}</p></details> : <p className="ficha-sem-texto">{nome}</p>;
}

function NovoAtaque({ draft, estado, onChange }: Pick<PropsAba, "draft" | "estado" | "onChange">) {
  const [aberto, setAberto] = useState(false), [nome, setNome] = useState(""), [bonus, setBonus] = useState(""), [dano, setDano] = useState(""), [notas, setNotas] = useState("");
  if (!aberto) return <button type="button" className="btn-secondary" onClick={() => setAberto(true)} disabled={estado.ataques.length >= 20}><Plus size={14} aria-hidden="true"/> Ataque personalizado</button>;
  return <form className="ficha-form" onSubmit={e => { e.preventDefault(); if (!nome.trim()) return; onChange(comEstado(draft, { ataques: [...estado.ataques, { id: novoId(), nome: nome.trim(), bonus: bonus.trim(), dano: dano.trim(), ...(notas.trim() ? { notas: notas.trim() } : {}) }] })); setNome(""); setBonus(""); setDano(""); setNotas(""); setAberto(false); }}>
    <input aria-label="Nome do ataque" placeholder="Nome" maxLength={60} value={nome} onChange={e => setNome(e.target.value)}/>
    <input aria-label="Bônus de ataque" placeholder="Bônus (ex.: +5)" maxLength={20} value={bonus} onChange={e => setBonus(e.target.value)}/>
    <input aria-label="Dano do ataque" placeholder="Dano (ex.: 1d8+3 cortante)" maxLength={60} value={dano} onChange={e => setDano(e.target.value)}/>
    <input aria-label="Observações do ataque" placeholder="Observações" maxLength={200} value={notas} onChange={e => setNotas(e.target.value)}/>
    <button type="submit" className="btn-primary" disabled={!nome.trim()}>Adicionar</button>
    <button type="button" className="btn-secondary" onClick={() => setAberto(false)}>Cancelar</button>
  </form>;
}
