// Fichas de DEMONSTRAÇÃO (`?demo=...&fichas=1`, só em `npm run dev` e no Preview isolado): a API em memória das fichas, persistida no
// localStorage e compartilhada entre abas do mesmo navegador (o evento `storage` faz o papel do tempo real). Serve para ver e testar
// mestre e jogador lado a lado; as regras reais do banco são testadas em `supabase/*.test.ts`.
import type { FichaDeNpcEmMemoria } from "../fichasMemoria";
import type { FichasApi } from "../fichas";
import { fichasEmMemoria, novoBancoFichas, type BancoFichas } from "../fichasMemoria";
import type { Registro } from "../registros";

const CHAVE = "demo:fichas:v1";
type Guardado = { fichas: BancoFichas["fichas"]; ciclo?: BancoFichas["ciclo"] };

export function fichasDemo(uid: string, campaignId: string, registros: { ler: () => Registro[]; gravar: (d: Registro[]) => void }): FichasApi & { npc: FichaDeNpcEmMemoria } {
  const ouvintes = new Set<() => void>();
  const notas = { get dados() { return registros.ler(); }, set dados(v: Registro[]) { registros.gravar(v); } };
  const banco = (): BancoFichas => {
    const b = novoBancoFichas({ dados: registros.ler() });
    b.campanhas = { [campaignId]: { mestre: "demo-mestre", jogadores: ["demo-jogador"] } };
    try { const g = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as Guardado | null; b.fichas = g?.fichas ?? []; b.ciclo = g?.ciclo; } catch { b.fichas = []; }
    b.ouvintes = ouvintes;
    return b;
  };
  /** Cada chamada relê o que está guardado (outra aba pode ter gravado) e grava o resultado, com trava entre abas (o papel do
   *  bloqueio de linha do banco): duas abas nunca leem e gravam ao mesmo tempo. */
  const chamar = async <T,>(fn: (api: FichasApi) => Promise<T>): Promise<T> => {
    const executar = async () => {
      const b = banco(), antes = JSON.stringify([b.fichas, b.registros.dados, b.ciclo]);
      const r = await fn(fichasEmMemoria(uid, b));
      if (JSON.stringify([b.fichas, b.registros.dados, b.ciclo]) !== antes) {
        localStorage.setItem(CHAVE, JSON.stringify({ fichas: b.fichas, ciclo: b.ciclo })); notas.dados = b.registros.dados;
        // no Chrome, o localStorage chega às outras abas (outros processos) com um pequeno atraso: a trava só é solta depois disso,
        // senão a próxima aba leria o valor antigo e uma operação se perderia (no banco real, o bloqueio de linha resolve isso)
        await new Promise(r => setTimeout(r, 120));
      }
      return r;
    };
    return navigator.locks ? (await navigator.locks.request(CHAVE, executar)) as T : executar();
  };
  const npc: FichaDeNpcEmMemoria = {
    revisao: id => banco().fichas.find(f => f.id === id && f.npc)?.revision,
    definir: (cid, id, draft) => {
      const b = banco(); fichasEmMemoria(uid, b).npc.definir(cid, id, draft);
      localStorage.setItem(CHAVE, JSON.stringify({ fichas: b.fichas, ciclo: b.ciclo }));
    },
  };
  return {
    npc,
    ciclo: {
      situacoes: c => chamar(a => a.ciclo!.situacoes(c)), agir: p => chamar(a => a.ciclo!.agir(p)), ofertas: c => chamar(a => a.ciclo!.ofertas(c)),
      responder: (o, x) => chamar(a => a.ciclo!.responder(o, x)), avisos: c => chamar(a => a.ciclo!.avisos(c)), lerAvisos: ids => chamar(a => a.ciclo!.lerAvisos(ids)),
    },
    listar: c => chamar(a => a.listar(c)),
    carregar: id => chamar(a => a.carregar(id)),
    criar: (c, d, i) => chamar(a => a.criar(c, d, i)),
    salvar: (id, r, d, i) => chamar(a => a.salvar(id, r, d, i)),
    lerVitais: ids => chamar(a => a.lerVitais(ids)),
    alterarVitais: (id, acao, op) => chamar(a => a.alterarVitais(id, acao, op)),
    usarConsumivel: (id, i, c, m, op) => chamar(a => a.usarConsumivel(id, i, c, m, op)),
    transferirItem: (o, d, i, q, op) => chamar(a => a.transferirItem(o, d, i, q, op)),
    assinar: (_f, aoMudar) => {
      const outraAba = (e: StorageEvent) => { if (e.key === CHAVE) aoMudar(); };
      ouvintes.add(aoMudar); window.addEventListener("storage", outraAba);
      return () => { ouvintes.delete(aoMudar); window.removeEventListener("storage", outraAba); };
    },
  };
}
