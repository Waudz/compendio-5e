// Moedas do personagem: só as que a campanha usa, cada uma com ícone, nome, quantidade editável e − / +, e o patrimônio em PO.
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { IconeMoeda } from "./IconeMoeda";
import { formatarOuro, MOEDAS, totalEmOuro, type Carteira, type ChaveMoeda } from "./moedas";

export const MAX_MOEDAS = 10_000_000;

export function CartaoMoedas({ carteira, ativas, onDefinir }: { carteira: Carteira | undefined; ativas: readonly ChaveMoeda[]; onDefinir: (chave: ChaveMoeda, n: number) => void }) {
  const ocultas = MOEDAS.some(m => !ativas.includes(m.chave) && (carteira?.[m.chave] ?? 0) > 0);
  return <>
    <ul className="moedas">{MOEDAS.filter(m => ativas.includes(m.chave)).map(m => <Linha key={m.chave} chave={m.chave} nome={m.nome} sigla={m.sigla} valor={carteira?.[m.chave] ?? 0} onDefinir={n => onDefinir(m.chave, n)}/>)}</ul>
    <p className="moedas-total"><IconeMoeda tipo="gp" tamanho={16}/> Patrimônio: <strong data-testid="patrimonio">{formatarOuro(totalEmOuro(carteira, ativas))}</strong></p>
    {ocultas && <p className="muted moedas-nota">Há valores antigos em moedas que a campanha não usa. Eles continuam guardados na ficha e não entram no total.</p>}
  </>;
}

/** A quantidade digitada vale ao sair do campo ou com Enter, para não registrar cada tecla no histórico. */
function Linha({ chave, nome, sigla, valor, onDefinir }: { chave: ChaveMoeda; nome: string; sigla: string; valor: number; onDefinir: (n: number) => void }) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  const rotulo = `${nome.toLocaleLowerCase("pt-BR")} (${sigla})`;
  const gravar = () => { const n = Number(texto); if (texto.trim() && Number.isSafeInteger(n) && n >= 0 && n <= MAX_MOEDAS) { if (n !== valor) onDefinir(n); } else setTexto(String(valor)); };
  return <li className="moeda">
    <IconeMoeda tipo={chave} tamanho={24}/>
    <span className="moeda-nome">{nome} <small className="muted">{sigla}</small></span>
    <span className="moeda-controle">
      <button type="button" className="ficha-remover" aria-label={`Remover 1 moeda de ${rotulo}`} disabled={valor <= 0} onClick={() => onDefinir(valor - 1)}><Minus size={13} aria-hidden="true"/></button>
      <input type="number" inputMode="numeric" min={0} max={MAX_MOEDAS} data-moeda={chave} aria-label={`Moedas de ${rotulo}`} value={texto} onFocus={e => e.target.select()} onChange={e => setTexto(e.target.value)} onBlur={gravar} onKeyDown={e => { if (e.key === "Enter") gravar(); }}/>
      <button type="button" className="ficha-remover" aria-label={`Adicionar 1 moeda de ${rotulo}`} disabled={valor >= MAX_MOEDAS} onClick={() => onDefinir(valor + 1)}><Plus size={13} aria-hidden="true"/></button>
    </span>
  </li>;
}
