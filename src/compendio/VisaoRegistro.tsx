/** Página de um registro. A mesma composição serve ao jogador, à prévia e ao mestre; só o mestre recebe `controles`,
 *  e a visão do jogador exibe exclusivamente o que veio na projeção do servidor. */
import { useEffect, useState } from 'react';
import { CircleHelp, Eye, EyeOff } from 'lucide-react';
import { useCampaigns } from '../CampaignsContext';
import { useVersaoRegistros } from '../registrosStore';
import { RetratoQuadrado } from '../RetratoCombate';
import { deBlocos } from '../registros';
import { imagemDoItem, imagemDoMonstro } from '../ficha/imagensCatalogo';
import { CAMPOS, type Campo } from './campos';
import { estaRevelada, gruposDeChaves, type GrupoChaves } from './chaves';
import { useCodexApi, type CodexLink, type Conhecimento } from './conhecimento';
import { ImagemConhecida } from './RegistrosCampanha';
import { ListaVinculos, type ControlesVinculo } from './Vinculos';
import { DetalheMonstro } from './DetalheMonstro';
import { DetalheItem } from './DetalheItem';
import { secoesDaDefinicao, useDefinicao } from './definicoes';
import { mesmasSecoes } from './ficha';
import { nomesRegistro, type LinhaCompendio } from './consulta';
import type { TabSpec } from '../workspace';

export type ControlesRegistro = {
  busy: boolean;
  alternar: (chaves: string[], revelar: boolean) => void;
};

