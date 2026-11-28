/** Adaptador somente de leitura. O servidor decide nomes, campos, imagens e vínculos.
 * Não simula um usuário nem modifica JWT, papéis persistidos ou RLS. */
import type { CodexApi, Conhecimento } from './conhecimento';
export function apiDePrevia(api: CodexApi): CodexApi {
 const negar = async (): Promise<never> => { throw Error('A prévia do jogador é somente leitura. Volte à visão de mestre para editar.'); };
 return {
   list: async cid => {
     const candidates = (await api.list(cid)).filter(e => e.visible);
     const publicas: Conhecimento[] = [];
     // Não dispara uma requisição por registro simultaneamente em campanhas grandes.
     for (let i = 0; i < candidates.length; i += 6) {
       const batch = await Promise.all(candidates.slice(i, i + 6).map(e => api.preview(cid, e.id)));
       for (const p of batch) if (p.entry) publicas.push(p.entry);
     }
     return publicas;
   },
   links: async (cid,id) => (await api.preview(cid,id)).links,
   preview: (cid,id) => api.preview(cid,id),
   image: path => api.image(path),
   // Notificações/posses/definições do mestre não equivalem às de um jogador.
   feed: async () => ({ items: [], unread: 0, discoveries: 0 }), holders: async () => [],
   definitions: async () => [], bancoDeNpcs: async () => false, vidas: async () => [],
   save: negar, remove: negar, reveal: negar, upload: negar, link: negar, unlink: negar,
   seen: negar, seenAll: negar,
 };
}
