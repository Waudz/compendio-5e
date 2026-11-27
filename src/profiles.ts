import type { SupabaseClient } from "@supabase/supabase-js";
import { erroCampanha, type Res } from "./campaigns";

export const PERFIL_ATUALIZADO = "compendio5e:perfil-atualizado";
export const validarNomePerfil = (name: string) => name.trim().length > 0 && name.trim().length <= 60 ? null : "Informe um nome de 1 a 60 caracteres.";

/** A identidade da conta vive em profiles. A RLS só permite alterar o próprio perfil. */
export function createProfileApi(client: SupabaseClient, userId: string) {
  const result = async (query: () => PromiseLike<{data: {display_name: string} | null; error: unknown}>): Promise<Res<string>> => {
    try {
      const {data, error} = await query();
      return error || !data ? {ok: false, error: erroCampanha(error)} : {ok: true, data: data.display_name};
    } catch (error) { return {ok: false, error: erroCampanha(error)}; }
  };
  return {
    load: () => result(() => client.from("profiles").select("display_name").eq("id", userId).single()),
    save: (name: string): Promise<Res<string>> => {
      const invalid = validarNomePerfil(name);
      if (invalid) return Promise.resolve({ok: false, error: invalid});
      return result(() => client.from("profiles").update({display_name: name.trim()}).eq("id", userId).select("display_name").single());
    },
  };
}
