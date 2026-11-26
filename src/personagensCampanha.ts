// Visão única dos personagens da campanha para quem está olhando: junta, pelo MESMO id, a linha pública/perfil (`notes`) e a ficha privada
// (`character_sheets`). Não cria nem copia registros. Quem pode ler o quê é decidido pelo banco (RLS): `registros.list` só devolve o que o
// usuário lê (publicados e os próprios) e `fichas.listar` só as fichas legíveis (as próprias; todas as da campanha para o mestre).
import type { CapaApi } from "./capa";
import type { Res } from "./campaigns";
import { rotuloClasse } from "./criador/rotulos";
import { cartaoPublico, ehGuiado, type FichasApi, type ResumoFicha } from "./fichas";
import { presentation } from "./rules/public-identity";
import type { FonteAventureiros } from "./inicio";
import { lerPerfil } from "./perfilPersonagem";
import type { RegistrosApi } from "./registros";

export type PersonagemCampanha = {
  id: string; nome: string; alcunha: string | null; classe: string; nivel: number | null;
  /** Imagem pública (https) de personagem guiado, ou caminho no armazenamento do retrato de um perfil simples. */
  retratoUrl: string | null; retratoCaminho: string | null;
  guiado: boolean;
  /** Quem está olhando pode abrir a ficha (a própria, ou qualquer uma sendo mestre). */
  comFicha: boolean;
  meu: boolean; publicado: boolean;
};
export type ListaPersonagens = { personagens: PersonagemCampanha[]; avisoFichas: string | null };

const nivelPublico = (v: string | null | undefined) => (v && Number.isInteger(Number(v)) ? Number(v) : null);

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
      // quem lê a ficha vê o personagem como ele é; os demais, só a apresentação (o que o dono não ocultou)
      const visto = ficha ? { nome: ficha.nome, alcunha: ficha.alcunha ?? null } : c ? presentation(c) : { nome: nota.title, alcunha: null };
      return { id: nota.id, nome: visto.nome, alcunha: visto.alcunha, classe: ficha ? classeDaFicha(ficha) : [c?.race, c?.characterClass].filter(Boolean).join(" ") || "Aventureiro", nivel: ficha ? ficha.nivel : nivelPublico(c?.level),
        retratoUrl: (ficha ? ficha.retrato : c?.imageUrl) ?? null, retratoCaminho: null, guiado: true, comFicha: !!ficha, meu, publicado };
    }
    const p = lerPerfil(nota.meta);
    return { id: nota.id, nome: nota.title, alcunha: null, classe: p.classe || "Sem classe", nivel: p.nivel, retratoUrl: null, retratoCaminho: p.retrato, guiado: false, comFicha: false, meu, publicado };
  });
  // fichas legíveis cuja linha pública não é (ex.: mestre diante de identidade privada): aparecem uma única vez, pelos dados da ficha
  for (const x of fichas.values()) saida.push({ id: x.id, nome: x.nome, alcunha: x.alcunha ?? null, classe: classeDaFicha(x), nivel: x.nivel, retratoUrl: x.retrato ?? null, retratoCaminho: null, guiado: true, comFicha: true, meu: x.ownerId === de.userId, publicado: false });
  saida.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { ok: true, data: { personagens: saida, avisoFichas: f && !f.ok ? f.error : null } };
}

/** Aviso para quem enxerga algo que os outros jogadores não veem, na perspectiva de quem está olhando. */
export const rotuloPrivacidade = (p: PersonagemCampanha, souMestre: boolean) => (p.publicado ? null : souMestre ? "oculto dos jogadores" : p.meu ? "só você e o mestre veem" : "oculto dos jogadores");

/** Aventureiros do Início, sem limite: os publicados para a campanha e os guiados cuja ficha quem olha pode ler (o próprio; todos, para o mestre).
 *  Perfis simples continuam aparecendo só quando marcados como visíveis para a campanha (é o que essa opção significa). */
export function fonteAventureirosDoInicio(registros: RegistrosApi, capa: CapaApi | null, fichas: FichasApi | null, userId: string | null, souMestre = false): FonteAventureiros {
  return {
    listar: async campaignId => {
      const r = await listarPersonagens(campaignId, { registros, fichas, userId });
      if (!r.ok) return r;
      const lista = await Promise.all(r.data.personagens.filter(p => p.publicado || (p.guiado && p.comFicha)).map(async p => {
        let retratoUrl = p.retratoUrl;
        if (!retratoUrl && p.retratoCaminho && capa) { const u = await capa.urlDe(p.retratoCaminho); if (u.ok) retratoUrl = u.data; }
        const nota = rotuloPrivacidade(p, souMestre);
        return { id: p.id, nome: p.nome, ...(p.alcunha ? { alcunha: p.alcunha } : {}), classe: p.classe, nivel: p.nivel, retratoUrl, ...(nota ? { nota } : {}) };
      }));
      return { ok: true, data: lista };
    },
  };
}
