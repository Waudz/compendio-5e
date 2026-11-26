// Aba "Habilidades": ataques, conjuração (com a CD de cada origem), características em cartões e recursos. Seções sem conteúdo não
// aparecem. Os valores vêm de `regrasFicha` (motor 2014 + catálogo); os usos são o mesmo estado em qualquer lugar em que aparecem.
import { BookOpen, Dna, Flame, Gift, Plus, Shield, Sparkles, Star, Swords, X } from "lucide-react";
import { useState } from "react";
import { srdItem } from "../catalogue/srd-2014-items";
import { resourceLabel2014, spells2014 } from "../criador/regras-2014";
import { rotuloAtributo } from "../criador/rotulos";
import { ATRIBUTOS_CONJ, comEstado, concedidosAtivos, MAX_CONCEDIDOS, recargaDe, somaTemporaria, usarRecurso, type Concedido, type TipoConcedido } from "./estadoJogo";
import { Marcadores } from "./Marcadores";
import { caracteristicasDaFicha, dadosDaArma, dadosDaMagia, formulaDano, magiasDaFicha, type Caracteristica, type MagiaDaFicha, type OrigemCaracteristica } from "./regrasFicha";
import { novoId, sinal, type PropsAba } from "./tipos";

const ICONE: Record<OrigemCaracteristica, typeof Star> = { Classe: Swords, Subclasse: Shield, "Raça": Dna, Origem: BookOpen, Talento: Star, Concedida: Gift };

export type PropsHabilidades = PropsAba & { /** Só o mestre entrega talentos, magias e habilidades. */ podeConceder?: boolean };

