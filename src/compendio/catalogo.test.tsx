// @vitest-environment jsdom
// Catálogo do Compêndio na navegação real: categorias, esqueleto de carregamento, erro com nova tentativa, pesquisa, filtros por categoria, lista/grade,
// painel de detalhe (magias e monstros) e celular. Os dados são os reais; só o carregamento é controlado nos testes de esqueleto e de erro.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DetalheMonstro } from './DetalheMonstro';
import type { CampaignApi, Membership } from '../campaigns';
import { activeKey } from '../CampaignsContext';
import { categoriaMagias, categoriaMonstros } from '../catalogue/sistemas/dnd5e-2014';
import monstrosJson from '../catalogue/sistemas/dnd5e-2014/data/monstros.json';
import type { Monstro } from '../catalogue/sistemas/dnd5e-2014/esquemas';
import { me, memoryStorage, renderApp } from '../testUtils';

const camp = { id: 'ca', name: 'Mesa dos Dragões', description: 'Desc.', created_at: '' };
const mestre: Membership = { role: 'mestre', campaign: camp };
const apiC = (m: Membership) => ({ list: async () => ({ ok: true, data: [m] }) }) as unknown as CampaignApi;
let mobile = false;

beforeEach(() => {
  mobile = false;
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: mobile && q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  window.history.pushState({}, '', '/'); localStorage.setItem(activeKey(me.id), 'ca');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const menu = () => within(screen.getByRole('navigation', { name: 'Menu principal' }));
const montar = () => renderApp({ api: apiC(mestre) });
const abrirCompendio = async () => { await waitFor(() => expect(menu().getByRole('button', { name: 'Compêndio' })).toBeTruthy()); fireEvent.click(menu().getByRole('button', { name: 'Compêndio' })); await screen.findByRole('heading', { name: 'Compêndio' }); categoria('Itens'); };
const voltarDoCatalogo = () => document.querySelector<HTMLButtonElement>('.compendio.cat .cd-back');
const categoria = (nome: string) => {
  const back = voltarDoCatalogo(); if (back) fireEvent.click(back);
  const area = screen.queryByRole('button', { name: nome === 'Monstros' ? 'Campanha' : 'Regras' }); if (area) fireEvent.click(area);
  fireEvent.click(screen.getByRole('button', { name: new RegExp('^' + (nome === 'Monstros' ? 'Bestiário' : nome) + ' ') }));
};
const abas = () => [...document.querySelectorAll('.flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content')].map(e => e.textContent?.replace(/\s*\(fixada\)$/, ''));
const pesquisar = (t: string) => fireEvent.change(screen.getByLabelText('Pesquisar no Compêndio'), { target: { value: t } });
const resultados = () => within(screen.getByRole('list', { name: 'Resultados do Compêndio' })).queryAllByRole('listitem');
/** Ação discreta da lista do mestre: abre a ficha técnica sem passar pela carta. */
const verFicha = (nome: string) => fireEvent.click(screen.getByRole('button', { name: `Ver ficha de ${nome}` }));
const abaDaFicha = (nome: string) => fireEvent.click(within(screen.getByRole('navigation', { name: 'Seções da ficha' })).getByRole('button', { name: nome }));
/** Cartão pelo texto visível (nome + subtítulo). Sem subtítulo, o nome precisa ser seguido de espaço ou fim (cuidado com nomes que são prefixo de outros). */
const cartao = (nome: string, subtitulo?: string) => screen.getByRole('button', { name: n => (subtitulo ? n.startsWith(`${nome} ${subtitulo}`) : n === nome || n.startsWith(nome + ' ')) });
const filtro = (rotulo: string, valor: string) => { const d = document.querySelector('.cat-filtros') as HTMLDetailsElement; d.open = true; fireEvent.change(screen.getByLabelText(`Filtrar por ${rotulo}`), { target: { value: valor } }); };
const marcar = (rotulo: string) => { const d = document.querySelector('.cat-filtros') as HTMLDetailsElement; d.open = true; fireEvent.click(screen.getByLabelText(rotulo)); };
const contagem = () => /^(\d+) resultado/.exec(screen.getAllByRole('status').map(s => s.textContent ?? '').find(t => /resultado/.test(t)) ?? '')?.[1];

describe('categorias e carregamento', () => {
  it('mostra Itens, Magias e Monstros; Itens abre primeiro e já está pronto (dados em memória, sem esqueleto)', async () => {
    await montar(); await abrirCompendio();
    expect(voltarDoCatalogo()).toBeTruthy();
    expect(screen.queryByTestId('compendio-esqueleto')).toBeNull(); expect(contagem()).toBe('578');
  });

  it('esqueleto enquanto o pedaço de dados baixa, anunciado por texto; depois a lista aparece', async () => {
    let liberar!: () => void;
    vi.spyOn(categoriaMonstros, 'carregar').mockImplementation(() => new Promise(r => { liberar = () => r((monstrosJson as { itens: unknown }).itens as Monstro[]); }));
    await montar(); await abrirCompendio(); categoria('Monstros');
    const esq = await screen.findByTestId('compendio-esqueleto');
    expect(esq.getAttribute('aria-busy')).toBe('true'); expect(within(esq).getByRole('status').textContent).toBe('Carregando monstros…');
    expect(esq.querySelector('ul')?.getAttribute('aria-hidden')).toBe('true');
    liberar();
    await waitFor(() => expect(screen.queryByTestId('compendio-esqueleto')).toBeNull());
    expect(contagem()).toBe('323');
  });

  it('falha ao baixar mostra o erro e "Tentar de novo" recarrega; os dados voltam sem recarregar a página', async () => {
    vi.spyOn(categoriaMagias, 'carregar').mockRejectedValueOnce(new Error('sem rede'));
    await montar(); await abrirCompendio(); categoria('Magias');
    expect(await screen.findByText(/Não foi possível carregar magias/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(contagem()).toBe('319'));
  });
});

describe('magias', () => {
  it('pesquisa por nome em português sem acento e abre o detalhe completo (tempo, alcance em metros, componentes, duração, área, salvaguarda, classes, círculos superiores)', async () => {
    await montar(); await abrirCompendio(); categoria('Magias'); await waitFor(() => expect(contagem()).toBe('319'));
    pesquisar('bola de fogo'); fireEvent.click(cartao('Bola de Fogo', '3º círculo · Evocação'));
    const det = within(await screen.findByRole('article', { name: 'Detalhes de Bola de Fogo' }));
    const fato = (r: string) => det.getByText(r).nextSibling?.textContent;
    expect(fato('Tempo de conjuração')).toBe('1 ação'); expect(fato('Alcance')).toBe('45 m'); expect(fato('Componentes')).toBe('V, S, M (A tiny ball of bat guano and sulfur)');
    expect(fato('Duração')).toBe('Instantânea'); expect(fato('Área')).toBe('Esfera de 6 m de raio'); expect(fato('Teste de resistência')).toBe('Destreza (metade do dano em caso de sucesso)');
    expect(fato('Tipo de dano')).toBe('fogo'); expect(fato('Classes')).toBe('Feiticeiro, Mago');
    expect(det.getByText('3º círculo')).toBeTruthy(); expect(det.getByText('Evocação')).toBeTruthy();
    expect(det.getByRole('region', { name: 'Descrição da magia' }).textContent).toMatch(/explosão de chamas/i);
    expect(det.getByRole('region', { name: 'Em círculos superiores' })).toBeTruthy();
    expect(det.getByText(/srd-2014:spell:fireball:1/)).toBeTruthy();
  });

  it('ritual e concentração aparecem como etiquetas (Detectar Magia)', async () => {
    await montar(); await abrirCompendio(); categoria('Magias'); await waitFor(() => expect(contagem()).toBe('319'));
    pesquisar('detectar magia'); fireEvent.click(cartao('Detectar Magia'));
    const det = within(await screen.findByRole('article', { name: 'Detalhes de Detectar Magia' }));
    expect(det.getByText('Ritual')).toBeTruthy(); expect(det.getByText('Concentração')).toBeTruthy(); expect(det.getByText('Concentração, até 10 minutos')).toBeTruthy();
  });

  it('filtros próprios das magias: círculo, classe, ritual, concentração; contagem de filtros ativos e "Limpar filtros"', async () => {
    await montar(); await abrirCompendio(); categoria('Magias'); await waitFor(() => expect(contagem()).toBe('319'));
    expect(document.querySelector('.cat-filtros summary')?.textContent).toBe('Filtros');
    filtro('círculo', '0'); expect(contagem()).toBe('24');
    filtro('círculo', ''); marcar('Ritual'); expect(contagem()).toBe('29');
    filtro('classe', 'wizard'); expect(Number(contagem())).toBeGreaterThan(0); expect(Number(contagem())).toBeLessThan(29);
    expect(document.querySelector('.cat-filtros summary')?.textContent).toBe('Filtros (2 ativos)');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(contagem()).toBe('319'); expect(document.querySelector('.cat-filtros summary')?.textContent).toBe('Filtros');
    marcar('Concentração'); expect(contagem()).toBe('126');
  });

  it('ordenar por círculo e paginar com "Mostrar mais"', async () => {
    await montar(); await abrirCompendio(); categoria('Magias'); await waitFor(() => expect(contagem()).toBe('319'));
    expect(resultados()).toHaveLength(60);
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'nivel' } });
    expect(resultados()[0].textContent).toMatch(/Truque/);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais' })); expect(resultados()).toHaveLength(120);
  });

  it('nada encontrado: mensagem e contagem zero', async () => {
    await montar(); await abrirCompendio(); categoria('Magias'); await waitFor(() => expect(contagem()).toBe('319'));
    pesquisar('zzzz-inexistente'); expect(screen.getByTestId('compendio-vazio')).toBeTruthy(); expect(contagem()).toBe('0');
  });
});

