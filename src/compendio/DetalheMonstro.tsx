import { RetratoQuadrado } from "../RetratoCombate";
// Detalhe (ficha) de um monstro SRD 2014. Textos em português traduzidos pelo tradutor do Compêndio 1.0; o original em inglês fica disponível
// em cada característica/ação traduzida, e o que não pôde ser traduzido com segurança aparece no original, com aviso.
import type { ReactNode } from "react";
import type { Monstro } from "../catalogue/sistemas/dnd5e-2014/esquemas";
import { formatarDeslocamento, formatarModificador, formatarND, formatarPontosDeVida, formatarSentidos, formatarXP, modificadorDe } from "../catalogue/sistemas/dnd5e-2014/formatar";
import { rotuloGrupoAcao, rotuloPericia, rotuloTamanho, rotuloTipoCriatura, siglaAtributo } from "../catalogue/sistemas/dnd5e-2014/rotulos";
import { imagemDoMonstro } from "../ficha/imagensCatalogo";

const ORDEM = ["str", "dex", "con", "int", "wis", "cha"] as const;
const GRUPOS = ["ACTION", "BONUS_ACTION", "REACTION", "LEGENDARY_ACTION", "LAIR_ACTION"] as const;
type Texto = Monstro["tracos"][number];

const ehLetra = (c: string | undefined) => c !== undefined && /\p{L}|-/u.test(c);

/** Transforma os nomes das magias citadas (em minúsculas, como estão no texto) em botões que abrem a magia no catálogo. Texto sem `magias` volta inalterado. */
export function ligarMagias(texto: string, magias: Texto["magias"], onAbrir?: (id: string) => void): ReactNode[] {
  if (!magias || !onAbrir) return [texto];
  const porNome = new Map(magias.map(m => [m.nome, m.id]));
  const nomes = [...porNome.keys()].sort((a, b) => b.length - a.length);   // o nome mais longo primeiro ("detectar magia" antes de "magia")
  const partes: ReactNode[] = []; let ultimo = 0, i = 0;
  while (i < texto.length) {
    const nome = ehLetra(texto[i - 1]) ? undefined : nomes.find(n => texto.startsWith(n, i) && !ehLetra(texto[i + n.length]));
    if (!nome) { i++; continue; }
    if (i > ultimo) partes.push(texto.slice(ultimo, i));
    const id = porNome.get(nome)!;
    partes.push(<button key={`${i}-${id}`} type="button" className="splink" aria-label={`Abrir a magia ${nome}`} onClick={() => onAbrir(id)}>{nome}</button>);
    i += nome.length; ultimo = i;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

function Habilidade({ h, onAbrirMagia }: { h: Texto; onAbrirMagia?: (id: string) => void }) {
  return <div className="cat-habilidade">
    <p><strong>{h.n}.</strong> {h.magias ? h.t.split(/\n/).map((l, i) => <span key={i} className="cat-linha-magias">{ligarMagias(l, h.magias, onAbrirMagia)}</span>) : h.t}</p>
    {h.tr && h.orig && <details className="muted"><summary>Texto original (inglês)</summary><p>{h.orig}</p></details>}
    {!h.tr && <p className="muted cat-sem-traducao">Ainda sem tradução: texto original em inglês.</p>}
  </div>;
}

export function DetalheMonstro({ monstro: m, onAbrirMagia, mostrarImagem=true, personalizado=false }: { monstro: Monstro; onAbrirMagia?: (id: string) => void; mostrarImagem?:boolean; personalizado?:boolean }) {
  const linhas: [string, string][] = [];
  if (m.salvaguardas && Object.keys(m.salvaguardas).length) linhas.push(["Testes de resistência", Object.entries(m.salvaguardas).map(([a, v]) => `${siglaAtributo(a)} ${formatarModificador(v)}`).join(", ")]);
  if (m.pericias && Object.keys(m.pericias).length) linhas.push(["Perícias", Object.entries(m.pericias).map(([a, v]) => `${rotuloPericia(a)} ${formatarModificador(v)}`).join(", ")]);
  if (m.defesas.vulnerabilidadesTexto) linhas.push(["Vulnerabilidades", m.defesas.vulnerabilidadesTexto]);
  if (m.defesas.resistenciasTexto) linhas.push(["Resistências", m.defesas.resistenciasTexto]);
  if (m.defesas.imunidadesTexto) linhas.push(["Imunidades a dano", m.defesas.imunidadesTexto]);
  if (m.defesas.condicoesTexto) linhas.push(["Imunidades a condições", m.defesas.condicoesTexto]);
  linhas.push(["Sentidos", formatarSentidos(m)]);
  if (m.idiomas) linhas.push(["Idiomas", m.idiomas]);
  const imagem = imagemDoMonstro(m.id);
  return <>
    {mostrarImagem&&<div className="catalogo-imagem"><RetratoQuadrado src={imagem} tipo="monstro" tamanho={220}/></div>}
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
    {m.tracos.length > 0 && <section aria-label="Características" className="cat-texto"><h2>Características</h2>{m.tracos.map((t, i) => <Habilidade key={i} h={t} onAbrirMagia={onAbrirMagia}/>)}</section>}
    {GRUPOS.map(g => { const lista = m.acoes.filter(a => (a.grupo ?? "ACTION") === g); return lista.length === 0 ? null :
      <section key={g} aria-label={rotuloGrupoAcao(g)} className="cat-texto"><h2>{rotuloGrupoAcao(g)}</h2>{lista.map((a, i) => <Habilidade key={i} h={a} onAbrirMagia={onAbrirMagia}/>)}</section>; })}
    {m.ambientes.length > 0 && <p className="muted fonte">Ambientes: {m.ambientes.join(", ")}</p>}
    {m.formas && <section aria-label="Formas" className="cat-texto"><h2>Formas</h2>
      <p className="muted">Esta ficha reúne todas as formas. Dados mecânicos de cada uma (a API do SRD as separa):</p>
      <table className="cat-formas"><thead><tr><th scope="col">Forma</th><th scope="col">CA</th><th scope="col">PV</th><th scope="col">Deslocamento</th><th scope="col">Ações</th></tr></thead>
        <tbody>{m.formas.map(f => <tr key={f.id}><th scope="row">{f.rotulo}</th><td>{f.ca}</td><td>{f.pv}</td><td>{formatarDeslocamento(f.deslocamento)}</td>
          <td>{f.acoes.length ? f.acoes.map(a => [...m.acoes, ...m.tracos].find(x => x.en === a)?.n ?? a).join(", ") : "nenhuma"}</td></tr>)}</tbody></table></section>}
    {personalizado ? <p className="muted fonte">Conteúdo desta campanha.</p> : <>
    {m.origem === "legado"
      ? <p className="muted fonte" role="note">Origem: Compêndio 1.0 (legado). <strong>Não confirmado no SRD 5.1</strong>: não é tratado como conteúdo SRD até a origem e a licença serem esclarecidas · identificador <code>{`legado:monster:${m.id}:1`}</code>.</p>
      : <p className="muted fonte">Fonte: SRD 5.1 (2014), licença CC BY 4.0 · identificador <code>{`srd-2014:monster:${m.id}:1`}</code>. Distâncias em metros (pés × 0,3).</p>}
    <p className="muted fonte" role="note">Tradução para o português produzida com apoio de IA (a partir do Compêndio 1.0 e de complementos), <strong>ainda sem revisão humana</strong>. Em caso de dúvida sobre uma regra, vale o texto original em inglês.</p>
    </>}
  </>;
}
