// Personagens da campanha sobre `notes` (kind 'character'): nome no título; classe, nível e retrato em `meta`. Sem React, sem rede.
// A ficha completa (atributos, magias, inventário) ainda não existe na 2.0; este é o perfil do personagem, base do Início e das fichas futuras.
import type { Res } from "./campaigns";
import type { CapaApi } from "./capa";
import type { Aventureiro, FonteAventureiros } from "./inicio";
import { cartaoPublico, ehGuiado } from "./fichas";
import { presentation } from "./rules/public-identity";
import type { Registro, RegistrosApi } from "./registros";

export const NIVEL_MIN = 1, NIVEL_MAX = 20, MAX_CLASSE = 40;
export type Perfil = { classe: string; nivel: number; retrato: string | null };

export function lerPerfil(meta: Record<string, unknown> | undefined): Perfil {
  const m = (meta ?? {}) as { classe?: unknown; nivel?: unknown; retrato?: unknown };
  const nivel = Number.isInteger(m.nivel) ? Math.min(NIVEL_MAX, Math.max(NIVEL_MIN, m.nivel as number)) : NIVEL_MIN;
  return { classe: typeof m.classe === "string" ? m.classe.slice(0, MAX_CLASSE) : "", nivel, retrato: typeof m.retrato === "string" && /^[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(m.retrato) ? m.retrato : null };
}

export function validarPerfil(nome: string, classe: string, nivel: number): string | null {
  if (!nome.trim() || nome.trim().length > 120) return "O nome deve ter de 1 a 120 caracteres.";
  if (!classe.trim() || classe.trim().length > MAX_CLASSE) return `Informe a classe (até ${MAX_CLASSE} caracteres).`;
  if (!Number.isInteger(nivel) || nivel < NIVEL_MIN || nivel > NIVEL_MAX) return `O nível deve ser um número de ${NIVEL_MIN} a ${NIVEL_MAX}.`;
  return null;
}

export const ordenarPersonagens = (rs: Registro[]) => [...rs].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));

/** Fonte do Início: personagens PUBLICADOS para a campanha (os privados de cada jogador não aparecem para os outros nem na vitrine). */
export function fontePersonagens(api: RegistrosApi, capa: CapaApi | null): FonteAventureiros {
  return {
    listar: async (campanhaId: string): Promise<Res<Aventureiro[]>> => {
      const r = await api.list(campanhaId, "character"); if (!r.ok) return r;
      const lista = ordenarPersonagens(r.data.filter(x => x.visibility === "campaign"));
      const out = await Promise.all(lista.map(async x => {
        if (ehGuiado(x.meta)) {   // guiado: só a identidade pública (inclusive o retrato publicado), sem nível
          const c = cartaoPublico(x.meta), visto = c ? presentation(c) : { nome: x.title, alcunha: null };
          return { id: x.id, nome: visto.nome, ...(visto.alcunha ? { alcunha: visto.alcunha } : {}), classe: [c?.race, c?.characterClass].filter(Boolean).join(" ") || "Aventureiro", nivel: null, retratoUrl: c?.imageUrl ?? null };
        }
        const p = lerPerfil(x.meta); let retratoUrl: string | null = null;
        if (p.retrato && capa) { const u = await capa.urlDe(p.retrato); if (u.ok) retratoUrl = u.data; }   // retrato indisponível: cai na inicial, sem erro
        return { id: x.id, nome: x.title, classe: p.classe || "Sem classe", nivel: p.nivel, retratoUrl };
      }));
      return { ok: true, data: out };
    },
  };
}
