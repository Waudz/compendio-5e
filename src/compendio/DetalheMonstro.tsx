// Detalhe (ficha) de um monstro SRD 2014. Textos em português traduzidos pelo tradutor do Compêndio 1.0; o original em inglês fica disponível
// em cada característica/ação traduzida, e o que não pôde ser traduzido com segurança aparece no original, com aviso.
import type { ReactNode } from "react";
import type { Monstro } from "../catalogue/sistemas/dnd5e-2014/esquemas";
import { formatarDeslocamento, formatarModificador, formatarND, formatarPontosDeVida, formatarSentidos, formatarXP, modificadorDe } from "../catalogue/sistemas/dnd5e-2014/formatar";
import { rotuloGrupoAcao, rotuloPericia, rotuloTamanho, rotuloTipoCriatura, siglaAtributo } from "../catalogue/sistemas/dnd5e-2014/rotulos";
import { MolduraAtributo } from "../dnd/elementos";
import { rotuloAtributo } from "../criador/rotulos";

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

export const linhaDeTipo = (m: Monstro) => `${rotuloTipoCriatura(m.tipo)} ${rotuloTamanho(m.tamanho).toLocaleLowerCase("pt-BR")}${m.tendencia ? `, ${m.tendencia.toLocaleLowerCase("pt-BR")}` : ""} · ${m.en}`;

/** Aba "Ficha": atributos, salvaguardas, perícias, defesas, sentidos e demais estatísticas. */
export function FichaDoMonstro({ monstro: m }: { monstro: Monstro }) {
  const bonus = (r: Record<string, number> | undefined, nome: (id: string) => string) => Object.entries(r ?? {}).map(([a, v]) => [nome(a), formatarModificador(v)] as const);
  const salvaguardas = bonus(m.salvaguardas as Record<string, number> | undefined, siglaAtributo), pericias = bonus(m.pericias, rotuloPericia);
  const linhas: [string, string][] = [];
  if (m.defesas.vulnerabilidadesTexto) linhas.push(["Vulnerabilidades", m.defesas.vulnerabilidadesTexto]);
  if (m.defesas.resistenciasTexto) linhas.push(["Resistências", m.defesas.resistenciasTexto]);
  if (m.defesas.imunidadesTexto) linhas.push(["Imunidades a dano", m.defesas.imunidadesTexto]);
  if (m.defesas.condicoesTexto) linhas.push(["Imunidades a condições", m.defesas.condicoesTexto]);
  linhas.push(["Sentidos", formatarSentidos(m)]);
  if (m.idiomas) linhas.push(["Idiomas", m.idiomas]);
  if (m.ambientes.length) linhas.push(["Ambientes", m.ambientes.join(", ")]);
  const pares = (lista: readonly (readonly [string, string])[]) => <ul className="ficha-duas-colunas">{lista.map(([r, v]) => <li key={r}><span className="ficha-marca ativa" aria-hidden="true"/><span>{r}</span><strong>{v}</strong></li>)}</ul>;
  return <>
    <section className="ficha-bloco ficha-bloco-aberto" aria-label="Atributos">
      <h2>Atributos</h2>
      <div className="ficha-atributos">{ORDEM.map(a => <MolduraAtributo key={a} nome={rotuloAtributo(a)} valor={m.atributos[a]} modificador={modificadorDe(m.atributos[a])}/>)}</div>
    </section>
    <section className="ficha-bloco" aria-label="Estatísticas">
      <h2>Estatísticas</h2>
      <dl className="ficha-dados">
        <div className="ficha-par"><dt>Classe de Armadura</dt><dd>{m.ca}{m.caDetalhe ? ` (${m.caDetalhe})` : ""}</dd></div>
        <div className="ficha-par"><dt>Pontos de vida</dt><dd>{formatarPontosDeVida(m)}</dd></div>
        <div className="ficha-par"><dt>Deslocamento</dt><dd>{formatarDeslocamento(m.deslocamento, m.planar)}</dd></div>
        <div className="ficha-par"><dt>Nível de desafio</dt><dd>{formatarND(m.nd)} ({formatarXP(m.xp)} XP)</dd></div>
      </dl>
    </section>
    {salvaguardas.length > 0 && <section className="ficha-bloco" aria-label="Testes de resistência"><h2>Testes de resistência</h2>{pares(salvaguardas)}</section>}
    {pericias.length > 0 && <section className="ficha-bloco" aria-label="Perícias"><h2>Perícias</h2>{pares(pericias)}</section>}
    <section className="ficha-bloco" aria-label="Defesas, sentidos e idiomas">
      <h2>Defesas, sentidos e idiomas</h2>
      <dl className="ficha-dados">{linhas.map(([r, v]) => <div key={r} className="ficha-par"><dt>{r}</dt><dd>{v}</dd></div>)}</dl>
    </section>
  </>;
}

