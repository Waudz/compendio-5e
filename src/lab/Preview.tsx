// PROTÓTIPO: renderizador leve, somente leitura, do JSON de blocos. Evita montar um editor por cartão.
import type { ReactNode } from "react";
import { safeHref, type Inline, type LabBlock } from "./model";

export type RefHandler = (kind: string, refId: string) => void;

function renderInline(items: Inline[] | undefined, onRef?: RefHandler): ReactNode {
  return (items ?? []).map((x, i) => {
    if (x.type === "text") {
      let node: ReactNode = x.text ?? "";
      const s = x.styles ?? {};
      if (s.code) node = <code>{node}</code>;
      if (s.bold) node = <strong>{node}</strong>;
      if (s.italic) node = <em>{node}</em>;
      if (s.underline) node = <u>{node}</u>;
      if (s.strike) node = <s>{node}</s>;
      return <span key={i}>{node}</span>;
    }
    if (x.type === "link") {
      const href = safeHref(x.href);
      return href ? <a key={i} href={href} target="_blank" rel="noopener noreferrer">{renderInline(x.content, onRef)}</a> : <span key={i}>{renderInline(x.content, onRef)}</span>;   // destino inseguro: só o texto
    }
    if (x.type === "ref") {
      const kind = String(x.props?.kind ?? ""), refId = String(x.props?.refId ?? "");
      return <button type="button" key={i} className="lab-ref" data-kind={kind} onClick={() => onRef?.(kind, refId)}>{String(x.props?.label ?? refId)}</button>;
    }
    return null;
  });
}

function renderBlocks(blocks: LabBlock[], onRef?: RefHandler): ReactNode {
  const out: ReactNode[] = []; let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "bulletListItem" || b.type === "numberedListItem") {
      const kind = b.type, items: LabBlock[] = [];
      while (i < blocks.length && blocks[i].type === kind) items.push(blocks[i++]);
      const children = items.map((it, k) => <li key={k}>{renderInline(Array.isArray(it.content) ? it.content : undefined, onRef)}{it.children?.length ? renderBlocks(it.children, onRef) : null}</li>);
      out.push(kind === "bulletListItem" ? <ul key={`l${i}`}>{children}</ul> : <ol key={`l${i}`}>{children}</ol>);
      continue;
    }
    i++;
    const text = Array.isArray(b.content) ? renderInline(b.content, onRef) : null;
    const kids = b.children?.length ? <div className="lab-nest">{renderBlocks(b.children, onRef)}</div> : null;
    if (b.type === "heading") { const lv = Math.min(3, Math.max(1, Number(b.props?.level) || 2)); const H = (`h${lv + 2}`) as "h3"; out.push(<H key={i} className="lab-h">{text}</H>); if (kids) out.push(kids); }
    else if (b.type === "checkListItem") out.push(<div key={i} className="lab-check"><input type="checkbox" checked={b.props?.checked === true} readOnly aria-label="item"/> {text}{kids}</div>);
    else if (b.type === "table" && b.content && !Array.isArray(b.content)) out.push(<table key={i} className="lab-table"><tbody>{b.content.rows.map((r, ri) => <tr key={ri}>{r.cells.map((c, ci) => <td key={ci}>{renderInline(c, onRef)}</td>)}</tr>)}</tbody></table>);
    else out.push(<p key={i}>{text}{kids}</p>);   // parágrafo e qualquer tipo desconhecido: texto simples (nunca falha)
  }
  return out;
}

export function Preview({ blocks, onRef }: { blocks: LabBlock[]; onRef?: RefHandler }) {
  return <div className="lab-preview">{renderBlocks(blocks, onRef)}</div>;
}