describe('monstros', () => {
  it('ficha do Goblin: CA, PV, deslocamento só de caminhada, ND, atributos com modificador, características e ações, original em inglês disponível', async () => {
    await montar(); await abrirCompendio(); categoria('Monstros'); await waitFor(() => expect(contagem()).toBe('323'));
    pesquisar('goblin'); verFicha('Goblin');
    const det = within(await screen.findByRole('region', { name: 'Detalhes de Goblin' }));
    const fato = (r: string) => det.getByText(r).nextSibling?.textContent;
    // CA, PV, deslocamento e ND aparecem uma única vez, no cabeçalho
    const topo = (r: string) => { const alvo = within(screen.getByRole('region', { name: 'Resumo da criatura' })).getByText(r).closest('.dnd-indicador')!; return alvo.textContent!.replace(r, ''); };
    expect(topo('CA')).toMatch(/^15/); expect(topo('PV máximos')).toBe('72d6'); expect(topo('Deslocamento')).toBe('9 m'); expect(topo('Nível de desafio')).toBe('1/450 XP');
    expect(det.queryByRole('region', { name: 'Estatísticas' })).toBeNull(); expect(det.queryByText('Pontos de vida')).toBeNull(); expect(det.queryByText('Classe de Armadura')).toBeNull();
    expect(fato('Sentidos')).toBe('visão no escuro 18 m');
    const attrs = [...det.getByRole('region', { name: 'Atributos' }).querySelectorAll('.ficha-atributo')];
    expect(attrs.map(c => c.querySelector('.dnd-nome-longo')?.textContent)).toEqual(['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma']);
    expect(attrs[1].querySelector('.dnd-atributo-valor')?.textContent).toBe('14'); expect(attrs[1].querySelector('.dnd-atributo-mod')?.textContent).toBe('+2');
    expect(attrs[0].querySelector('.dnd-atributo-valor')?.textContent).toBe('8');
    expect(det.getByText(/Idiomas/).nextSibling?.textContent).toBe('Comum, Goblin');
    abaDaFicha('Habilidades');
    expect(within(det.getByRole('region', { name: 'Características' })).getByText(/Escapada Ágil/)).toBeTruthy();
    expect(within(det.getByRole('region', { name: 'Ações' })).getAllByText(/Cimitarra/i).length).toBeGreaterThan(0);
    const original = det.getAllByText('Texto original (inglês)')[0].closest('details') as HTMLDetailsElement; expect(original.textContent).toMatch(/Disengage/);
  });

  it('Dragão Vermelho Adulto tem ações lendárias em seção própria; filtros por ND, tipo e "ações lendárias"', async () => {
    await montar(); await abrirCompendio(); categoria('Monstros'); await waitFor(() => expect(contagem()).toBe('323'));
    pesquisar('dragao vermelho adulto'); verFicha('Dragão Vermelho Adulto');
    const det = within(await screen.findByRole('region', { name: 'Detalhes de Dragão Vermelho Adulto' }));
    const resumo = screen.getByRole('region', { name: 'Resumo da criatura' });
    expect(resumo.textContent).toContain('18.000 XP');
    expect(resumo.textContent).toContain('12 m, voo 24 m, escalada 12 m');
    abaDaFicha('Habilidades'); expect(det.getByRole('region', { name: 'Ações lendárias' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name:'Voltar na aba'}));
    pesquisar(''); filtro('tipo', 'dragon'); expect(contagem()).toBe('43'); marcar('Tem ações lendárias'); filtro('nível de desafio', 'nd17+'); expect(Number(contagem())).toBeGreaterThan(5);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' })); expect(contagem()).toBe('323');
  });

  it('todos os textos estão traduzidos e trazem o original em inglês; texto marcado como não traduzido (dados futuros) aparece com aviso', () => {
    const itens = (monstrosJson as { itens: Monstro[] }).itens;
    const goblin = itens.find(m => m.id === 'goblin')!;
    const { unmount } = render(<DetalheMonstro monstro={goblin}/>);
    expect(screen.queryByText(/Ainda sem tradução/)).toBeNull(); expect(screen.getAllByText('Texto original (inglês)').length).toBeGreaterThan(0);
    unmount();
    const semTraducao: Monstro = { ...goblin, tracos: goblin.tracos.map(t => ({ ...t, tr: false, orig: undefined })), acoes: [] };
    render(<DetalheMonstro monstro={semTraducao}/>);
    expect(screen.getAllByText(/Ainda sem tradução/).length).toBeGreaterThan(0);
  });
});

