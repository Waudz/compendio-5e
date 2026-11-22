/** Formatação em português (pt-BR) de campos estruturados de D&D 5e 2014. Distâncias seguem a convenção do projeto: pés × 0,3 = metros (vocabulário "metros"). */
import type { Magia, Monstro } from './esquemas';
import { rotuloArea, rotuloDeslocamento, rotuloSentido } from './rotulos';

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export const metros = (pes: number) => `${num(pes * 0.3)} m`;
const plural = (n: number, singular: string, plur: string) => `${n} ${n === 1 ? singular : plur}`;

export function formatarCirculo(nivel: number) { return nivel === 0 ? 'Truque' : `${nivel}º círculo`; }

export function formatarTempo(t: Magia['tempo']): string {
  switch (t.tipo) {
    case 'action': return plural(t.qtd, 'ação', 'ações');
    case 'bonus-action': return plural(t.qtd, 'ação bônus', 'ações bônus');
    case 'reaction': return plural(t.qtd, 'reação', 'reações');
    case 'minute': return plural(t.qtd, 'minuto', 'minutos');
    case 'hour': return plural(t.qtd, 'hora', 'horas');
  }
}
export function formatarAlcance(a: Magia['alcance']): string {
  switch (a.tipo) {
    case 'self': return 'Pessoal'; case 'touch': return 'Toque'; case 'sight': return 'Linha de visão'; case 'unlimited': return 'Ilimitado'; case 'special': return 'Especial';
    case 'distance': return a.pes !== undefined ? metros(a.pes) : `${num((a.milhas ?? 0) * 1.6)} km`;
  }
}
export function formatarDuracao(d: Magia['duracao'], concentracao = false): string {
  const base = d.tipo === 'instant' ? 'Instantânea' : d.tipo === 'until-dispelled' ? 'Até ser dissipada' : d.tipo === 'special' ? 'Especial'
    : `${d.ate ? 'até ' : ''}${plural(d.qtd ?? 0, { round: 'rodada', minute: 'minuto', hour: 'hora', day: 'dia' }[d.unidade ?? 'round'], { round: 'rodadas', minute: 'minutos', hour: 'horas', day: 'dias' }[d.unidade ?? 'round'])}`;
  return concentracao ? `Concentração, ${base.charAt(0).toLocaleLowerCase('pt-BR')}${base.slice(1)}` : base.charAt(0).toLocaleUpperCase('pt-BR') + base.slice(1);
}
export function formatarComponentes(c: Magia['componentes'], material?: string): string {
  const letras = [c.v && 'V', c.s && 'S', c.m && 'M'].filter(Boolean).join(', ');
  return c.m && material ? `${letras} (${material.replace(/\.$/, '')})` : letras;
}
export function formatarArea(a: NonNullable<Magia['area']>): string {
  const raio = a.tipo === 'sphere' || a.tipo === 'cylinder';
  return `${rotuloArea(a.tipo)} de ${metros(a.pes)}${raio ? ' de raio' : ''}`;
}

const FRACOES: Record<number, string> = { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' };
export const formatarND = (nd: number) => FRACOES[nd] ?? String(nd);
export const formatarModificador = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n);
export const modificadorDe = (valor: number) => Math.floor((valor - 10) / 2);
export function formatarDeslocamento(d: Monstro['deslocamento'], planar?: boolean): string {
  const partes = (['walk', 'fly', 'swim', 'climb', 'burrow'] as const).filter(k => d[k]).map(k => (k === 'walk' ? metros(d[k]!) : `${rotuloDeslocamento(k).toLocaleLowerCase('pt-BR')} ${metros(d[k]!)}${k === 'fly' && planar ? ' (planar)' : ''}`));
  return partes.join(', ') || '—';
}
export function formatarSentidos(m: Pick<Monstro, 'sentidos' | 'percepcaoPassiva'>): string {
  const s = (Object.keys(m.sentidos) as (keyof Monstro['sentidos'])[]).map(k => `${rotuloSentido(k).toLocaleLowerCase('pt-BR')} ${metros(m.sentidos[k]!)}`);
  return [...s, `Percepção passiva ${m.percepcaoPassiva}`].join(', ');
}
export const formatarPontosDeVida = (m: Pick<Monstro, 'pv' | 'dadosVida'>) => `${m.pv} (${m.dadosVida})`;
export const formatarXP = (xp: number) => xp.toLocaleString('pt-BR');
