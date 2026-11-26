// Moedas do personagem: só as que a campanha usa, cada uma com ícone, nome, quantidade editável e − / +, e o patrimônio em PO.
import { Coins, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { IconeMoeda } from "./IconeMoeda";
import { formatarOuro, MOEDAS, totalEmOuro, type Carteira, type ChaveMoeda } from "./moedas";

export const MAX_MOEDAS = 10_000_000;

export function CartaoMoedas({ carteira, ativas, onDefinir }: { carteira: Carteira | undefined; ativas: readonly ChaveMoeda[]; onDefinir: (chave: ChaveMoeda, n: number) => void }) {
  const desativadas = MOEDAS.map(m => m.chave).filter(c => !ativas.includes(c) && (carteira?.[c] ?? 0) > 0);
  return <>
    <ul className="moedas">{MOEDAS.filter(m => ativas.includes(m.chave)).map(m => <Linha key={m.chave} chave={m.chave} nome={m.nome} sigla={m.sigla} valor={carteira?.[m.chave] ?? 0} onDefinir={n => onDefinir(m.chave, n)}/>)}</ul>
    <p className="moedas-total"><Coins size={15} aria-hidden="true"/> <span>Patrimônio total</span> <strong data-testid="patrimonio">{formatarOuro(totalEmOuro(carteira, ativas))}</strong></p>
    {desativadas.length > 0 && <p className="muted moedas-nota" data-testid="saldo-desativado">Guardado em moedas que a campanha não usa ({MOEDAS.filter(m => desativadas.includes(m.chave)).map(m => `${carteira![m.chave]} ${m.sigla}`).join(", ")}): {formatarOuro(totalEmOuro(carteira, desativadas))}, fora do patrimônio.</p>}
  </>;
}

/** A quantidade digitada vale ao sair do campo ou com Enter, para não registrar cada tecla no histórico. */
function Linha({ chave, nome, sigla, valor, onDefinir }: { chave: ChaveMoeda; nome: string; sigla: string; valor: number; onDefinir: (n: number) => void }) {
  const [texto, setTexto] = useState(String(valor)), [passoTexto, setPasso] = useState("1");
  useEffect(() => setTexto(String(valor)), [valor]);
  const passo = Number.isSafeInteger(Number(passoTexto)) && Number(passoTexto) > 0 ? Number(passoTexto) : 1;
  const rotulo = `${nome.toLocaleLowerCase("pt-BR")} (${sigla})`;
  const gravar = () => { const n = Number(texto); if (texto.trim() && Number.isSafeInteger(n) && n >= 0 && n <= MAX_MOEDAS) { if (n !== valor) onDefinir(n); } else setTexto(String(valor)); };
  return <li className="moeda">
    <IconeMoeda tipo={chave} tamanho={28}/>
    <span className="moeda-nome">{nome} <small className="muted">{sigla}</small></span>
    <input className="moeda-valor" type="number" inputMode="numeric" min={0} max={MAX_MOEDAS} data-moeda={chave} aria-label={`Moedas de ${rotulo}`} value={texto} onFocus={e => e.target.select()} onChange={e => setTexto(e.target.value)} onBlur={gravar} onKeyDown={e => { if (e.key === "Enter") gravar(); }}/>
    <span className="moeda-controle">
      <button type="button" className="ficha-remover" aria-label={`Remover ${passo} moeda de ${rotulo}`} disabled={valor < passo} onClick={() => onDefinir(valor - passo)}><Minus size={13} aria-hidden="true"/></button>
      <input className="moeda-passo" type="number" inputMode="numeric" min={1} aria-label={`Quantidade a somar ou retirar de ${rotulo}`} value={passoTexto} onFocus={e => e.target.select()} onChange={e => setPasso(e.target.value)} onBlur={() => setPasso(String(passo))}/>
      <button type="button" className="ficha-remover" aria-label={`Adicionar ${passo} moeda de ${rotulo}`} disabled={valor + passo > MAX_MOEDAS} onClick={() => onDefinir(valor + passo)}><Plus size={13} aria-hidden="true"/></button>
    </span>
  </li>;
}
