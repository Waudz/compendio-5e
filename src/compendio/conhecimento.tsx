/** Contrato da projeção autorizada. Nunca carrega notes/meta privados para filtrar no cliente. */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "../AuthContext";
import { useCampaigns } from "../CampaignsContext";
import type { BlocoTexto } from "../inicio";
export type CodexCategoria =
  | "npc"
  | "location"
  | "organization"
  | "discovery"
  | "monster"
  | "item";
export type Conhecimento = {
  id: string;
  category: CodexCategoria;
  systemId: string;
  title: string;
  description?: BlocoTexto[];
  knowledge: number;
  version: number;
  definitionId?: string;
  instanceId?: string;
  imagePath?: string;
  imageDefinitionId?: string;
  secret?: string;
  stats?: Record<string, unknown>;
};
export type EdicaoConhecimento = Omit<
  Conhecimento,
  "id" | "version" | "imageDefinitionId"
>;
export type CodexAviso = {
  id: number;
  entry_id: string;
  knowledge: number;
  read_at: string | null;
  created_at: string;
};
export interface CodexApi {
  list(cid: string): Promise<Conhecimento[]>;
  save(
    cid: string,
    id: string | null,
    version: number,
    data: EdicaoConhecimento,
  ): Promise<string>;
  remove(cid: string, id: string, version: number): Promise<void>;
  upload(cid: string, id: string, file: File): Promise<string>;
  image(path: string): Promise<Blob>;
  holders(cid: string, id: string): Promise<{ id: string; title: string }[]>;
  notices(): Promise<CodexAviso[]>;
  seen(id: number): Promise<void>;
}
export const ERRO_CODEX =
  "Não foi possível acessar o conhecimento da campanha. Verifique a conexão e a configuração da migração do Compêndio.";
function conferir<T>(r: { data: T | null; error: unknown }): T {
  const message = (r.error as { message?: string } | null)?.message ?? "";
  if (message.includes("conflito_de_versao"))
    throw Error(
      "Outra sessão alterou este registro. Recarregue antes de salvar.",
    );
  if (r.error || r.data === null) throw Error(ERRO_CODEX);
  return r.data;
}
export function validarImagemConhecimento(file: File): void {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !file.size ||
    file.size > 5242880
  )
    throw Error("Use JPEG, PNG ou WebP de até 5 MiB.");
}
export function createCodexApi(client: SupabaseClient): CodexApi {
  return {
    list: async (cid) =>
      conferir(
        await client.rpc("codex_list", { p_campaign: cid }),
      ) as Conhecimento[],
    save: async (cid, id, version, data) =>
      conferir(
        await client.rpc("codex_save", {
          p_campaign: cid,
          p_entry: id,
          p_version: version,
          p_data: data,
        }),
      ) as string,
    remove: async (cid, id, version) => {
      const r = await client.rpc("codex_remove", {
        p_campaign: cid,
        p_entry: id,
        p_version: version,
      });
      if (r.error) throw Error(ERRO_CODEX);
    },
    upload: async (cid, id, file) => {
      validarImagemConhecimento(file);
      const path = `${cid}/${id}/${crypto.randomUUID()}`;
      const r = await client.storage
        .from("codex-assets")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (r.error)
        throw Error(
          "Não foi possível enviar a imagem. A imagem anterior foi preservada.",
        );
      return path;
    },
    image: async (path) =>
      conferir(await client.storage.from("codex-assets").download(path)),
    holders: async (cid, id) =>
      conferir(
        await client.rpc("codex_holders", { p_campaign: cid, p_entry: id }),
      ) as { id: string; title: string }[],
    notices: async () =>
      conferir(
        await client
          .from("codex_notifications")
          .select("id,entry_id,knowledge,read_at,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ) as CodexAviso[],
    seen: async (id) => {
      const r = await client
        .from("codex_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (r.error) throw Error(ERRO_CODEX);
    },
  };
}
const Ctx = createContext<CodexApi | undefined>(undefined);
export function CodexProvider({
  api,
  children,
}: {
  api: CodexApi;
  children: ReactNode;
}) {
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
export function useCodexApi() {
  const injected = useContext(Ctx),
    { client, status } = useAuth();
  return useMemo(
    () =>
      injected ??
      (client && status === "authenticated" ? createCodexApi(client) : null),
    [injected, client, status],
  );
}
const VAZIO: Conhecimento[] = [];
export const EVENTO_CODEX = "compendio:conhecimento";
export function avisarConhecimento() {
  window.dispatchEvent(new Event(EVENTO_CODEX));
}
export function useConhecimento() {
  const api = useCodexApi(),
    { active } = useCampaigns(),
    { user } = useAuth();
  const scope = `${user?.id}:${active?.campaign.id}`;
  const [versao, setVersao] = useState(0);
  const [state, setState] = useState<{
    scope: string;
    items: Conhecimento[];
    error?: string;
  }>();
  useEffect(() => {
    const f = () => {
      if (document.visibilityState !== "hidden") setVersao((v) => v + 1);
    };
    window.addEventListener(EVENTO_CODEX, f);
    window.addEventListener("focus", f);
    document.addEventListener("visibilitychange", f);
    const timer = window.setInterval(f, 30000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(EVENTO_CODEX, f);
      window.removeEventListener("focus", f);
      document.removeEventListener("visibilitychange", f);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    if (!api || !active) return;
    api.list(active.campaign.id).then(
      (items) => {
        if (alive) setState({ scope, items });
      },
      () => {
        if (alive) setState({ scope, items: [], error: ERRO_CODEX });
      },
    );
    return () => {
      alive = false;
    };
  }, [api, scope, versao]);
  const current = state?.scope === scope ? state : undefined;
  return {
    api,
    items: current?.items ?? VAZIO,
    loading: !!api && !current,
    error: current?.error ?? (!api ? ERRO_CODEX : undefined),
    refresh: avisarConhecimento,
  };
}
export const itemConhecido = (items: readonly Conhecimento[], id: string) =>
  items.some(
    (x) =>
      x.systemId === "dnd5e-2014" &&
      x.category === "item" &&
      x.definitionId === id &&
      x.knowledge > 0,
  );