describe('lista, grade e detalhe', () => {
  it('grade mostra o resumo de cada categoria; lista não', async () => {
    await montar(); await abrirCompendio(); categoria('Magias'); await waitFor(() => expect(contagem()).toBe('319'));
    pesquisar('bola de fogo');
    expect(cartao('Bola de Fogo', '3º círculo').textContent).not.toMatch(/45 m/);
    fireEvent.click(screen.getByRole('button', { name: /Grade/ })); expect(screen.getByRole('list', { name: 'Resultados do Compêndio' }).getAttribute('data-view')).toBe('grade');
    expect(cartao('Bola de Fogo', '3º círculo').textContent).toMatch(/1 ação · 45 m/);
    categoria('Monstros'); fireEvent.click(screen.getByRole('button',{name:'Grade'})); pesquisar('goblin'); expect(cartao('Goblin').textContent).toMatch(/CA 15 · PV 7/);
  });

  it('o estado de cada categoria não vaza para a outra e é preservado ao voltar', async () => {
    await montar(); await abrirCompendio(); categoria('Magias'); await waitFor(() => expect(contagem()).toBe('319'));
    pesquisar('bola de fogo'); filtro('escola', 'evocation');
    categoria('Monstros'); await waitFor(() => expect(contagem()).toBe('323'));
    expect((screen.getByLabelText('Pesquisar no Compêndio') as HTMLInputElement).value).toBe('');
    expect(screen.queryByLabelText('Filtrar por escola')).toBeNull(); expect(screen.getByLabelText('Filtrar por tipo')).toBeTruthy();
    categoria('Itens'); expect(contagem()).toBe('578');
    categoria('Magias'); await waitFor(() => expect((screen.getByLabelText('Pesquisar no Compêndio') as HTMLInputElement).value).toBe('bola de fogo'));
    expect(document.querySelector('.cat-filtros summary')?.textContent).toBe('Filtros (1 ativo)');
  });

  it('o detalhe abre em página própria, sem dividir a lista; abrir de novo não duplica a aba', async () => {
    await montar(); await abrirCompendio(); categoria('Magias'); await waitFor(() => expect(contagem()).toBe('319'));
    pesquisar('egide'); fireEvent.click(cartao('Égide'));
    await screen.findByRole('article', { name: 'Detalhes de Égide' });
    expect(abas()).toEqual(['Mesa dos Dragões', 'Magias']);
    fireEvent.click(screen.getByRole('button', { name: 'Expandir para página completa' }));
    await waitFor(() => expect(abas()).toEqual(['Mesa dos Dragões', 'Égide']));
    expect((await screen.findByRole('article', { name: 'Detalhes de Égide' })).closest('.compendio.cat')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name:'Voltar na aba'}));
    expect((screen.getByLabelText('Pesquisar no Compêndio') as HTMLInputElement).value).toBe('egide');
    fireEvent.click(cartao('Égide')); await screen.findByRole('dialog'); expect(abas().filter(a => a === 'Égide')).toHaveLength(0);
  });

  it('página de item: conteúdo de pacote clicável (mesma definição do criador) e o mestre pode registrar o item como descoberta', async () => {
    await montar(); await abrirCompendio();
    pesquisar('pacote de explorador'); fireEvent.click(cartao('Pacote de Explorador'));
    const det = within(await screen.findByRole('article', { name: 'Detalhes de Pacote de Explorador' }));
    expect(det.getByRole('region', { name: 'Conteúdo do pacote' })).toBeTruthy();
    expect(det.getByRole('button', { name: 'Registrar como descoberta' })).toBeTruthy();
  });
});