export function BotaoOlho({ on, rotulo, onClick, disabled }: { on: boolean; rotulo: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="cd-eye" aria-pressed={on} disabled={disabled} aria-label={`${on ? 'Ocultar' : 'Revelar'} ${rotulo}`} title={on ? 'Visível aos jogadores' : 'Oculto dos jogadores'} onClick={onClick}>{on ? <Eye size={15}/> : <EyeOff size={15}/>}</button>;
}

function Posse({ id, versao }: { id: string; versao: unknown }) {
  const api = useCodexApi(), { active } = useCampaigns(), registros = useVersaoRegistros();
  const scope = `${active?.campaign.id}:${id}`;
  const [state, setState] = useState<{ scope: string; data: { id: string; title: string }[] }>();
  useEffect(() => {
    let alive = true;
    if (api && active) void api.holders(active.campaign.id, id).then(data => { if (alive) setState({ scope, data }); }, () => {});
    return () => { alive = false; };
  }, [api, scope, versao, registros]);
  const data = state?.scope === scope ? state.data : [];
  return data.length ? <p>Com: {data.map(x => x.title).join(', ')}</p> : null;
}

export function ImagemRegistro({ entry, tamanho }: { entry: Conhecimento; tamanho: number }) {
  if (entry.imagePath) return <ImagemConhecida path={entry.imagePath} framing={entry.framing} tamanho={tamanho}/>;
  const catalogo = !entry.imageDefinitionId || entry.systemId !== 'dnd5e-2014' ? null
    : entry.category === 'monster' ? imagemDoMonstro(entry.imageDefinitionId) : entry.category === 'item' ? imagemDoItem(entry.imageDefinitionId) : null;
  return <RetratoQuadrado src={catalogo} icone={catalogo ? undefined : CircleHelp} tamanho={tamanho}/>;
}

export function VisaoRegistro({ entry, versaoPosse = entry, mostrarPosse, links, rows, controles, controlesVinculo, rodapeVinculos, onOpenContent }: {
  entry: Conhecimento;
  versaoPosse?: unknown;
  mostrarPosse: boolean;
  links: CodexLink[];
  rows: readonly LinhaCompendio[];
  controles?: ControlesRegistro;
  controlesVinculo?: ControlesVinculo;
  rodapeVinculos?: React.ReactNode;
  onOpenContent: (s: TabSpec) => void;
}) {
  const reveladas = entry.revealed ?? [];
  const grupos = controles ? gruposDeChaves(entry) : [];
  const grupo = (id: GrupoChaves['id']) => grupos.find(g => g.id === id);
  const olho = (k: string, rotulo: string) => controles && grupos.some(g => g.chaves.some(c => c.k === k))
    ? <BotaoOlho on={estaRevelada(reveladas, k)} rotulo={rotulo} disabled={controles.busy} onClick={() => controles.alternar([k], !estaRevelada(reveladas, k))}/> : null;
  const olhoSecao = (id: GrupoChaves['id']) => {
    const g = grupo(id);
    if (!controles || !g) return null;
    const todas = g.chaves.every(c => estaRevelada(reveladas, c.k));
    return <BotaoOlho on={todas} rotulo={`seção ${g.titulo}`} disabled={controles.busy} onClick={() => controles.alternar(g.chaves.map(c => c.k), !todas)}/>;
  };
  const campos: Campo[] = CAMPOS[entry.category] ?? [];
  const preenchido = (f: Campo) => !!entry.fields?.[f.id]?.trim();
  const curtos = campos.filter(f => !f.long && f.id !== 'nickname' && preenchido(f));
  const longos = campos.filter(f => f.long && preenchido(f));
  const descricao = deBlocos(entry.description ?? []).trim();
  const apelido = campos.find(f => f.id === 'nickname');
  const habitantes = entry.category === 'location' ? links.filter(l => l.relation === 'Habitante') : [];
  const demais = habitantes.length ? links.filter(l => l.relation !== 'Habitante') : links;
  const textoHabitantes = entry.category === 'location' ? longos.find(f => f.id === 'inhabitants') : undefined;
  // O jogador com identificação completa recebe o ID e vê o mesmo componente da definição.
  const carregada = useDefinicao(entry.category, controles ? undefined : entry.definitionId, entry.systemId);
  // Se a campanha personalizou a definição, vale a ficha liberada pelo servidor, nunca o original do catálogo.
  const definicao = carregada && (!entry.sheet?.length || mesmasSecoes(secoesDaDefinicao(carregada), entry.sheet)) ? carregada : undefined;
  const campoLongo = (f: Campo) => <section key={f.id}><h2>{f.label} {olho(f.id, f.label)}</h2><p className="cd-texto">{entry.fields?.[f.id]}</p></section>;
  return <>
    <div className="cd-identity">
      <div className="cd-identity-image"><ImagemRegistro entry={entry} tamanho={100}/>{olho('image', 'Imagem')}</div>
      <div>
        <h1>{entry.title}</h1>
        {controles && <p className="cd-linha-olho"><small className="muted">Nome verdadeiro</small> {olho('name', 'Nome')}</p>}
        {apelido && preenchido(apelido) && entry.fields!.nickname !== entry.title && <p className="muted cd-linha-olho"><em>{entry.fields!.nickname}</em> {olho('nickname', apelido.label)}</p>}
        <p>{nomesRegistro[entry.category]}</p>
        {mostrarPosse && entry.category === 'item' && <div className="cd-linha-olho"><Posse id={entry.id} versao={versaoPosse}/>{olho('holders', 'Quem está com o item')}</div>}
      </div>
    </div>
    {(descricao || curtos.length > 0) && <section className="cd-description">
      <h2>Descrição {olhoSecao('descricao')}</h2>
      {curtos.length > 0 && <dl className="cd-campos">{curtos.map(f => <div key={f.id}><dt>{f.label} {olho(f.id, f.label)}</dt><dd>{entry.fields?.[f.id]}</dd></div>)}</dl>}
      {descricao && <><div className="cd-linha-olho">{controles && <small className="muted">Texto da descrição</small>}{olho('description', 'Descrição')}</div><p className="cd-texto">{descricao}</p></>}
    </section>}
    {longos.some(f => f !== textoHabitantes) && <div className="cd-detalhes">{controles && <div className="cd-linha-olho"><small className="muted">Detalhes</small>{olhoSecao('detalhes')}</div>}{longos.filter(f => f !== textoHabitantes).map(campoLongo)}</div>}
    {(textoHabitantes || habitantes.length > 0) && <section className="cd-relations" aria-label="Habitantes">
      <h2>Habitantes</h2>
      {textoHabitantes && <><div className="cd-linha-olho">{olho(textoHabitantes.id, textoHabitantes.label)}</div><p className="cd-texto">{entry.fields?.inhabitants}</p></>}
      {habitantes.length > 0 && <ListaVinculos links={habitantes} rows={rows} controles={controlesVinculo} onOpenContent={onOpenContent}/>}
    </section>}
    {controles && !!entry.sheet?.length && <section className="cd-sheet" aria-label={entry.category === 'monster' ? 'Ficha da criatura' : 'Propriedades'}>
      <h2>{entry.category === 'monster' ? 'Ficha da criatura' : 'Propriedades'} {olhoSecao('ficha')}</h2>
      <dl className="cd-campos">{entry.sheet.map(s => <div key={s.k}><dt>{s.l} {olho('sheet:' + s.k, s.l)}</dt><dd>{s.v}</dd></div>)}</dl>
    </section>}
    {!controles && (definicao
      ? <div className="cd-definition">{definicao.kind === 'monster'
        ? <DetalheMonstro monstro={definicao.monstro} mostrarImagem={false} personalizado={!!definicao.campanha} onAbrirMagia={ref => onOpenContent({ kind: 'magia', ref })}/>
        : <DetalheItem item={definicao.item} descricao={definicao.descricao} personalizado={!!definicao.campanha} onOpenContent={onOpenContent} mostrarImagem={false}/>}</div>
      : !!entry.sheet?.length && <section className="cd-sheet" aria-label="Informações conhecidas"><h2>Informações conhecidas</h2><dl className="cd-campos">{entry.sheet.map(s => <div key={s.k}><dt>{s.l}</dt><dd>{s.v}</dd></div>)}</dl></section>)}
    {(demais.length > 0 || controles) && <section className="cd-relations" aria-label="Registros relacionados">
      <h2>Registros relacionados</h2>
      {!links.length && <p className="muted">Nenhum registro relacionado.</p>}
      <ListaVinculos links={demais} rows={rows} controles={controlesVinculo} onOpenContent={onOpenContent}/>
      {rodapeVinculos}
    </section>}
  </>;
}