/** Aba "Habilidades": características, ações por grupo e formas alternativas. */
export function HabilidadesDoMonstro({ monstro: m, onAbrirMagia }: { monstro: Monstro; onAbrirMagia?: (id: string) => void }) {
  return <>
    {m.tracos.length > 0 && <section aria-label="Características" className="ficha-bloco cat-texto"><h2>Características</h2>{m.tracos.map((t, i) => <Habilidade key={i} h={t} onAbrirMagia={onAbrirMagia}/>)}</section>}
    {GRUPOS.map(g => { const lista = m.acoes.filter(a => (a.grupo ?? "ACTION") === g); return lista.length === 0 ? null :
      <section key={g} aria-label={rotuloGrupoAcao(g)} className="ficha-bloco cat-texto"><h2>{rotuloGrupoAcao(g)}</h2>{lista.map((a, i) => <Habilidade key={i} h={a} onAbrirMagia={onAbrirMagia}/>)}</section>; })}
    {m.formas && <section aria-label="Formas" className="ficha-bloco cat-texto sem-gesto"><h2>Formas</h2>
      <p className="muted">Esta ficha reúne todas as formas. Dados mecânicos de cada uma (a API do SRD as separa):</p>
      <div className="ficha-tabela"><table className="cat-formas"><thead><tr><th scope="col">Forma</th><th scope="col">CA</th><th scope="col">PV</th><th scope="col">Deslocamento</th><th scope="col">Ações</th></tr></thead>
        <tbody>{m.formas.map(f => <tr key={f.id}><th scope="row">{f.rotulo}</th><td>{f.ca}</td><td>{f.pv}</td><td>{formatarDeslocamento(f.deslocamento)}</td>
          <td>{f.acoes.length ? f.acoes.map(a => [...m.acoes, ...m.tracos].find(x => x.en === a)?.n ?? a).join(", ") : "nenhuma"}</td></tr>)}</tbody></table></div></section>}
  </>;
}

export function FonteDoMonstro({ monstro: m, personalizado = false }: { monstro: Monstro; personalizado?: boolean }) {
  if (personalizado) return <p className="muted fonte">Conteúdo desta campanha.</p>;
  return <>
    {m.origem === "legado"
      ? <p className="muted fonte" role="note">Origem: Compêndio 1.0 (legado). <strong>Não confirmado no SRD 5.1</strong>: não é tratado como conteúdo SRD até a origem e a licença serem esclarecidas · identificador <code>{`legado:monster:${m.id}:1`}</code>.</p>
      : <p className="muted fonte">Fonte: SRD 5.1 (2014), licença CC BY 4.0 · identificador <code>{`srd-2014:monster:${m.id}:1`}</code>. Distâncias em metros (pés × 0,3).</p>}
    <p className="muted fonte" role="note">Tradução para o português produzida com apoio de IA (a partir do Compêndio 1.0 e de complementos), <strong>ainda sem revisão humana</strong>. Em caso de dúvida sobre uma regra, vale o texto original em inglês.</p>
  </>;
}

/** Todas as partes em sequência (sem abas). */
export function DetalheMonstro({ monstro, onAbrirMagia, personalizado = false }: { monstro: Monstro; onAbrirMagia?: (id: string) => void; personalizado?: boolean }) {
  return <><p className="muted cat-linha-tipo">{linhaDeTipo(monstro)}</p><FichaDoMonstro monstro={monstro}/><HabilidadesDoMonstro monstro={monstro} onAbrirMagia={onAbrirMagia}/><FonteDoMonstro monstro={monstro} personalizado={personalizado}/></>;
}
