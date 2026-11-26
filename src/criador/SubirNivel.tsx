// Subir de nível: fluxo próprio, separado da edição, mostrando só o que muda no novo nível, com a comparação antes/depois. Nada é
// aplicado até "Confirmar"; a gravação usa a revisão da ficha (alterações concorrentes geram aviso, nunca são sobrescritas) e o PV atual
// acompanha o ganho por operação, sem apagar dano recente do combate.
import { ChevronsUp } from "lucide-react";
import { useMemo, useState } from "react";
import { D20Nivel } from "../dnd/elementos";
import "../dnd/dnd.css";
import "./etapas-criador.css";
import type { CharacterDraft } from "../rules/character-domain";
import { Etapas, type EtapaInfo } from "../ui/Etapas";
import { Choice } from "./Opcoes2014";
import { automaticSpells2014, class2014, featureDescription2014, label2014, resourceLabel2014, selected2014, spells2014 } from "./regras-2014";
import { rotuloAtributo, rotuloOpcao } from "./rotulos";
import { comEscolhas, comparar, escolhasNovas, incompletas, prepararSubida, valorFixoDoDado } from "./subidaDeNivel";

type Passo = "nivel" | "pv" | "escolhas" | "magias" | "revisao";

export function SubirNivel({ atual, ocupado, onCancelar, onConfirmar }: { atual: CharacterDraft; ocupado?: boolean; onCancelar: () => void; onConfirmar: (proximo: CharacterDraft) => void }) {
  const dado = class2014(atual).data.hitDie, nivel = atual.level + 1;
  const [passo, setPasso] = useState<Passo>("nivel");
  const [modo, setModo] = useState<"fixo" | "rolado">("fixo"), [rolagem, setRolagem] = useState("");
  const [escolhas, setEscolhas] = useState<Record<string, string[]>>({});
  const valor = Number(rolagem), rolagemValida = rolagem.trim() !== "" && Number.isInteger(valor) && valor >= 1 && valor <= dado;
  const base = useMemo(() => prepararSubida(atual, modo === "rolado" ? (rolagemValida ? valor : valorFixoDoDado(dado)) : null), [atual, modo, rolagemValida, valor, dado]);
  const proximo = useMemo(() => comEscolhas(base, escolhas), [base, escolhas]);
  const novas = escolhasNovas(atual, proximo);
  const deMagia = novas.filter(c => c.kind === "spell"), outras = novas.filter(c => c.kind !== "spell");
  const c = useMemo(() => comparar(atual, proximo), [atual, proximo]);
  const temMagia = deMagia.length > 0 || c.espacos[0] !== c.espacos[1] || c.recursos.length > 0;
  const faltam = incompletas(proximo, novas);
  const pvPendente = modo === "rolado" && !rolagemValida;

  const mudar = (d: CharacterDraft) => {
    const alteradas = Object.fromEntries(d.decisions.filter(x => JSON.stringify(selected2014(base, x.id)) !== JSON.stringify(x.optionIds)).map(x => [x.id, x.optionIds]));
    setEscolhas(alteradas);
  };
  const etapas: EtapaInfo<Passo>[] = [
    { id: "nivel", nome: "Classe e novo nível", concluida: true },
    { id: "pv", nome: "Pontos de vida", pendencias: pvPendente ? 1 : 0, concluida: !pvPendente },
    { id: "escolhas", nome: "Características e escolhas", pendencias: incompletas(proximo, outras).length, concluida: !incompletas(proximo, outras).length },
    ...(temMagia ? [{ id: "magias" as const, nome: "Magias e recursos", pendencias: incompletas(proximo, deMagia).length, concluida: !incompletas(proximo, deMagia).length }] : []),
    { id: "revisao", nome: "Revisão e confirmação" },
  ];
  const nome = (id: string) => (label2014(id) === id ? rotuloOpcao(id) : label2014(id));
  const antesDepois = (rotulo: string, a: string | number, b: string | number) => <tr key={rotulo} className={a !== b ? "mudou" : ""}><th scope="row">{rotulo}</th><td>{a}</td><td aria-label={`novo: ${b}`}>{b}</td></tr>;
  const comparacao = <table className="subida-tabela"><thead><tr><th scope="col">O que muda</th><th scope="col">Nível {atual.level}</th><th scope="col">Nível {nivel}</th></tr></thead><tbody>
    {antesDepois("PV máximos", c.pv[0], c.pv[1])}
    {antesDepois(`Dados de vida (d${dado})`, c.dadosDeVida[0], c.dadosDeVida[1])}
    {antesDepois("Bônus de proficiência", `+${c.proficiencia[0]}`, `+${c.proficiencia[1]}`)}
    {c.atributos.map(a => antesDepois(rotuloAtributo(a.atributo), a.antes, a.depois))}
    {(c.espacos[0] !== "nenhum" || c.espacos[1] !== "nenhum") && antesDepois("Espaços de magia", c.espacos[0], c.espacos[1])}
    {c.cdMagia[1] != null && antesDepois("CD de magia", c.cdMagia[0] ?? "—", c.cdMagia[1])}
    {c.recursos.map(r => antesDepois(resourceLabel2014(r.id), r.antes ?? "ilimitado", r.depois ?? "ilimitado"))}
  </tbody></table>;
  const caracteristicas = c.novasCaracteristicas.length > 0
    ? <ul className="subida-caracteristicas">{c.novasCaracteristicas.map(id => <li key={id}><details><summary>{nome(id)}{c.daSubclasse.has(id) ? " (subclasse)" : ""}</summary><p className="ficha-texto">{featureDescription2014(id) || "Sem descrição cadastrada."}</p></details></li>)}</ul>
    : <p className="muted">Nenhuma característica nova neste nível.</p>;
  const magiasEscolhidas = deMagia.flatMap(ch => selected2014(proximo, ch.id).filter(id => !selected2014(atual, ch.id).includes(id)).map(id => spells2014.find(s => s.id === id)?.name ?? id));
  const concedidas = automaticSpells2014(proximo).filter(m => !automaticSpells2014(atual).some(x => x.id === m.id)).map(m => m.name);

  return <div className="content criador sistema-dnd subir-nivel">
    <div className="criador-topo"><h1><ChevronsUp size={22} aria-hidden="true"/> Subir de nível</h1><div className="criador-acoes"><button type="button" className="btn-secondary" onClick={onCancelar} disabled={ocupado}>Cancelar</button></div></div>
    <p className="muted">{atual.name || "Personagem"} · {label2014(atual.classId)} · nível {atual.level} para {nivel}</p>
    <Etapas rotulo="Etapas da subida de nível" etapas={etapas} atual={etapas.some(e => e.id === passo) ? passo : "revisao"} onIr={setPasso}
      rodape={<button type="button" className="btn-primary" disabled={ocupado || pvPendente || faltam.length > 0} onClick={() => onConfirmar(proximo)}>{ocupado ? "Aplicando…" : `Confirmar nível ${nivel}`}</button>}>
      {passo === "nivel" && <>
        <div className="subida-niveis"><D20Nivel nivel={atual.level} tamanho={56}/><span aria-hidden="true">→</span><D20Nivel nivel={nivel} tamanho={72}/></div>
        <p>{label2014(atual.classId)} avança do nível {atual.level} para o {nivel}. Inventário, moedas, recursos gastos, história e identidade continuam como estão.</p>
        <p className="muted">A multiclasse ainda não é suportada.</p>
      </>}
      {passo === "pv" && <section className="etapa-detalhes" aria-label="Aumento de pontos de vida">
        <h3>Pontos de vida do nível {nivel}</h3>
        <label>Como calcular<select aria-label="Aumento de PV" value={modo} onChange={e => setModo(e.target.value as "fixo" | "rolado")}><option value="fixo">Valor fixo: {valorFixoDoDado(dado)} (d{dado})</option><option value="rolado">Rolei o dado</option></select></label>
        {modo === "rolado" && <label>Resultado da rolagem (1 a {dado})<input aria-label="Resultado da rolagem de PV" type="number" inputMode="numeric" min={1} max={dado} value={rolagem} onChange={e => setRolagem(e.target.value)}/></label>}
        <p role="status">PV máximos: {c.pv[0]} para <strong>{pvPendente ? "informe a rolagem" : c.pv[1]}</strong> (já com Constituição e bônus de raça ou classe).</p>
      </section>}
      {passo === "escolhas" && <>
        <section className="etapa-detalhes" aria-label="Novas características"><h3>Características novas</h3>{caracteristicas}</section>
        {outras.length > 0 ? <div className="character-2014">{outras.map(ch => <Choice key={ch.id} draft={proximo} choice={ch} onChange={mudar}/>)}</div> : <p className="muted">Nenhuma escolha nova neste nível.</p>}
      </>}
      {passo === "magias" && <>
        {comparacao}
        {deMagia.length > 0 && <div className="character-2014">{deMagia.map(ch => <Choice key={ch.id} draft={proximo} choice={ch} onChange={mudar}/>)}</div>}
        {concedidas.length > 0 && <p>Magias recebidas automaticamente: {concedidas.join(", ")}.</p>}
      </>}
      {passo === "revisao" && <>
        {comparacao}
        <section className="etapa-detalhes" aria-label="Novidades do nível">
          <h3>Novidades</h3>{caracteristicas}
          {magiasEscolhidas.length > 0 && <p>Magias novas: {magiasEscolhidas.join(", ")}.</p>}
          {concedidas.length > 0 && <p>Magias recebidas automaticamente: {concedidas.join(", ")}.</p>}
        </section>
        {(faltam.length > 0 || pvPendente) && <div className="notice" role="alert"><p>Antes de confirmar:</p><ul>
          {pvPendente && <li><button type="button" className="ficha-link" onClick={() => setPasso("pv")}>Informe a rolagem de PV</button></li>}
          {faltam.map(ch => <li key={ch.id}><button type="button" className="ficha-link" onClick={() => setPasso(ch.kind === "spell" ? "magias" : "escolhas")}>{ch.name}: {selected2014(proximo, ch.id).length} de {ch.count}</button></li>)}
        </ul></div>}
      </>}
    </Etapas>
  </div>;
}
