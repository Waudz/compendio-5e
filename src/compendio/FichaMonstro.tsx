/** Ficha técnica de criatura, na mesma família visual da ficha de personagem: cabeçalho compacto, indicadores, cartões de
 *  atributo e abas internas. Só apresentação: os dados e traduções são os da definição. */
import { useState, type ReactNode } from "react";
import "../ficha/ficha.css";
import { Indicador } from "../dnd/elementos";
import { useGestoAbas } from "../ficha/gestoAbas";
import { imagemDoMonstro } from "../ficha/imagensCatalogo";
import { RetratoQuadrado } from "../RetratoCombate";
import type { Monstro } from "../catalogue/sistemas/dnd5e-2014/esquemas";
import { formatarDeslocamento, formatarModificador, formatarND, formatarXP, metros, modificadorDe } from "../catalogue/sistemas/dnd5e-2014/formatar";
import { FichaDoMonstro, FonteDoMonstro, HabilidadesDoMonstro, linhaDeTipo } from "./DetalheMonstro";

export type AbaExtra = { id: "bestiario" | "identidade"; rotulo: string; conteudo: ReactNode };
type Aba = "ficha" | "habilidades" | AbaExtra["id"];

export function FichaMonstro({ monstro: m, nome, retrato, personalizado, memoria, terceira, voltar, acoes, onAbrirMagia }: {
  monstro: Monstro;
  /** Nome exibido (ex.: o do NPC); por padrão, o da criatura. */
  nome?: string; retrato?: ReactNode; personalizado: boolean;
  /** Usuário/campanha/definição: lembra a aba nesta sessão. */
  memoria: string; terceira: AbaExtra; voltar?: ReactNode; acoes?: ReactNode; onAbrirMagia?: (id: string) => void;
}) {
  const abas: [Aba, string][] = [["ficha", "Ficha"], ["habilidades", "Habilidades"], [terceira.id, terceira.rotulo]];
  const chave = `compendio5e:ficha-criatura:${memoria}`;
  const [aba, setAba] = useState<Aba>(() => { try { const v = sessionStorage.getItem(chave); return abas.find(([a]) => a === v)?.[0] ?? "ficha"; } catch { return "ficha"; } });
  const trocar = (a: Aba) => { setAba(a); try { sessionStorage.setItem(chave, a); } catch { /* só não lembra */ } };
  const gesto = useGestoAbas(abas.map(([a]) => a), aba, trocar);
  const titulo = nome ?? m.nome;
  return <div className="content ficha auth wide ficha-jogo ficha-criatura sistema-dnd" {...gesto}>
    {voltar}
    <section className="ficha-cabecalho" aria-label="Resumo da criatura">
      <div className="ficha-identidade">
        <span className="ficha-retrato">{retrato ?? <RetratoQuadrado src={imagemDoMonstro(m.id)} tipo="monstro" tamanho={104}/>}</span>
        <div className="ficha-nomes"><h1>{titulo}</h1>
          {titulo !== m.nome && <p className="identidade-alcunha"><em>{m.nome}</em></p>}
          <p className="ficha-linha-origem">{linhaDeTipo(m)}</p>
          <p className="ficha-linha-nivel">ND {formatarND(m.nd)} · {formatarXP(m.xp)} XP</p>
        </div>
      </div>
      <div className="ficha-numeros">
        <Indicador tipo="ca" rotulo="CA" valor={m.ca}/>
        <Indicador tipo="pv" rotulo="PV máximos" valor={m.pv} extra={<small className="muted">{m.dadosVida}</small>}/>
        <Indicador tipo="deslocamento" rotulo="Deslocamento" valor={m.deslocamento.walk ? metros(m.deslocamento.walk) : "—"} extra={<small className="muted">{formatarDeslocamento(m.deslocamento, m.planar)}</small>}/>
        <Indicador tipo="iniciativa" rotulo="Iniciativa" valor={formatarModificador(modificadorDe(m.atributos.dex))}/>
        <Indicador tipo="percepcao" rotulo="Percepção passiva" valor={m.percepcaoPassiva}/>
        <Indicador tipo="proficiencia" rotulo="Nível de desafio" valor={formatarND(m.nd)}/>
      </div>
    </section>
    <nav className="ficha-subnav" aria-label="Seções da ficha">{abas.map(([a, rotulo]) => <button key={a} type="button" className={aba === a ? "active" : ""} aria-current={aba === a ? "true" : undefined} onClick={() => trocar(a)}>{rotulo}</button>)}</nav>
    <div className="ficha-conteudo" data-aba={aba} role="region" aria-label={`Detalhes de ${titulo}`}>
      {aba === "ficha" && <div className="ficha-pilha"><FichaDoMonstro monstro={m}/>{acoes}<FonteDoMonstro monstro={m} personalizado={personalizado}/></div>}
      {aba === "habilidades" && <div className="ficha-pilha"><HabilidadesDoMonstro monstro={m} onAbrirMagia={onAbrirMagia}/><FonteDoMonstro monstro={m} personalizado={personalizado}/></div>}
      {aba === terceira.id && terceira.conteudo}
    </div>
  </div>;
}
