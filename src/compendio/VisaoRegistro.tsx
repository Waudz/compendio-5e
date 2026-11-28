/** Carta narrativa de um registro. A mesma composição serve ao mestre, ao jogador e à prévia; o jogador e a prévia
 *  exibem exclusivamente o que veio na projeção do servidor. Criaturas nunca mostram estatísticas aqui. */
import { RotuloVital } from '../npc/ControleVital';
import { useEffect, useState, type ReactNode } from 'react';
import { CircleHelp, Eye, EyeOff } from 'lucide-react';
import { useCampaigns } from '../CampaignsContext';
import { useVersaoRegistros } from '../registrosStore';
import { RetratoQuadrado } from '../RetratoCombate';
import { deBlocos } from '../registros';
import { imagemDoItem, imagemDoMonstro } from '../ficha/imagensCatalogo';
import { CAMPOS, type Campo } from './campos';
import { useCodexApi, type CodexLink, type Conhecimento } from './conhecimento';
import { ImagemConhecida } from './RegistrosCampanha';
import { ListaVinculos } from './Vinculos';
import { DetalheItem } from './DetalheItem';
import { secoesDaDefinicao, useDefinicao } from './definicoes';
import { mesmasSecoes } from './ficha';
import { nomesRegistro, type LinhaCompendio } from './consulta';
import { Carta, FatosCarta, type Fato } from './Carta';
import { separarVinculos } from './relacoes';
import { TextoNarrativo } from './referencias';
import type { TabSpec } from '../workspace';