describe('acessibilidade (WCAG 2.5.3) e celular', () => {
  const divergentes = (raiz: ParentNode) => [...raiz.querySelectorAll('button[aria-label]')].filter(b => {
    const v = (b.textContent ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR'); return v !== '' && !(b.getAttribute('aria-label') ?? '').toLocaleLowerCase('pt-BR').includes(v);
  }).map(b => `"${b.textContent?.trim()}" → "${b.getAttribute('aria-label')}"`);
  it('cartões não têm aria-label (o nome acessível é o texto visível) e nenhum botão do painel diverge do texto visível', async () => {
    await montar(); await abrirCompendio();
    for (const c of ['Itens', 'Magias', 'Monstros']) { categoria(c); await waitFor(() => expect(resultados().length).toBeGreaterThan(0)); expect(resultados()[0].querySelector('button')?.hasAttribute('aria-label')).toBe(false); }
    const abrirPrimeiro = async () => { fireEvent.click(resultados()[0].querySelector('button')!); const carta = await screen.findByRole('dialog'); await waitFor(() => expect(within(carta).getByRole('article')).toBeTruthy()); return carta; };
    expect(divergentes(await abrirPrimeiro())).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar consulta' }));
    expect(divergentes(document.body.querySelector('.compendio.cat') as HTMLElement)).toEqual([]);
    expect(divergentes(await abrirPrimeiro())).toEqual([]);
  });
  it('controles têm nome acessível: pesquisa, ordenação, filtros, visualização e categorias', async () => {
    await montar(); await abrirCompendio(); categoria('Magias'); await waitFor(() => expect(contagem()).toBe('319'));
    for (const nome of ['Pesquisar no Compêndio', 'Ordenar por', 'Filtrar por círculo', 'Filtrar por escola', 'Filtrar por classe']) expect(screen.getByLabelText(nome)).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Visualização' })).toBeTruthy();
  });
  it('celular: categorias e filtros funcionam na barra inferior e o detalhe volta para a lista', async () => {
    mobile = true; await montar();
    const barra = () => within(screen.getByRole('navigation', { name: 'Navegação mobile' }));
    await waitFor(() => expect(document.querySelector('.mobile-page-title')?.textContent).toBe(camp.name));
    fireEvent.click(barra().getByRole('button', { name: 'Compêndio' })); await screen.findByRole('heading',{name:'Compêndio'});
    categoria('Magias'); await waitFor(() => expect(contagem()).toBe('319'));
    filtro('círculo', '0'); expect(contagem()).toBe('24');
    pesquisar('luz'); fireEvent.click(cartao('Luz')); await screen.findByRole('article', { name: 'Detalhes de Luz' });
    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(document.querySelector<HTMLButtonElement>('.cd-page .cd-back')!);
    await waitFor(() => expect(screen.queryByRole('article')).toBeNull()); expect((screen.getByLabelText('Pesquisar no Compêndio') as HTMLInputElement).value).toBe('luz'); expect(contagem()).not.toBe('319');
  });

  it('monstro -> magia: o nome da magia na conjuração abre a página da magia e a ficha da criatura continua aberta', async () => {
    await montar(); await abrirCompendio(); categoria('Monstros'); await waitFor(() => expect(contagem()).toBe('323'));
    pesquisar('arquimago'); verFicha('Arquimago');
    const ficha = await screen.findByRole('region', { name: 'Detalhes de Arquimago' });
    abaDaFicha('Habilidades');
    fireEvent.click(within(ficha).getByRole('button', { name: 'Abrir a magia parar o tempo' }));
    expect(await screen.findByRole('article', { name: 'Detalhes de Parar o Tempo' })).toBeTruthy();
    await waitFor(() => expect(abas()).toContain('Parar o Tempo'));
    fireEvent.click(screen.getByRole('button', {name:'Voltar na aba'}));
    expect(await screen.findByRole('region', {name:'Detalhes de Arquimago'})).toBeTruthy();
  });

  it('ficha composta mostra as formas com CA, PV, deslocamento e ações; o Burro é marcado como legado (não SRD); toda ficha avisa que a tradução é de IA sem revisão humana', () => {
    const itens = (monstrosJson as { itens: Monstro[] }).itens;
    const { unmount } = render(<DetalheMonstro monstro={itens.find(m => m.id === 'werewolf')!}/>);
    const formas = screen.getByRole('region', { name: 'Formas' }); const tabela = within(formas).getByRole('table');
    expect(within(tabela).getByRole('row', { name: /Forma de lobo 12 58 12 m/ })).toBeTruthy(); expect(within(tabela).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText(/ainda sem revisão humana/)).toBeTruthy(); unmount();
    render(<DetalheMonstro monstro={itens.find(m => m.id === 'donkey')!}/>);
    expect(screen.getByText(/Não confirmado no SRD 5.1/)).toBeTruthy(); expect(screen.queryByText(/licença CC BY 4.0/)).toBeNull(); expect(screen.getByText(/legado:monster:donkey:1/)).toBeTruthy();
  });
});