export function AbaHabilidades({ draft, sheet, stats, estado, onChange, podeConceder = false }: PropsHabilidades) {
  const concedidos = concedidosAtivos(draft, estado);
  const magias = magiasDaFicha(draft, sheet, concedidos);
  const caracteristicas = caracteristicasDaFicha(draft, sheet, concedidos);
  const espacos = Object.entries(sheet.resources).filter(([id]) => id.startsWith("spell-slot-")).sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const ligados = new Set(caracteristicas.flatMap(c => c.recursos));
  const soltos = Object.keys(sheet.resources).filter(id => id !== "hit-dice" && !id.startsWith("spell-slot-") && !ligados.has(id));
  const ataqueTemp = somaTemporaria(estado, "attacks");
  const fontes = [...new Map(magias.flatMap(m => (m.fonte && m.cdFixa == null ? [[m.fonte.chave, m.fonte] as const] : []))).values()];
  if (stats.spellDc != null && !fontes.some(f => f.chave === "classe")) {
    const atributo = ATRIBUTOS_CONJ.find(a => 8 + stats.prof + Math.floor((sheet.abilities[a] - 10) / 2) === stats.spellDc) ?? "int";
    fontes.unshift({ chave: "classe", rotulo: "Classe", atributo, cd: stats.spellDc, ataque: stats.spellAttack ?? 0 });
  }
  const temMagia = magias.length > 0 || espacos.length > 0 || stats.spellDc != null;
  const circulos = [...new Set(magias.map(m => m.magia.level))];
  const usos = (id: string) => { const r = sheet.resources[id]; return <Marcadores rotulo={resourceLabel2014(id)} maximo={r.maximum} disponiveis={r.remaining}
    recarga={`descanso ${recargaDe(id, draft.classId, draft.level)}`} onUsar={d => onChange(usarRecurso(draft, sheet, id, d))}/>; };
  const remover = (id: string) => onChange(comEstado(draft, { concedidos: estado.concedidos.filter(c => c.id !== id) }));

  return <div className="ficha-pilha">
    <section className="ficha-bloco" aria-label="Ataques">
      <h2>Ataques {ataqueTemp !== 0 && <small className="ficha-temp">{sinal(ataqueTemp)} temporário no ataque</small>}</h2>
      {stats.attacks.length + estado.ataques.length > 0 ? <ul className="ficha-cartoes">
        {stats.attacks.map((a, i) => { const arma = dadosDaArma(a.id); return <li key={a.id + i} className="ficha-cartao" aria-label={`Ataque: ${a.name}`}>
          <div className="ficha-cartao-topo"><Swords size={16} aria-hidden="true"/><h3>{a.name}</h3></div>
          <dl className="ficha-dados"><dt>Ataque</dt><dd><strong>{sinal(a.bonus + ataqueTemp)}</strong>{!a.proficient && <small className="muted"> sem proficiência</small>}</dd>
            <dt>Dano</dt><dd><strong>{formulaDano(a.damage, a.damageBonus)}</strong>{arma?.tipo ? ` ${arma.tipo}` : ""}{arma?.duasMaos ? ` (${formulaDano(arma.duasMaos, a.damageBonus)} com duas mãos)` : ""}</dd>
            {arma?.alcance && <><dt>Alcance</dt><dd>{arma.alcance}</dd></>}</dl>
          {arma && arma.propriedades.length > 0 && <p className="ficha-etiqueta-linha">{arma.propriedades.join(", ")}</p>}
          {a.heavyDisadvantage && <p className="muted">Arma pesada: desvantagem para tamanho Pequeno.</p>}
        </li>; })}
        {estado.ataques.map(a => <li key={a.id} className="ficha-cartao" aria-label={`Ataque: ${a.nome}`}>
          <div className="ficha-cartao-topo"><Swords size={16} aria-hidden="true"/><h3>{a.nome}</h3><small className="ficha-selo">personalizado</small>
            <button type="button" className="ficha-remover" aria-label={`Remover ataque ${a.nome}`} onClick={() => onChange(comEstado(draft, { ataques: estado.ataques.filter(x => x.id !== a.id) }))}><X size={14} aria-hidden="true"/></button></div>
          <dl className="ficha-dados">{a.bonus && <><dt>Ataque</dt><dd><strong>{a.bonus}</strong></dd></>}{a.dano && <><dt>Dano</dt><dd><strong>{a.dano}</strong></dd></>}</dl>
          {a.notas && <p className="muted">{a.notas}</p>}
        </li>)}
      </ul> : <p className="muted">Equipe uma arma no Inventário ou crie um ataque personalizado.</p>}
      <NovoAtaque draft={draft} estado={estado} onChange={onChange}/>
    </section>

    {temMagia && <section className="ficha-bloco" aria-label="Magias">
      <h2>Magias</h2>
      {fontes.length > 0 && <ul className="ficha-fontes" aria-label="Conjuração">{fontes.map(f => <li key={f.chave}><strong>{f.rotulo}</strong><span>Atributo: {rotuloAtributo(f.atributo)}</span><span>CD de magia <strong>{f.cd}</strong></span><span>Ataque mágico <strong>{sinal(f.ataque + ataqueTemp)}</strong></span></li>)}</ul>}
      {espacos.length > 0 && <ul className="ficha-linhas" aria-label="Espaços de magia">{espacos.map(([id]) => <li key={id} className="ficha-recurso"><strong>{resourceLabel2014(id)}</strong>{usos(id)}</li>)}</ul>}
      {circulos.map(n => <div key={n} className="ficha-circulo"><h3>{n === 0 ? "Truques" : `${n}º círculo`}</h3>
        <ul className="ficha-cartoes">{magias.filter(m => m.magia.level === n).map(m => <CartaoMagia key={m.chave} item={m} ataqueTemp={ataqueTemp} onRemover={podeConceder && m.concedida ? () => remover(m.chave) : undefined}/>)}</ul></div>)}
      {magias.length === 0 && <p className="muted">Nenhuma magia escolhida. Use Editar personagem para escolher.</p>}
    </section>}

    {caracteristicas.length > 0 && <section className="ficha-bloco" aria-label="Características">
      <h2>Características e habilidades</h2>
      <ul className="ficha-cartoes">{caracteristicas.map(c => <CartaoCaracteristica key={c.chave} item={c} usos={usos}
        onRemover={podeConceder && estado.concedidos.some(x => x.id === c.chave) ? () => remover(c.chave) : undefined}/>)}</ul>
    </section>}

    {soltos.length > 0 && <section className="ficha-bloco" aria-label="Recursos de classe e raça">
      <h2>Outros recursos</h2>
      <ul className="ficha-linhas">{soltos.map(id => <li key={id} className="ficha-recurso"><strong>{resourceLabel2014(id)}</strong>{usos(id)}</li>)}</ul>
    </section>}

    {podeConceder && <Conceder draft={draft} estado={estado} onChange={onChange}/>}
  </div>;
}

function CartaoCaracteristica({ item, usos, onRemover }: { item: Caracteristica; usos: (id: string) => React.ReactNode; onRemover?: () => void }) {
  const Icone = ICONE[item.origem];
  return <li className="ficha-cartao" aria-label={item.nome}>
    <div className="ficha-cartao-topo"><Icone size={16} aria-hidden="true"/><h3>{item.nome}</h3><small className="ficha-selo">{item.origem}{item.detalheOrigem && item.origem !== "Raça" ? ` · ${item.detalheOrigem}` : ""}</small>
      {onRemover && <button type="button" className="ficha-remover" aria-label={`Retirar ${item.nome}`} onClick={onRemover}><X size={14} aria-hidden="true"/></button>}</div>
    {item.recursos.map(id => <div key={id} className="ficha-recurso">{item.recursos.length > 1 && <span>{resourceLabel2014(id)}</span>}{usos(id)}</div>)}
    {item.valores.length > 0 && <ul className="ficha-valores">{item.valores.map(v => <li key={v}>{v}</li>)}</ul>}
    {item.resumo && <p className="muted">{item.resumo}</p>}
    {item.descricao && item.descricao.replace(/\s+/g, " ").trim() !== item.resumo && <details><summary>Descrição completa<span className="sr-only"> de {item.nome}</span></summary><p className="ficha-texto">{item.descricao}</p></details>}
  </li>;
}

