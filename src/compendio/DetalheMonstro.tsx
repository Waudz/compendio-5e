// Detalhe (ficha) de um monstro SRD 2014. Textos em português traduzidos pelo tradutor do Compêndio 1.0; o original em inglês fica disponível
// em cada característica/ação traduzida, e o que não pôde ser traduzido com segurança aparece no original, com aviso.
import type { Monstro } from "../catalogue/sistemas/dnd5e-2014/esquemas";
import { formatarDeslocamento, formatarModificador, formatarND, formatarPontosDeVida, formatarSentidos, formatarXP, modificadorDe } from "../catalogue/sistemas/dnd5e-2014/formatar";
import { rotuloGrupoAcao, rotuloPericia, rotuloTamanho, rotuloTipoCriatura, siglaAtributo } from "../catalogue/sistemas/dnd5e-2014/rotulos";

const ORDEM = ["str", "dex", "con", "int", "wis", "cha"] as const;
const GRUPOS = ["ACTION", "BONUS_ACTION", "REACTION", "LEGENDARY_ACTION", "LAIR_ACTION"] as const;
type Texto = Monstro["tracos"][number];

function Habilidade({ h }: { h: Texto }) {
  return <div className="cat-habilidade">
    <p><strong>{h.n}.</strong> {h.t}</p>
    {h.tr && h.orig && <details className="muted"><summary>Texto original (inglês)</summary><p>{h.orig}</p></details>}
    {!h.tr && <p className="muted cat-sem-traducao">Ainda sem tradução: texto original em inglês.</p>}
  </div>;
}

export function DetalheMonstro({ monstro: m }: { monstro: Monstro }) {
  const linhas: [string, string][] = [];
  if (m.salvaguardas && Object.keys(m.salvaguardas).length) linhas.push(["Salvaguardas", Object.entries(m.salvaguardas).map(([a, v]) => `${siglaAtributo(a)} ${formatarModificador(v)}`).join(", ")]);
  if (m.pericias && Object.keys(m.pericias).length) linhas.push(["Perícias", Object.entries(m.pericias).map(([a, v]) => `${rotuloPericia(a)} ${formatarModificador(v)}`).join(", ")]);
  if (m.defesas.vulnerabilidadesTexto) linhas.push(["Vulnerabilidades", m.defesas.vulnerabilidadesTexto]);
  if (m.defesas.resistenciasTexto) linhas.push(["Resistências", m.defesas.resistenciasTexto]);
  if (m.defesas.imunidadesTexto) linhas.push(["Imunidades a dano", m.defesas.imunidadesTexto]);
  if (m.defesas.condicoesTexto) linhas.push(["Imunidades a condições", m.defesas.condicoesTexto]);
  linhas.push(["Sentidos", formatarSentidos(m)]);
  if (m.idiomas) linhas.push(["Idiomas", m.idiomas]);
  return <>
    <p className="muted cat-linha-tipo">{rotuloTipoCriatura(m.tipo)} {rotuloTamanho(m.tamanho).toLocaleLowerCase("pt-BR")}{m.tendencia ? `, ${m.tendencia.toLocaleLowerCase("pt-BR")}` : ""} · {m.en}</p>
    <dl className="item-fatos">
      <div><dt>Classe de Armadura</dt><dd>{m.ca}{m.caDetalhe ? ` (${m.caDetalhe})` : ""}</dd></div>
      <div><dt>Pontos de vida</dt><dd>{formatarPontosDeVida(m)}</dd></div>
      <div><dt>Deslocamento</dt><dd>{formatarDeslocamento(m.deslocamento, m.planar)}</dd></div>
      <div><dt>Nível de desafio</dt><dd>{formatarND(m.nd)} ({formatarXP(m.xp)} XP)</dd></div>
    </dl>
    <table className="cat-atributos" aria-label="Atributos"><thead><tr>{ORDEM.map(a => <th key={a} scope="col">{siglaAtributo(a)}</th>)}</tr></thead>
      <tbody><tr>{ORDEM.map(a => <td key={a}>{m.atributos[a]} <span className="muted">({formatarModificador(modificadorDe(m.atributos[a]))})</span></td>)}</tr></tbody></table>
    <dl className="cat-linhas">{linhas.map(([r, v]) => <div key={r}><dt>{r}</dt><dd>{v}</dd></div>)}</dl>
    {m.tracos.length > 0 && <section aria-label="Características" className="cat-texto"><h2>Características</h2>{m.tracos.map((t, i) => <Habilidade key={i} h={t}/>)}</section>}
    {GRUPOS.map(g => { const lista = m.acoes.filter(a => (a.grupo ?? "ACTION") === g); return lista.length === 0 ? null :
      <section key={g} aria-label={rotuloGrupoAcao(g)} className="cat-texto"><h2>{rotuloGrupoAcao(g)}</h2>{lista.map((a, i) => <Habilidade key={i} h={a}/>)}</section>; })}
    {m.ambientes.length > 0 && <p className="muted fonte">Ambientes: {m.ambientes.join(", ")}</p>}
    <p className="muted fonte">Fonte: SRD 5.1 (2014), licença CC BY 4.0 · identificador <code>{`srd-2014:monster:${m.id}:1`}</code>. Distâncias em metros (pés × 0,3).</p>
  </>;
}
