// Detalhe de uma magia SRD 2014.
import type { Magia } from "../catalogue/sistemas/dnd5e-2014/esquemas";
import { formatarArea, formatarCirculo, formatarComponentes, formatarDuracao, formatarAlcance, formatarTempo } from "../catalogue/sistemas/dnd5e-2014/formatar";
import { rotuloAtributo, rotuloClasse, rotuloEfeitoSalvaguarda, rotuloEscola, rotuloTipoDano } from "../catalogue/sistemas/dnd5e-2014/rotulos";

export function DetalheMagia({ magia: m }: { magia: Magia }) {
  const fatos: [string, string][] = [
    ["Tempo de conjuração", formatarTempo(m.tempo)], ["Alcance", formatarAlcance(m.alcance)], ["Componentes", formatarComponentes(m.componentes, m.material)], ["Duração", formatarDuracao(m.duracao, m.concentracao)],
  ];
  if (m.area) fatos.push(["Área", formatarArea(m.area)]);
  if (m.ataque) fatos.push(["Ataque", m.ataque === "melee" ? "Ataque de magia corpo a corpo" : "Ataque de magia à distância"]);
  if (m.salvaguarda) fatos.push(["Teste de resistência", `${rotuloAtributo(m.salvaguarda.atributo)} (${rotuloEfeitoSalvaguarda(m.salvaguarda.efeito)})`]);
  if (m.dano?.length) fatos.push(["Tipo de dano", m.dano.map(rotuloTipoDano).join(", ")]);
  fatos.push(["Classes", m.classes.length ? m.classes.map(rotuloClasse).join(", ") : "Nenhuma classe do SRD"]);
  return <>
    <p className="cat-etiquetas"><span className="cat-etiqueta">{formatarCirculo(m.nivel)}</span><span className="cat-etiqueta">{rotuloEscola(m.escola)}</span>
      {m.ritual && <span className="cat-etiqueta">Ritual</span>}{m.concentracao && <span className="cat-etiqueta">Concentração</span>}</p>
    <dl className="item-fatos">{fatos.map(([r, v]) => <div key={r}><dt>{r}</dt><dd>{v}</dd></div>)}</dl>
    <section aria-label="Descrição da magia" className="cat-texto">{m.descricao.map((p, i) => <p key={i}>{p}</p>)}</section>
    {m.superiores && <section aria-label="Em círculos superiores" className="cat-texto"><h2>Em círculos superiores</h2><p>{m.superiores}</p></section>}
    <p className="muted fonte">Fonte: SRD 5.1 (2014), licença CC BY 4.0 · identificador <code>{`srd-2014:spell:${m.id}:1`}</code> · nome original: {m.en}. Distâncias em metros (pés × 0,3); textos entre colchetes mantêm o valor original.</p>
  </>;
}
