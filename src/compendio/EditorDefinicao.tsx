/** Edição de monstros e itens da campanha. Parte sempre de uma definição válida (original, cópia ou modelo em branco),
 *  e o resultado passa pelo mesmo esquema do catálogo antes de gravar. */
import { useState } from 'react';
import { Copy, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useCampaigns } from '../CampaignsContext';
import { Aviso } from '../Diario';
import { Modal } from '../ui/Modal';
import { monstroSchema, tamanhos, tiposDeCriatura, type Monstro } from '../catalogue/sistemas/dnd5e-2014/esquemas';
import { rotuloGrupoAcao, rotuloPericia, rotuloSentido, rotuloTamanho, rotuloTipoCriatura, siglaAtributo } from '../catalogue/sistemas/dnd5e-2014/rotulos';
import { categoriasDeItem, itemSchema, raridades, type SrdItem } from '../catalogue/item-schema';
import { categoriaDoItemRotulo, raridadeRotulo } from '../catalogue/srd-2014-items';
import { avisarConhecimento, useCodexApi, useConhecimento } from './conhecimento';
import { definicaoPadrao, ehCriacao, novoIdPersonalizado, secoesDaDefinicao, type Definicao, type TipoDefinicao } from './definicoes';
import { garantirRegistro } from './RegistrosCampanha';
import { monstroSpec, registroSpec } from './navegacao';
import type { TabSpec } from '../workspace';

const ATRIBUTOS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const GRUPOS = ['ACTION', 'BONUS_ACTION', 'REACTION', 'LEGENDARY_ACTION', 'LAIR_ACTION'] as const;
const DESLOCAMENTOS = [['walk', 'Caminhada'], ['fly', 'Voo'], ['swim', 'Natação'], ['climb', 'Escalada'], ['burrow', 'Escavação']] as const;
const DEFESAS = [['vulnerabilidadesTexto', 'Vulnerabilidades'], ['resistenciasTexto', 'Resistências'], ['imunidadesTexto', 'Imunidades a dano'], ['condicoesTexto', 'Imunidades a condições']] as const;
const SENTIDOS = ['visaoNoEscuro', 'percepcaoAsCegas', 'sentidoSismico', 'visaoVerdadeira'] as const;
const PERICIAS = ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival'] as const;
/** Define ou remove uma entrada numérica; registro vazio deixa de existir. */
export function comValor(registro: Partial<Record<string, number>> | undefined, chave: string, valor: string): Record<string, number> | undefined {
  const novo = { ...(registro as Record<string, number> | undefined) };
  if (valor === '') delete novo[chave]; else novo[chave] = Number(valor);
  return Object.keys(novo).length ? novo : undefined;
}
const MAGICOS: readonly string[] = ['magico', 'pocao', 'pergaminho'];
const metros = (pes: number | undefined) => (pes ? String(Math.round(pes * 3) / 10) : '');
const pes = (m: string) => Math.round(Number(m.replace(',', '.')) / 0.3);

const monstroEmBranco = (id: string): Monstro => ({
  id, en: 'Custom', nome: '', traduzido: true, tipo: 'humanoid', tamanho: 'medium', nd: 0, xp: 0, tendencia: '', tendenciaEn: '', ca: 10, pv: 1, dadosVida: '1d8',
  deslocamento: { walk: 30 }, atributos: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, percepcaoPassiva: 10, sentidos: {}, idiomas: '',
  defesas: { resistencias: [], imunidades: [], vulnerabilidades: [], condicoes: [], resistenciasTexto: '', imunidadesTexto: '', vulnerabilidadesTexto: '', condicoesTexto: '' },
  ambientes: [], tracos: [], acoes: [], origem: 'srd-2014',
});
const itemEmBranco = (id: string): SrdItem => ({ id, en: 'Custom', nome: '', categoria: 'equipamento', raridade: 'mundano' });
export const definicaoEmBranco = (kind: TipoDefinicao): Definicao => {
  const id = novoIdPersonalizado();
  return kind === 'monster' ? { kind, id, nome: '', monstro: monstroEmBranco(id) } : { kind, id, nome: '', item: itemEmBranco(id) };
};