function CartaoMagia({ item, ataqueTemp, onRemover }: { item: MagiaDaFicha; ataqueTemp: number; onRemover?: () => void }) {
  const { magia, fonte, origem } = item, d = dadosDaMagia(magia);
  const cd = item.cdFixa ?? fonte?.cd, ataque = item.ataqueFixo ?? fonte?.ataque;
  const linha = [d.salvaguarda && `Salvaguarda de ${d.salvaguarda}${cd != null ? ` · CD ${cd}` : ""}`, d.ataque && ataque != null && `Ataque mágico ${sinal(ataque + ataqueTemp)}`, d.dano, d.cura].filter((x): x is string => !!x);
  return <li className="ficha-cartao" aria-label={magia.name}>
    <div className="ficha-cartao-topo">{d.dano ? <Flame size={16} aria-hidden="true"/> : <Sparkles size={16} aria-hidden="true"/>}<h3>{magia.name}</h3><small className="ficha-selo">{origem}{magia.ritual ? " · ritual" : ""}</small>
      {onRemover && <button type="button" className="ficha-remover" aria-label={`Retirar ${magia.name}`} onClick={onRemover}><X size={14} aria-hidden="true"/></button>}</div>
    {linha.length > 0 && <ul className="ficha-valores">{linha.map(v => <li key={v}>{v}</li>)}</ul>}
    <p className="muted">{[d.tempo, d.alcance && `Alcance: ${d.alcance}`, d.duracao && `Duração: ${d.duracao}`, d.consumo].filter(Boolean).join(" · ")}</p>
    <details><summary>Descrição completa<span className="sr-only"> de {magia.name}</span></summary><p className="ficha-texto">{magia.description.replace(/(\d)O\b/g, "$10")}</p></details>
  </li>;
}

function NovoAtaque({ draft, estado, onChange }: Pick<PropsAba, "draft" | "estado" | "onChange">) {
  const [aberto, setAberto] = useState(false), [nome, setNome] = useState(""), [bonus, setBonus] = useState(""), [dano, setDano] = useState(""), [notas, setNotas] = useState("");
  if (!aberto) return <button type="button" className="btn-secondary ficha-discreto" onClick={() => setAberto(true)} disabled={estado.ataques.length >= 20}><Plus size={14} aria-hidden="true"/> Ataque personalizado</button>;
  return <form className="ficha-campos" onSubmit={e => { e.preventDefault(); if (!nome.trim()) return; onChange(comEstado(draft, { ataques: [...estado.ataques, { id: novoId(), nome: nome.trim(), bonus: bonus.trim(), dano: dano.trim(), ...(notas.trim() ? { notas: notas.trim() } : {}) }] })); setNome(""); setBonus(""); setDano(""); setNotas(""); setAberto(false); }}>
    <label>Nome<input aria-label="Nome do ataque" maxLength={60} value={nome} onChange={e => setNome(e.target.value)}/></label>
    <label>Bônus<input aria-label="Bônus de ataque" placeholder="+5" maxLength={20} value={bonus} onChange={e => setBonus(e.target.value)}/></label>
    <label>Dano<input aria-label="Dano do ataque" placeholder="1d8+3 cortante" maxLength={60} value={dano} onChange={e => setDano(e.target.value)}/></label>
    <label>Observações<input aria-label="Observações do ataque" maxLength={200} value={notas} onChange={e => setNotas(e.target.value)}/></label>
    <div className="ficha-campo-largo row"><button type="submit" className="btn-primary" disabled={!nome.trim()}>Adicionar</button><button type="button" className="btn-secondary" onClick={() => setAberto(false)}>Cancelar</button></div>
  </form>;
}

