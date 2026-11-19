// Visualizador leve (somente leitura) do conteúdo em blocos: mostra o conteúdo inteiro de um cartão sem montar o editor.
// Sem dangerouslySetInnerHTML: só elementos React. Links só http(s) e mailto. Cores do BlockNote mapeadas para o tema escuro.
import type { ReactNode } from "react";
import type { BlocoTexto } from "./inicio";

const COR_TEXTO: Record<string, string> = { gray: "#9b9a97", brown: "#c49a82", red: "#ec7b72", orange: "#e8a15a", yellow: "#e9c55f", green: "#64c08a", blue: "#6ea8e8", purple: "#b48be8", pink: "#e98fc3" };
const COR_FUNDO: Record<string, string> = { gray: "#3a3b3d", brown: "#443a35", red: "#4c3030", orange: "#4c3b28", yellow: "#4a4128", green: "#2b4435", blue: "#2a3d55", purple: "#3d3157", pink: "#4d3045" };
const linkSeguro = (h: unknown) => typeof h === "string" && /^(https?:\/\/|mailto:)[^\s]*$/i.test(h) ? h : null;

type Inline = { type?: string; text?: unknown; href?: unknown; content?: unknown; styles?: Record<string, unknown> };

function Inlines({ itens }: { itens: unknown }): ReactNode {
  if (typeof itens === "string") return itens;
  if (!Array.isArray(itens)) return null;
  return itens.map((raw, i) => {
    const it = raw as Inline;
    if (it?.type === "link") { const h = linkSeguro(it.href); const dentro = <Inlines itens={it.content}/>; return h ? <a key={i} href={h} target="_blank" rel="noopener noreferrer">{dentro}</a> : <span key={i}>{dentro}</span>; }
    if (it?.type !== "text") return it && Array.isArray(it.content) ? <Inlines key={i} itens={it.content}/> : null;
    const s = it.styles ?? {}; let n: ReactNode = String(it.text ?? "");
    if (s.code) n = <code>{n}</code>;
    if (s.bold) n = <strong>{n}</strong>;
    if (s.italic) n = <em>{n}</em>;
    if (s.underline) n = <u>{n}</u>;
    if (s.strike) n = <s>{n}</s>;
    const cor = COR_TEXTO[String(s.textColor)], fundo = COR_FUNDO[String(s.backgroundColor)];
    return cor || fundo ? <span key={i} style={{ color: cor, background: fundo }}>{n}</span> : <span key={i}>{n}</span>;
  });
}

type Bloco = BlocoTexto & { props?: Record<string, unknown>; children?: unknown };

function Lista({ blocos, nivel }: { blocos: Bloco[]; nivel: number }) {
  const out: ReactNode[] = []; let numero = 0;
  blocos.forEach((b, i) => {
    if (!b || typeof b !== "object") return;
    const tipo = b.type ?? "", props = b.props ?? {}, filhos = Array.isArray(b.children) ? b.children as Bloco[] : [];
    numero = tipo === "numberedListItem" ? numero + 1 : 0;
    const cor = COR_TEXTO[String(props.textColor)], fundo = COR_FUNDO[String(props.backgroundColor)];
    const estilo = { color: cor, background: fundo, textAlign: ["left", "center", "right", "justify"].includes(String(props.textAlignment)) ? props.textAlignment as "left" : undefined };
    const conteudo = <Inlines itens={b.content}/>;
    let no: ReactNode = null;
    if (tipo === "paragraph") no = <p style={estilo}>{conteudo}</p>;
    else if (tipo === "heading") { const l = Math.min(3, Math.max(1, Number(props.level) || 1)); no = l === 1 ? <h4 className="cl-h1" style={estilo}>{conteudo}</h4> : l === 2 ? <h5 className="cl-h2" style={estilo}>{conteudo}</h5> : <h6 className="cl-h3" style={estilo}>{conteudo}</h6>; }
    else if (tipo === "bulletListItem") no = <div className="cl-item" style={estilo}><span className="cl-marca" aria-hidden="true">•</span><span>{conteudo}</span></div>;
    else if (tipo === "numberedListItem") no = <div className="cl-item" style={estilo}><span className="cl-marca" aria-hidden="true">{numero}.</span><span>{conteudo}</span></div>;
    else if (tipo === "checkListItem") no = <div className="cl-item" style={estilo}><span className="cl-marca" aria-hidden="true">{props.checked ? "☑" : "☐"}</span><span>{conteudo}</span></div>;
    else if (tipo === "quote") no = <blockquote style={estilo}>{conteudo}</blockquote>;
    else if (tipo === "codeBlock") no = <pre><code>{conteudo}</code></pre>;
    else if (b.content) no = <p style={estilo}>{conteudo}</p>;   // tipo desconhecido com texto: mostra o texto
    if (no === null && !filhos.length) return;
    out.push(<div key={i} className="cl-bloco">{no}{filhos.length > 0 && nivel < 8 && <div className="cl-filhos"><Lista blocos={filhos} nivel={nivel + 1}/></div>}</div>);
  });
  return <>{out}</>;
}

/** Conteúdo inteiro, somente leitura. Sem blocos com conteúdo: renderiza nada (o chamador mostra o estado vazio). */
export function ConteudoLeve({ blocos }: { blocos: BlocoTexto[] | null | undefined }) {
  const lista = (blocos ?? []) as Bloco[];
  return <div className="conteudo-leve"><Lista blocos={lista} nivel={0}/></div>;
}
/** Há algo para mostrar? (evita uma caixa vazia em cartões sem texto) */
export const temConteudo = (blocos: BlocoTexto[] | null | undefined) => (blocos ?? []).some(b => !!b && (b.type === "image" || b.type === "table" || (Array.isArray(b.content) && b.content.length > 0) || (Array.isArray((b as Bloco).children) && ((b as Bloco).children as unknown[]).length > 0)));