/** Ajusta os blocos exigidos pela categoria, para o item continuar válido ao trocar de tipo. */
export function comCategoria(item: SrdItem, categoria: SrdItem['categoria']): SrdItem {
  const { arma, armadura, pacote, raridade, ...resto } = item;
  const novo: SrdItem = { ...resto, categoria, raridade: MAGICOS.includes(categoria) ? (raridade === 'mundano' ? 'common' : raridade) : 'mundano' };
  if (categoria === 'arma') novo.arma = arma ?? { categoria: 'simple', alcance: 'melee', propriedades: [], dano: { dado: '1d4', tipo: 'bludgeoning' } };
  if (categoria === 'armadura') novo.armadura = armadura && armadura.categoria !== 'shield' ? armadura : { categoria: 'light', ca: 11, somaDes: true, maxDes: null, forMin: 0, furtividade: false };
  if (categoria === 'escudo') novo.armadura = armadura?.categoria === 'shield' ? armadura : { categoria: 'shield', ca: 2, somaDes: false, maxDes: null, forMin: 0, furtividade: false };
  if (categoria === 'pacote' && pacote) novo.pacote = pacote;
  return novo;
}

export function EditorDefinicao({ inicial, titulo, baseId, onFechar, onSalvo }: {
  inicial: Definicao; titulo: string; baseId?: string; onFechar: () => void; onSalvo: (id: string, registro?: string) => void;
}) {
  const api = useCodexApi(), { active } = useCampaigns(), conhecimento = useConhecimento();
  const [monstro, setMonstro] = useState(inicial.kind === 'monster' ? inicial.monstro : undefined);
  const [item, setItem] = useState(inicial.kind === 'item' ? inicial.item : undefined);
  const [descricao, setDescricao] = useState(inicial.kind === 'item' ? inicial.descricao ?? '' : '');
  const criando = !inicial.campanha;
  const [registrar, setRegistrar] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const m = (patch: Partial<Monstro>) => setMonstro(x => ({ ...x!, ...patch }));
  const i = (patch: Partial<SrdItem>) => setItem(x => ({ ...x!, ...patch }));
  const salvar = async () => {
    if (!api?.saveDefinition || !active) return;
    const bruto: unknown = JSON.parse(JSON.stringify(monstro ?? item));
    const valido = monstro ? monstroSchema.safeParse(bruto) : itemSchema.safeParse(bruto);
    if (!valido.success) { setError('Confira os campos: ' + [...new Set(valido.error.issues.map(x => x.path.join('.') || x.message))].slice(0, 6).join(', ') + '.'); return; }
    const pronta: Definicao = monstro
      ? { kind: 'monster', id: inicial.id, nome: valido.data.nome, monstro: valido.data as Monstro }
      : { kind: 'item', id: inicial.id, nome: valido.data.nome, item: valido.data as SrdItem, descricao: descricao.trim() || undefined };
    setBusy(true); setError('');
    try {
      const padrao = criando && !ehCriacao(inicial.id) ? await definicaoPadrao(inicial.kind, inicial.id) : undefined;
      await api.saveDefinition(active.campaign.id, {
        kind: inicial.kind, definitionId: inicial.id, baseId: baseId ?? inicial.campanha?.baseId, version: inicial.campanha?.version ?? 0,
        data: { definition: valido.data, ...(pronta.kind === 'item' && pronta.descricao ? { descricao: pronta.descricao } : {}) },
      }, secoesDaDefinicao(pronta), padrao?.nome);
      let registro: string | undefined;
      if (registrar) registro = await garantirRegistro(api, active.campaign.id, conhecimento.items, inicial.kind, inicial.id);
      avisarConhecimento();
      onSalvo(inicial.id, registro);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };
  const texto = (rotulo: string, value: string, set: (v: string) => void, max = 120) => <label>{rotulo}<input value={value} maxLength={max} onChange={e => set(e.target.value)}/></label>;
  const numero = (rotulo: string, value: number | undefined, set: (v: number) => void) => <label>{rotulo}<input type="number" inputMode="decimal" value={value ?? ''} onChange={e => set(e.target.value === '' ? NaN : Number(e.target.value))}/></label>;
  const lista = (rotulo: string, chave: 'tracos' | 'acoes') => <fieldset className="cd-lista-editor"><legend>{rotulo}</legend>
    {monstro![chave].map((x, n) => <div key={n}>
      {texto('Nome', x.n, v => m({ [chave]: monstro![chave].map((y, k) => k === n ? { ...y, n: v, en: v || y.en, tr: true, orig: undefined } : y) }))}
      <label>Texto<textarea value={x.t} maxLength={3000} onChange={e => m({ [chave]: monstro![chave].map((y, k) => k === n ? { ...y, t: e.target.value, tr: true, orig: undefined, magias: undefined } : y) })}/></label>
      {chave === 'acoes' && <label>Grupo<select value={x.grupo ?? 'ACTION'} onChange={e => m({ acoes: monstro!.acoes.map((y, k) => k === n ? { ...y, grupo: e.target.value as typeof GRUPOS[number] } : y) })}>{GRUPOS.map(g => <option key={g} value={g}>{rotuloGrupoAcao(g)}</option>)}</select></label>}
      <button type="button" className="btn-link" onClick={() => m({ [chave]: monstro![chave].filter((_, k) => k !== n) })}><Trash2 size={14}/> Remover</button>
    </div>)}
    <button type="button" className="btn-link" onClick={() => m({ [chave]: [...monstro![chave], { n: '', en: 'Custom', t: '', tr: true, ...(chave === 'acoes' ? { grupo: 'ACTION' as const } : {}) }] })}><Plus size={14}/> Adicionar</button>
  </fieldset>;
  return <Modal titulo={titulo} onFechar={onFechar} ocupado={busy} largura={640}><section className="codex-editor cd-form" aria-label="Editar definição">
    <p className="muted">Vale somente para esta campanha. O catálogo original não é alterado.</p>
    {monstro && <>
      {texto('Nome', monstro.nome, v => m({ nome: v }))}
      <div className="cd-grade-campos">
        <label>Tipo<select value={monstro.tipo} onChange={e => m({ tipo: e.target.value as Monstro['tipo'] })}>{tiposDeCriatura.map(t => <option key={t} value={t}>{rotuloTipoCriatura(t)}</option>)}</select></label>
        <label>Tamanho<select value={monstro.tamanho} onChange={e => m({ tamanho: e.target.value as Monstro['tamanho'] })}>{tamanhos.map(t => <option key={t} value={t}>{rotuloTamanho(t)}</option>)}</select></label>
        {texto('Tendência', monstro.tendencia, v => m({ tendencia: v }))}
        {numero('Nível de desafio', monstro.nd, v => m({ nd: v }))}
        {numero('XP', monstro.xp, v => m({ xp: v }))}
        {numero('Classe de Armadura', monstro.ca, v => m({ ca: v }))}
        {texto('Detalhe da CA', monstro.caDetalhe ?? '', v => m({ caDetalhe: v || undefined }))}
        {numero('Pontos de vida', monstro.pv, v => m({ pv: v }))}
        {texto('Dados de vida', monstro.dadosVida, v => m({ dadosVida: v }), 20)}
        {numero('Percepção passiva', monstro.percepcaoPassiva, v => m({ percepcaoPassiva: v }))}
        {DESLOCAMENTOS.map(([k, r]) => <label key={k}>{r} (m)<input inputMode="decimal" defaultValue={metros(monstro.deslocamento[k])} onChange={e => { const v = pes(e.target.value); m({ deslocamento: { ...monstro.deslocamento, [k]: v > 0 ? v : undefined } }); }}/></label>)}
        {ATRIBUTOS.map(a => <label key={a}>{siglaAtributo(a)}<input type="number" value={Number.isNaN(monstro.atributos[a]) ? '' : monstro.atributos[a]} onChange={e => m({ atributos: { ...monstro.atributos, [a]: e.target.value === '' ? NaN : Number(e.target.value) } })}/></label>)}
      </div>
      <fieldset className="cd-lista-editor"><legend>Testes de resistência (vazio = sem proficiência)</legend><div className="cd-grade-campos">
        {ATRIBUTOS.map(a => <label key={a}>Resistência {siglaAtributo(a)}<input type="number" value={monstro.salvaguardas?.[a] ?? ''} onChange={e => m({ salvaguardas: comValor(monstro.salvaguardas, a, e.target.value) })}/></label>)}
      </div></fieldset>
      <fieldset className="cd-lista-editor"><legend>Perícias</legend>
        <div className="cd-grade-campos">{Object.entries(monstro.pericias ?? {}).map(([id, v]) => <label key={id}>{rotuloPericia(id)}<span className="cd-linha-olho"><input type="number" aria-label={`Bônus de ${rotuloPericia(id)}`} value={Number.isNaN(v) ? '' : v} onChange={e => m({ pericias: { ...monstro.pericias, [id]: e.target.value === '' ? NaN : Number(e.target.value) } })}/><button type="button" className="cd-icon" aria-label={`Remover perícia ${rotuloPericia(id)}`} onClick={() => m({ pericias: comValor(monstro.pericias, id, '') })}><Trash2 size={14}/></button></span></label>)}</div>
        <label>Adicionar perícia<select value="" onChange={e => { if (e.target.value) m({ pericias: { ...monstro.pericias, [e.target.value]: 0 } }); }}><option value="">Escolher…</option>{PERICIAS.filter(p => monstro.pericias?.[p] === undefined).map(p => <option key={p} value={p}>{rotuloPericia(p)}</option>)}</select></label>
      </fieldset>
      <fieldset className="cd-lista-editor"><legend>Sentidos (metros)</legend><div className="cd-grade-campos">
        {SENTIDOS.map(k => <label key={k}>{rotuloSentido(k)}<input inputMode="decimal" defaultValue={metros(monstro.sentidos[k])} onChange={e => { const v = pes(e.target.value); m({ sentidos: comValor(monstro.sentidos, k, v > 0 ? String(v) : '') ?? {} }); }}/></label>)}
      </div></fieldset>
      {DEFESAS.map(([k, r]) => <div key={k}>{texto(r, monstro.defesas[k], v => m({ defesas: { ...monstro.defesas, [k]: v } }), 500)}</div>)}
      {texto('Idiomas', monstro.idiomas, v => m({ idiomas: v }), 300)}
      {lista('Características', 'tracos')}
      {lista('Ações', 'acoes')}
    </>}
    {item && <>
      {texto('Nome', item.nome, v => i({ nome: v }))}
      <div className="cd-grade-campos">
        <label>Categoria<select value={item.categoria} onChange={e => setItem(comCategoria(item, e.target.value as SrdItem['categoria']))}>{categoriasDeItem.filter(c => c !== 'pacote' || item.pacote).map(c => <option key={c} value={c}>{categoriaDoItemRotulo(c)}</option>)}</select></label>
        {MAGICOS.includes(item.categoria) && <label>Raridade<select value={item.raridade} onChange={e => i({ raridade: e.target.value as SrdItem['raridade'] })}>{raridades.filter(r => r !== 'mundano').map(r => <option key={r} value={r}>{raridadeRotulo(r)}</option>)}</select></label>}
        <label>Peso (kg)<input type="number" min="0" step="0.1" value={item.peso ?? ''} onChange={e => i({ peso: e.target.value === '' ? undefined : Number(e.target.value) })}/></label>
        <label>Custo<input type="number" min="0" value={item.custo?.v ?? ''} onChange={e => i({ custo: e.target.value === '' ? undefined : { v: Number(e.target.value), u: item.custo?.u ?? 'gp' } })}/></label>
        {item.custo && <label>Moeda<select value={item.custo.u} onChange={e => i({ custo: { v: item.custo!.v, u: e.target.value as 'cp' | 'sp' | 'gp' } })}><option value="cp">pc</option><option value="sp">pp</option><option value="gp">po</option></select></label>}
        {item.arma && <>
          <label>Dado de dano<input value={item.arma.dano?.dado ?? ''} maxLength={12} onChange={e => i({ arma: { ...item.arma!, dano: e.target.value ? { ...item.arma!.dano, dado: e.target.value } : undefined } })}/></label>
          <label>Tipo de dano<select value={item.arma.dano?.tipo ?? ''} disabled={!item.arma.dano} onChange={e => i({ arma: { ...item.arma!, dano: { dado: item.arma!.dano!.dado, tipo: (e.target.value || undefined) as 'slashing' | undefined } } })}><option value="">Não definido</option><option value="bludgeoning">contundente</option><option value="piercing">perfurante</option><option value="slashing">cortante</option></select></label>
        </>}
        {item.armadura && numero(item.categoria === 'escudo' ? 'Bônus de CA' : 'Classe de Armadura', item.armadura.ca, v => i({ armadura: { ...item.armadura!, ca: v } }))}
        {texto('Cura (ex.: 2d4+2)', item.cura ?? '', v => i({ cura: v || undefined }), 12)}
      </div>
      <label className="cd-check"><input type="checkbox" checked={!!item.sintonia} onChange={e => i({ sintonia: e.target.checked || undefined })}/> Requer sintonização</label>
      <label>Descrição e efeitos (cargas, conteúdo de carta ou livro…)<textarea value={descricao} maxLength={5000} onChange={e => setDescricao(e.target.value)}/></label>
    </>}
    {criando && <label className="cd-check"><input type="checkbox" checked={registrar} onChange={e => setRegistrar(e.target.checked)}/> {inicial.kind === 'item' ? 'Registrar como descoberta' : 'Registrar na campanha'}</label>}
    {error && <Aviso erro t={error}/>}
    <div className="row">
      <button className="btn-primary" disabled={busy || !(monstro ?? item)!.nome.trim()} onClick={() => void salvar()}>{busy ? 'Salvando…' : 'Salvar'}</button>
      <button className="btn-secondary" disabled={busy} onClick={onFechar}>Cancelar</button>
    </div>
  </section></Modal>;
}

const especificacao = (kind: TipoDefinicao, id: string, nome?: string): TabSpec => kind === 'item' ? { kind: 'item', ref: id, title: nome } : monstroSpec(id, nome);

/** Ações do mestre numa página de item ou monstro: editar na campanha, duplicar, restaurar o padrão ou excluir a criação. */
export function AcoesDefinicao({ definicao, onOpenContent }: { definicao: Definicao; onOpenContent: (s: TabSpec) => void }) {
  const api = useCodexApi(), { active } = useCampaigns();
  const [editor, setEditor] = useState<{ inicial: Definicao; titulo: string; baseId?: string }>(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (active?.role !== 'mestre' || !api?.saveDefinition) return null;
  const { id, kind, campanha } = definicao, criacao = ehCriacao(id);
  const duplicar = () => {
    const novo = novoIdPersonalizado(), nome = `${definicao.nome} (cópia)`.slice(0, 120);
    // A cópia não herda apelidos, formas nem identificadores antigos do original.
    const inicial: Definicao = definicao.kind === 'item'
      ? { kind: 'item', id: novo, nome, item: { ...definicao.item, id: novo, nome, alias: undefined }, descricao: definicao.descricao }
      : { kind: 'monster', id: novo, nome, monstro: { ...definicao.monstro, id: novo, nome, idsAnteriores: undefined, formas: undefined } };
    setEditor({ inicial, titulo: 'Duplicar', baseId: id });
  };
  const remover = async () => {
    if (!campanha || !window.confirm(criacao ? `Excluir "${definicao.nome}" desta campanha?` : `Restaurar o padrão de "${definicao.nome}"? As alterações desta campanha serão descartadas.`)) return;
    setBusy(true); setError('');
    try {
      const padrao = criacao ? undefined : await definicaoPadrao(kind, id);
      await api.removeDefinition!(active.campaign.id, kind, id, campanha.version, padrao && secoesDaDefinicao(padrao), padrao?.nome);
      avisarConhecimento();
      if (criacao) onOpenContent({ kind: 'secao', ref: 'compendio' });
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir.'); }
    finally { setBusy(false); }
  };
  return <div className="cd-definition-actions">
    {campanha && <p className="muted">{criacao ? 'Criação desta campanha.' : 'Personalizado nesta campanha.'}</p>}
    <div className="cd-share-actions">
      <button className="btn-secondary" disabled={busy} onClick={() => setEditor({ inicial: definicao, titulo: 'Editar nesta campanha' })}><Pencil size={15}/> Editar nesta campanha</button>
      <button className="btn-secondary" disabled={busy} onClick={duplicar}><Copy size={15}/> Duplicar</button>
      {campanha && (criacao
        ? <button className="btn-secondary" disabled={busy} onClick={() => void remover()}><Trash2 size={15}/> Excluir criação</button>
        : <button className="btn-secondary" disabled={busy} onClick={() => void remover()}><RotateCcw size={15}/> Restaurar padrão</button>)}
    </div>
    {error && <Aviso erro t={error}/>}
    {editor && <EditorDefinicao {...editor} onFechar={() => setEditor(undefined)} onSalvo={(novo, registro) => {
      setEditor(undefined);
      if (registro) onOpenContent(registroSpec(registro)); else if (novo !== id) onOpenContent(especificacao(kind, novo));
    }}/>}
  </div>;
}

export function CriarDefinicao({ kind, onOpenContent }: { kind: TipoDefinicao; onOpenContent: (s: TabSpec) => void }) {
  const [inicial, setInicial] = useState<Definicao>();
  return <>
    <button type="button" className="btn-primary" onClick={() => setInicial(definicaoEmBranco(kind))}><Plus size={15}/> {kind === 'item' ? 'Criar item' : 'Criar monstro'}</button>
    {inicial && <EditorDefinicao inicial={inicial} titulo={kind === 'item' ? 'Novo item' : 'Novo monstro'} onFechar={() => setInicial(undefined)}
      onSalvo={(id, registro) => { setInicial(undefined); onOpenContent(registro ? registroSpec(registro) : especificacao(kind, id)); }}/>}
  </>;
}
