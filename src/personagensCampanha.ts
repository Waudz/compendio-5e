// Visão única dos personagens da campanha para quem está olhando: junta, pelo MESMO id, a linha pública/perfil (`notes`) e a ficha privada
// (`character_sheets`). Não cria nem copia registros. Quem pode ler o quê é decidido pelo banco (RLS): `registros.list` só devolve o que o
// usuário lê (publicados e os próprios) e `fichas.listar` só as fichas legíveis (as próprias; todas as da campanha para o mestre).
import type { CapaApi } from "./capa";
import type { Res } from "./campaigns";
import { rotuloClasse } from "./criador/rotulos";
import { cartaoPublico, ehGuiado, type FichasApi, type ResumoFicha } from "./fichas";
import type { FonteAventureiros } from "./inicio";
import { lerPerfil } from "./perfilPersonagem";
import type { RegistrosApi } from "./registros";

export type PersonagemCampanha = {
  id: string; nome: string; classe: string; nivel: number | null;
  /** Imagem pública (https) de personagem guiado, ou caminho no armazenamento do retrato de um perfil simples. */
  retratoUrl: string | null; retratoCaminho: string | null;
  guiado: boolean;
  /** Quem está olhando pode abrir a ficha (a própria, ou qualquer uma sendo mestre). */
  comFicha: boolean;
  meu: boolean; publicado: boolean;
  /** Título público quando difere do nome mostrado (só para quem vê a ficha). */
  apresentadoComo: string | null;
};
export type ListaPersonagens = { personagens: PersonagemCampanha[]; avisoFichas: string | null };

const https = (u: string | null | undefined) => (u?.startsWith("https://") ? u : null);

export async function listarPersonagens(campaignId: string, de: { registros: RegistrosApi; fichas: FichasApi | null; userId: string | null }): Promise<Res<ListaPersonagens>> {
  const [r, f] = await Promise.all([de.registros.list(campaignId, "character"), de.fichas ? de.fichas.listar(campaignId) : Promise.resolve(null)]);
  if (!r.ok) return r;
  const fichas = new Map<string, ResumoFicha>((f?.ok ? f.data : []).map(x => [x.id, x]));
  const classeDaFicha = (x: ResumoFicha) => (x.classId ? rotuloClasse(x.classId) : "Aventureiro");
  const saida: PersonagemCampanha[] = r.data.map(nota => {
    const ficha = fichas.get(nota.id); fichas.delete(nota.id);
    const publicado = nota.visibility === "campaign", meu = (ficha?.ownerId ?? nota.ownerId) === de.userId;
    if (ehGuiado(nota.meta)) {
      const c = cartaoPublico(nota.meta);
      // quem lê a ficha vê o nome real; os demais só a identidade publicada (nunca nível)
      const nome = ficha?.nome ?? nota.title;
      return { id: nota.id, nome, classe: ficha ? classeDaFicha(ficha) : [c?.race, c?.characterClass].filter(Boolean).join(" ") || "Aventureiro", nivel: ficha?.nivel ?? null,
        retratoUrl: https(c?.imageUrl), retratoCaminho: null, guiado: true, comFicha: !!ficha, meu, publicado, apresentadoComo: ficha && publicado && nota.title !== nome ? nota.title : null };
    }
    const p = lerPerfil(nota.meta);
    return { id: nota.id, nome: nota.title, classe: p.classe || "Sem classe", nivel: p.nivel, retratoUrl: null, retratoCaminho: p.retrato, guiado: false, comFicha: false, meu, publicado, apresentadoComo: null };
  });
  // fichas legíveis cuja linha pública não é (ex.: mestre diante de identidade privada): aparecem uma única vez, pelos dados da ficha
  for (const x of fichas.values()) saida.push({ id: x.id, nome: x.nome, classe: classeDaFicha(x), nivel: x.nivel, retratoUrl: null, retratoCaminho: null, guiado: true, comFicha: true, meu: x.ownerId === de.userId, publicado: false, apresentadoComo: null });
  saida.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { ok: true, data: { personagens: saida, avisoFichas: f && !f.ok ? f.error : null } };
}

/** Aviso de privacidade para quem enxerga algo que a campanha não vê. */
export const rotuloPrivacidade = (p: PersonagemCampanha) => (p.publicado ? null : p.meu ? "não publicado: só você e o mestre veem" : "não publicado");

/** Aventureiros do Início, sem limite: os publicados para a campanha e os guiados cuja ficha quem olha pode ler (o próprio; todos, para o mestre).
 *  Perfis simples continuam aparecendo só quando marcados como visíveis para a campanha (é o que essa opção significa). */
export function fonteAventureirosDoInicio(registros: RegistrosApi, capa: CapaApi | null, fichas: FichasApi | null, userId: string | null): FonteAventureiros {
  return {
    listar: async campaignId => {
      const r = await listarPersonagens(campaignId, { registros, fichas, userId });
      if (!r.ok) return r;
      const lista = await Promise.all(r.data.personagens.filter(p => p.publicado || (p.guiado && p.comFicha)).map(async p => {
        let retratoUrl = p.retratoUrl;
        if (!retratoUrl && p.retratoCaminho && capa) { const u = await capa.urlDe(p.retratoCaminho); if (u.ok) retratoUrl = u.data; }
        const nota = rotuloPrivacidade(p);
        return { id: p.id, nome: p.nome, classe: p.classe, nivel: p.nivel, retratoUrl, ...(nota ? { nota } : {}) };
      }));
      return { ok: true, data: lista };
    },
  };
}