export function BotaoOlho({ on, rotulo, onClick, disabled }: { on: boolean; rotulo: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="cd-eye" aria-pressed={on} disabled={disabled} aria-label={`${on ? 'Ocultar' : 'Revelar'} ${rotulo}`} title={on ? 'Visível aos jogadores' : 'Oculto dos jogadores'} onClick={onClick}>{on ? <Eye size={15}/> : <EyeOff size={15}/>}</button>;
}

function Posse({ id, versao, children }: { id: string; versao: unknown; children: (nomes: string) => ReactNode }) {
  const api = useCodexApi(), { active } = useCampaigns(), registros = useVersaoRegistros();
  const scope = `${active?.campaign.id}:${id}`;
  const [state, setState] = useState<{ scope: string; data: { id: string; title: string }[] }>();
  useEffect(() => {
    let alive = true;
    if (api && active) void api.holders(active.campaign.id, id).then(data => { if (alive) setState({ scope, data }); }, () => {});
    return () => { alive = false; };
  }, [api, scope, versao, registros]);
  const data = state?.scope === scope ? state.data : [];
  return data.length ? <>{children(data.map(x => x.title).join(', '))}</> : null;
}

export function ImagemRegistro({ entry, tamanho, ampliar }: { entry: Conhecimento; tamanho: number; ampliar?: boolean }) {
  // o título vem da mesma projeção da imagem: na prévia e para o jogador é o nome público
  const titulo = ampliar ? entry.title : undefined;
  if (entry.imagePath) return <ImagemConhecida path={entry.imagePath} framing={entry.framing} tamanho={tamanho} ampliar={titulo}/>;
  const catalogo = !entry.imageDefinitionId || entry.systemId !== 'dnd5e-2014' ? null
    : entry.category === 'monster' ? imagemDoMonstro(entry.imageDefinitionId) : entry.category === 'item' ? imagemDoItem(entry.imageDefinitionId) : null;
  return <RetratoQuadrado src={catalogo} icone={catalogo ? undefined : CircleHelp} tamanho={tamanho} ampliar={titulo}/>;
}

/** Campos curtos que formam a linha abaixo do nome. */
const LINHA: Record<string, string[]> = { npc: ['race'], monster: ['classification'], location: ['type', 'region'], organization: ['type'], discovery: ['type'], item: ['type'] };

export function VisaoRegistro({ entry, versaoPosse = entry, mostrarPosse, links, rows, trilha, topo, acoes, privado, onOpenContent }: {
  entry: Conhecimento;
  versaoPosse?: unknown;
  mostrarPosse: boolean;
  links: CodexLink[];
  rows: readonly LinhaCompendio[];
  trilha?: string; topo?: ReactNode; acoes?: ReactNode;
  /** Visão do mestre: acrescenta as notas privadas e as propriedades completas da definição. */
  privado?: boolean;
  onOpenContent: (s: TabSpec) => void;
}) {
  const campos: Campo[] = CAMPOS[entry.category] ?? [];
  const campo = (id: string) => campos.find(f => f.id === id);
  const valor = (id: string) => (campo(id) ? entry.fields?.[id]?.trim() : '') || '';
  const { vagas } = separarVinculos(entry.category, links);
  const noLinha = LINHA[entry.category] ?? [];
  const linha = noLinha.map(valor).filter(Boolean).join(' · ');
  const apelido = valor('nickname');
  const curtos = campos.filter(f => !f.long && f.id !== 'nickname' && !noLinha.includes(f.id));
  const fatos: Fato[] = [];
  for (const f of curtos) {
    // A relação não duplica o mesmo destino em um fato e na lista de relacionados.
    if (!vagas.some(v=>v.campo===f.id) && valor(f.id)) fatos.push({ k:f.id,rotulo:f.label,valor:valor(f.id) });
  }
  // estado vital: o jogador só o recebe se revelado; 'desconhecido' é um valor, não a falta de informação
  if (entry.category === 'npc' && entry.vitalStatus && entry.vitalStatus!=='vivo') fatos.push({ k: 'vitalStatus', rotulo: 'Estado', valor: <RotuloVital estado={entry.vitalStatus}/> });
  const descricao = deBlocos(entry.description ?? []).trim();
  const longos = campos.filter(f => f.long && f.id !== 'inhabitants' && valor(f.id));
  const textoHabitantes = valor('inhabitants');
  const criatura = entry.category === 'monster';
  // O jogador com identificação completa de um item recebe o ID e vê o mesmo componente da definição.
  const carregada = useDefinicao(entry.category, privado || criatura ? undefined : entry.definitionId, entry.systemId);
  // Se a campanha personalizou a definição, vale a ficha liberada pelo servidor, nunca o original do catálogo.
  const definicao = carregada?.kind === 'item' && (!entry.sheet?.length || mesmasSecoes(secoesDaDefinicao(carregada), entry.sheet)) ? carregada : undefined;
  const secoes = criatura ? [] : entry.sheet ?? [];
  const texto = (t: string) => <TextoNarrativo texto={t} rows={rows} onAbrir={onOpenContent}/>;
  const mostrar = !!(fatos.length || descricao || longos.length || textoHabitantes || secoes.length || definicao || links.length || (privado && entry.secret?.trim()) || (mostrarPosse && entry.category === 'item'));
  return <Carta trilha={trilha ?? nomesRegistro[entry.category]} topo={topo} acoes={acoes} nome={entry.title}
    alcunha={apelido && apelido !== entry.title ? apelido : null} linha={linha || (criatura ? null : entry.category === 'npc' ? null : nomesRegistro[entry.category])}
    formato={entry.category === 'location' ? 'panorama' : entry.category === 'organization' ? 'simbolo' : 'retrato'}
    retratoGrande={entry.category === 'npc' || criatura}
    imagem={<ImagemRegistro entry={entry} tamanho={entry.category === 'npc' || criatura ? 300 : 200} ampliar/>}>
    {mostrar && <>
      <FatosCarta fatos={fatos}/>
      {mostrarPosse && entry.category === 'item' && <Posse id={entry.id} versao={versaoPosse}>{nomes => <p>Com: {nomes}</p>}</Posse>}
      {descricao && texto(descricao)}
      {longos.map(f => <section key={f.id}><h2>{f.label}</h2>{texto(valor(f.id))}</section>)}
      {textoHabitantes && <section aria-label="Sobre os habitantes">
        <h2>Habitantes</h2>
        {textoHabitantes && texto(textoHabitantes)}
      </section>}
      {definicao
        ? <div className="cd-definition"><DetalheItem item={definicao.item} descricao={definicao.descricao} personalizado={!!definicao.campanha} onOpenContent={onOpenContent} mostrarImagem={false}/></div>
        : secoes.length > 0 && <section aria-label={privado ? 'Propriedades' : 'Informações conhecidas'}><h2>{privado ? 'Propriedades' : 'Informações conhecidas'}</h2><dl className="cd-campos">{secoes.map(s => <div key={s.k}><dt>{s.l}</dt><dd>{s.v}</dd></div>)}</dl></section>}
      {links.length > 0 && <section className="cd-relations" aria-label="Registros relacionados">
        <h2>Registros relacionados</h2>
        <ListaVinculos links={links} rows={rows} onOpenContent={onOpenContent}/>
      </section>}
      {privado && !!entry.secret?.trim() && <section className="cd-private"><h2>Observações privadas do mestre</h2><p className="cd-texto">{entry.secret}</p></section>}
    </>}
  </Carta>;
}