/** Entrega do mestre: talento, magia do catálogo ou habilidade, opcionalmente presa a um item do inventário. */
function Conceder({ draft, estado, onChange }: Pick<PropsAba, "draft" | "estado" | "onChange">) {
  const vazio = { tipo: "habilidade" as TipoConcedido, nome: "", magia: "", origem: "", descricao: "", atributo: "", cd: "", salvaguarda: "", efeito: "", item: "" };
  const [aberto, setAberto] = useState(false), [f, setF] = useState(vazio);
  const muda = (p: Partial<typeof vazio>) => setF(a => ({ ...a, ...p }));
  const magia = f.tipo === "magia" ? spells2014.find(s => s.name.toLocaleLowerCase("pt-BR") === f.magia.trim().toLocaleLowerCase("pt-BR")) : undefined;
  const nome = magia?.name ?? f.nome.trim(), valido = f.tipo === "magia" ? !!magia : !!nome;
  const cheio = estado.concedidos.length >= MAX_CONCEDIDOS;
  if (!aberto) return <button type="button" className="btn-secondary ficha-discreto" disabled={cheio} onClick={() => setAberto(true)}><Gift size={14} aria-hidden="true"/> Conceder talento, magia ou habilidade</button>;
  const enviar = () => {
    if (!valido) return;
    const cd = Number(f.cd);
    const novo: Concedido = { id: novoId(), tipo: f.tipo, nome, origem: f.origem.trim() || "Mestre", ...(magia ? { ref: magia.id } : {}), ...(f.descricao.trim() ? { descricao: f.descricao.trim() } : {}),
      ...(f.atributo ? { atributo: f.atributo as Concedido["atributo"] } : {}), ...(f.cd && Number.isInteger(cd) && cd >= 1 && cd <= 40 ? { cd } : {}), ...(f.salvaguarda ? { salvaguarda: f.salvaguarda } : {}), ...(f.efeito.trim() ? { efeito: f.efeito.trim() } : {}), ...(f.item ? { itemInstancia: f.item } : {}) };
    onChange(comEstado(draft, { concedidos: [...estado.concedidos, novo] })); setF(vazio); setAberto(false);
  };
  return <section className="ficha-bloco" aria-label="Conceder ao personagem">
    <h2>Conceder ao personagem</h2>
    <form className="ficha-campos" onSubmit={e => { e.preventDefault(); enviar(); }}>
      <label>Tipo<select aria-label="Tipo do que será concedido" value={f.tipo} onChange={e => muda({ tipo: e.target.value as TipoConcedido })}><option value="habilidade">Habilidade</option><option value="talento">Talento</option><option value="magia">Magia</option></select></label>
      {f.tipo === "magia" ? <label>Magia do catálogo<input aria-label="Magia concedida" list="ficha-magias" value={f.magia} onChange={e => muda({ magia: e.target.value })}/><datalist id="ficha-magias">{spells2014.map(s => <option key={s.id} value={s.name}/>)}</datalist></label>
        : <label>Nome<input aria-label="Nome do que será concedido" maxLength={80} value={f.nome} onChange={e => muda({ nome: e.target.value })}/></label>}
      <label>Origem<input aria-label="Origem da concessão" placeholder="Mestre, item, bênção..." maxLength={80} value={f.origem} onChange={e => muda({ origem: e.target.value })}/></label>
      <label>Vinculada ao item<select aria-label="Item vinculado" value={f.item} onChange={e => muda({ item: e.target.value })}><option value="">Nenhum (permanente)</option>{draft.inventory.map(i => <option key={i.id} value={i.id}>{i.customName?.toString() || nomeDoItem(i.itemId)}</option>)}</select></label>
      {f.tipo === "magia" && <label>Atributo<select aria-label="Atributo da magia concedida" value={f.atributo} onChange={e => muda({ atributo: e.target.value })}><option value="">O da classe do personagem</option>{ATRIBUTOS_CONJ.map(a => <option key={a} value={a}>{rotuloAtributo(a)}</option>)}</select></label>}
      <label>CD própria (opcional)<input aria-label="CD própria" type="number" min={1} max={40} value={f.cd} onChange={e => muda({ cd: e.target.value })}/></label>
      {f.tipo !== "magia" && <><label>Salvaguarda exigida<select aria-label="Salvaguarda exigida" value={f.salvaguarda} onChange={e => muda({ salvaguarda: e.target.value })}><option value="">Nenhuma</option>{ATRIBUTOS_CONJ.map(a => <option key={a} value={rotuloAtributo(a)}>{rotuloAtributo(a)}</option>)}</select></label>
        <label>Dano, cura ou valor<input aria-label="Efeito numérico" maxLength={200} value={f.efeito} onChange={e => muda({ efeito: e.target.value })}/></label>
        <label className="ficha-campo-largo">Descrição<textarea aria-label="Descrição do que será concedido" maxLength={2000} rows={3} value={f.descricao} onChange={e => muda({ descricao: e.target.value })}/></label></>}
      <div className="ficha-campo-largo row"><button type="submit" className="btn-primary" disabled={!valido}>Conceder</button><button type="button" className="btn-secondary" onClick={() => setAberto(false)}>Cancelar</button></div>
    </form>
  </section>;
}
const nomeDoItem = (id: string) => srdItem(id)?.nome ?? id;
