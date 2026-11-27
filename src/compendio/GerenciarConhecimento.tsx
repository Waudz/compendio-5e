/** Modo "Gerenciar conhecimento": os próprios campos da carta, com um olho cada. Tudo é rascunho até salvar; salvar é uma
 *  única operação no servidor (no máximo um aviso) e cancelar não grava nada. */
import { useState, type ReactNode } from 'react';
import { deBlocos } from '../registros';
import { Carta } from './Carta';
import { alternarChaves, estaRevelada, gruposDeChaves, presetBestiario, todasAsChaves, PRESETS_BESTIARIO } from './chaves';
import type { CodexLink, Conhecimento, Divulgacao } from './conhecimento';
import { citaNome, semReferencias } from './referencias';
import { BotaoOlho, ImagemRegistro } from './VisaoRegistro';
import { useUnsavedGuard } from '../unsaved';

export type Rascunho = Pick<Divulgacao, 'visible' | 'revealed'> & { links: Record<string, boolean> };

export function GerenciarConhecimento({ entry, links, busy, origem, topo, onCancelar, onSalvar }: {
  entry: Conhecimento; links: CodexLink[]; busy: boolean;
  /** Aba hospedeira, para proteger alterações não salvas. */
  origem: string; topo?: ReactNode;
  onCancelar: () => void; onSalvar: (r: Rascunho) => void;
}) {
  const inicial = (): Rascunho => ({ visible: entry.visible, revealed: [...(entry.revealed ?? [])].sort(), links: Object.fromEntries(links.map(l => [l.id, !!l.revealed])) });
  const [base] = useState(inicial);
  const [r, setR] = useState(inicial);
  // vínculos que chegam depois da abertura entram com o estado atual, sem apagar o que já foi marcado
  const ligado = (l: CodexLink) => r.links[l.id] ?? !!l.revealed;
  const alterado = r.visible !== base.visible || r.revealed.join() !== base.revealed.join() || links.some(l => ligado(l) !== (base.links[l.id] ?? !!l.revealed));
  useUnsavedGuard(origem, alterado);
  const grupos = gruposDeChaves(entry);
  const chaves = grupos.flatMap(g => g.chaves);
  const total = chaves.length + links.length;
  const reveladas = chaves.filter(c => estaRevelada(r.revealed, c.k)).length + links.filter(ligado).length;
  // nome verdadeiro oculto citado em texto que será revelado: só avisa, o texto continua como o mestre escreveu
  const textoBruto = (k: string) => (k === 'description' ? deBlocos(entry.description ?? []) : k.startsWith('sheet:') ? entry.sheet?.find(s => 'sheet:' + s.k === k)?.v ?? '' : k === 'name' ? '' : entry.fields?.[k] ?? '');
  const vazamentos = estaRevelada(r.revealed, 'name') ? [] : chaves.filter(c => estaRevelada(r.revealed, c.k) && citaNome(textoBruto(c.k), entry.title, entry.id)).map(c => c.l);
  const marcar = (ks: string[], on: boolean) => setR(x => ({ ...x, revealed: alternarChaves(x.revealed, ks, on, entry) }));
  const vincular = (ids: string[], on: boolean) => setR(x => ({ ...x, links: { ...x.links, ...Object.fromEntries(ids.map(id => [id, on])) } }));
  const previa = (k: string): ReactNode => {
    if (k === 'name') return entry.title;
    if (k === 'image') return null;
    if (k === 'description') return semReferencias(deBlocos(entry.description ?? []));
    if (k === 'holders') return 'Personagens que carregam o item';
    if (k.startsWith('sheet:')) return entry.sheet?.find(s => 'sheet:' + s.k === k)?.v;
    return semReferencias(entry.fields?.[k] ?? '');
  };
  const rotulo = (k: string, l: string) => (k === 'name' ? 'Nome verdadeiro' : k === 'image' ? 'Imagem' : l);
  const linhaDe = (id: string, titulo: string, conteudo: ReactNode, on: boolean, nome: string, alternar: () => void, imagem?: ReactNode) =>
    <li key={id} data-revelado={on}>{imagem}<span><strong>{titulo}</strong>{conteudo && <em>{conteudo}</em>}</span><BotaoOlho on={on} rotulo={nome} disabled={busy} onClick={alternar}/></li>;
  const cabecalho = (titulo: string, todos: boolean, alternar: () => void) =>
    <div className="conhecimento-grupo"><span>{titulo}</span><button type="button" className="btn-link" disabled={busy} aria-label={`${todos ? 'Ocultar' : 'Revelar'} seção ${titulo}`} onClick={alternar}>{todos ? 'Ocultar seção' : 'Revelar seção'}</button></div>;
  return <Carta trilha="Gerenciar conhecimento" topo={topo} nome={entry.title} rotulo={`Gerenciar conhecimento de ${entry.title}`}>
    <label className="conhecimento-existencia"><span>Registro conhecido<small>{r.visible ? 'Os jogadores sabem que ele existe.' : 'Os jogadores não sabem que ele existe.'}</small></span>
      <input type="checkbox" role="switch" aria-label="Registro conhecido" checked={r.visible} disabled={busy} onChange={e => setR(x => ({ ...x, visible: e.target.checked }))}/></label>
    <div className="conhecimento-resumo"><span role="status">{reveladas} de {total} informações reveladas</span>
      <button type="button" className="btn-link" disabled={busy} onClick={() => setR({ visible: true, revealed: todasAsChaves(entry), links: Object.fromEntries(links.map(l => [l.id, true])) })}>Revelar tudo</button>
      <button type="button" className="btn-link" disabled={busy} onClick={() => setR(x => ({ ...x, revealed: [], links: Object.fromEntries(links.map(l => [l.id, false])) }))}>Ocultar tudo</button></div>
    {entry.category === 'monster' && <div className="conhecimento-niveis" role="group" aria-label="Níveis do bestiário">{PRESETS_BESTIARIO.map((nome, i) =>
      <button key={nome} type="button" className="btn-secondary" disabled={busy} onClick={() => setR(x => ({ ...x, visible: true, revealed: presetBestiario((i + 1) as 1 | 2 | 3 | 4, entry) }))}>{i + 1} · {nome}</button>)}</div>}
    {vazamentos.length > 0 && <p className="conhecimento-aviso" role="note">O nome verdadeiro está oculto, mas aparece no texto revelado em: {vazamentos.join(', ')}. O texto não será alterado.</p>}
    {grupos.map(g => <section key={g.id} aria-label={g.titulo}>
      {cabecalho(g.titulo, g.chaves.every(c => estaRevelada(r.revealed, c.k)), () => marcar(g.chaves.map(c => c.k), !g.chaves.every(c => estaRevelada(r.revealed, c.k))))}
      <ul className="conhecimento-lista">{g.chaves.map(c => linhaDe(c.k, rotulo(c.k, c.l), previa(c.k), estaRevelada(r.revealed, c.k), c.k === 'name' ? 'Nome' : c.k === 'image' ? 'Imagem' : c.l,
        () => marcar([c.k], !estaRevelada(r.revealed, c.k)), c.k === 'image' ? <ImagemRegistro entry={entry} tamanho={36}/> : undefined))}</ul>
    </section>)}
    {links.length > 0 && <section aria-label="Vínculos">
      {cabecalho('Vínculos', links.every(ligado), () => vincular(links.map(l => l.id), !links.every(ligado)))}
      <ul className="conhecimento-lista">{links.map(l => linhaDe(l.id, l.relation, l.title, ligado(l), `vínculo com ${l.title}`, () => vincular([l.id], !ligado(l))))}</ul>
    </section>}
    <div className="conhecimento-rodape">
      <button type="button" className="btn-secondary" disabled={busy} onClick={onCancelar}>Cancelar</button>
      <button type="button" className="btn-primary" disabled={busy || !alterado} onClick={() => onSalvar({ visible: r.visible, revealed: r.revealed, links: Object.fromEntries(links.map(l => [l.id, ligado(l)])) })}>{busy ? 'Salvando…' : 'Salvar conhecimento'}</button>
    </div>
  </Carta>;
}
