/** Contrato da projeção autorizada. Nunca carrega notes/meta privados para filtrar no cliente. */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {apiDePrevia} from "./apiDePrevia";
import {marcarLote} from "./notificacoesLote";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "../AuthContext";
import {  useCampaigns } from "../CampaignsContext";
import {useModoJogador} from "../modoJogador";
import type { BlocoTexto } from "../inicio";
import type { Secao } from "./ficha";
import type { LinhaDefinicao, TipoDefinicao } from "./definicoes";
import type { EstadoVitalidade, LinhaVida, NovaFichaDeNpc, PatchVida, PedidoDeFicha } from "../npc/estado";
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
  version: number;
  /** Existência publicada para os jogadores. Na projeção do jogador é sempre verdadeiro. */
  visible: boolean;
  /** Chaves reveladas; só o mestre recebe. */
  revealed?: string[];
  /** Falso na referência secreta criada apenas para um vínculo; só o mestre recebe. */
  registered?: boolean;
  /** Para o jogador, presente somente com a identificação completa. */
  definitionId?: string;
  instanceId?: string;
  imagePath?: string;
  imageDefinitionId?: string;
  secret?: string;
  /** Ficha de combate de um NPC (definição de criatura); só o mestre recebe. */
  combatDefinitionId?: string;
  /** O NPC tem ficha de personagem com o mesmo ID (0022); só o mestre recebe. */
  characterSheet?: boolean;
  /** Estado vital do NPC (0022). O jogador só o recebe quando revelado ('desconhecido' é diferente de não revelado). */
  vitalStatus?: EstadoVitalidade;
  fields?: Record<string, string>;
  sheet?: Secao[];
  relatedTerms?: string[];
  framing?: import("../imagem/enquadramento").Enquadramento;
};
export type EdicaoConhecimento = Pick<
  Conhecimento,
  "category" | "systemId" | "title" | "description" | "definitionId" | "instanceId" | "imagePath" | "secret" | "fields" | "sheet" | "framing" | "registered"
>;
export type Divulgacao = {
  visible: boolean;
  revealed: string[];
  /** Vínculos do próprio registro: id do vínculo -> revelado. */
  links?: Record<string, boolean>;
  /** Seções atuais da definição, quando o servidor está desatualizado. */
  sheet?: Secao[];
};
export type NovoVinculo = { kind: string; label: string; inverse: string; revealed?: boolean };
export type Previa = { entry: Conhecimento | null; links: CodexLink[] };
export type CodexAviso = {
  id: number;
  entry_id: string;
  is_new: boolean;
  read_at: string | null;
  created_at: string;
};
export type CodexLink = {
  id: string;
  targetId: string;
  title: string;
  category: CodexCategoria | "character";
  kind: string;
  relation: string;
  outgoing: boolean;
  revealed?: boolean;
};
export type NotificationFeed={items:(CodexAviso&{title:string;category:CodexCategoria})[];unread:number;discoveries:number};
export type EdicaoVinculos = { remover: string[]; adicionar: { source: string | null; target: string | null; relation: NovoVinculo }[] };
export interface CodexApi {
  edicaoAtomica?(): Promise<boolean>;
  salvarEdicao?(cid: string, id: string | null, version: number, data: EdicaoConhecimento, links: EdicaoVinculos): Promise<string>;
  links(cid: string, id: string): Promise<CodexLink[]>;
  link(cid: string, source: string, target: string, relation: NovoVinculo): Promise<string>;
  unlink(cid: string, id: string): Promise<void>;
  feed(cid: string): Promise<NotificationFeed>;
  seenAll(cid:string,through:number,signal:AbortSignal):Promise<void>;
  list(cid: string): Promise<Conhecimento[]>;
  save(cid: string, id: string | null, version: number, data: EdicaoConhecimento): Promise<string>;
  reveal(cid: string, id: string, version: number, data: Divulgacao): Promise<void>;
  preview(cid: string, id: string): Promise<Previa>;
  remove(cid: string, id: string, version: number): Promise<void>;
  upload(cid: string, id: string, file: File): Promise<string>;
  image(path: string): Promise<Blob>;
  holders(cid: string, id: string): Promise<{ id: string; title: string }[]>;
  seen(id: number): Promise<void>;
  /** Personalização do catálogo (0018), somente do mestre. */
  definitions?(cid: string): Promise<LinhaDefinicao[]>;
  /** Entrega e identificação de itens (0019), somente do mestre. */
  grantItem?(cid: string, characterId: string, definitionId: string, quantity: number, mask: { nome: string; descricao?: string } | null, operation: string): Promise<void>;
  identifyItem?(cid: string, token: string): Promise<void>;
  setCombatSheet?(cid: string, id: string, version: number, definitionId: string | null): Promise<void>;
  /** Fichas de NPC, estado vital e PV persistentes (0022). */
  bancoDeNpcs?(): Promise<boolean>;
  /** Adiciona, substitui ou remove (nova nula) a ficha de um NPC; a ficha perdida fica 30 dias em cópia privada. */
  definirFichaNpc?(cid: string, id: string, version: number, nova: NovaFichaDeNpc, pedido: PedidoDeFicha): Promise<{ revision?: number }>;
  vidas?(cid: string): Promise<LinhaVida[]>;
  gravarVida?(cid: string, noteId: string, patch: PatchVida, operacao: string, version?: number): Promise<LinhaVida>;
  saveDefinition?(cid: string, d: LinhaDefinicao, sheet: Secao[], baseName?: string): Promise<number>;
  removeDefinition?(cid: string, kind: TipoDefinicao, id: string, version: number, sheet?: Secao[], originalName?: string): Promise<void>;
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
function semErro(r: { error: unknown }): void {
  const message = (r.error as { message?: string } | null)?.message ?? "";
  if (message.includes("conflito_de_versao"))
    throw Error("Outra sessão alterou este registro. Recarregue antes de salvar.");
  if (r.error) throw Error(ERRO_CODEX);
}
export const VERSAO_BANCO_CODEX = 20;
const linhaDeVida = (x: { note_id: string; estado: EstadoVitalidade; pv: number | null; temp: number; condicoes: string[]; version: number }): LinhaVida =>
  ({ noteId: x.note_id, estado: x.estado, pv: x.pv, temp: x.temp, condicoes: x.condicoes, version: x.version });
export function validarImagemConhecimento(file: File): void {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !file.size ||
    file.size > 5242880
  )
    throw Error("Use JPEG, PNG ou WebP de até 5 MiB.");
}
export function createCodexApi(client: SupabaseClient): CodexApi {
  const exigirBanco = async () => {
    const capability = conferir(await client.rpc("codex_capabilities"));
    if (typeof capability !== "number" || capability < VERSAO_BANCO_CODEX)
      throw Error(`Atualização do banco necessária: migração 00${VERSAO_BANCO_CODEX}. Nada foi gravado.`);
  };
  // sem a 0022 a tabela do estado vital não existe: nada é consultado
  let versao: Promise<number> | null = null;
  const capacidade = () => (versao ??= Promise.resolve(client.rpc("codex_capabilities")).then(r => (typeof r.data === "number" ? r.data : 0), () => { versao = null; return 0; }));
  return {
    edicaoAtomica: async () => { const r=await client.rpc("codex_edit_capability"); return !r.error && r.data===true; },
    salvarEdicao: async (cid,id,version,data,links) => {
      if (!(await client.rpc("codex_edit_capability")).data) throw Error('Os vínculos aguardam a atualização 0023. Nada foi gravado.');
      return conferir(await client.rpc('codex_save_edit', {p_campaign:cid,p_entry:id,p_version:version,p_data:data,p_links:links})) as string;
    },
    definitions: async (cid) => conferir(await client.rpc("codex_definitions_for", { p_campaign: cid })) as LinhaDefinicao[],
    grantItem: async (cid, character, definition, quantity, mask, operation) =>
      semErro(await client.rpc("codex_grant_item", { p_campaign: cid, p_character: character, p_definition_id: definition, p_quantity: quantity, p_mask: mask, p_operation: operation })),
    identifyItem: async (cid, token) => semErro(await client.rpc("codex_identify_item", { p_campaign: cid, p_token: token })),
    saveDefinition: async (cid, d, sheet, baseName) =>
      conferir(await client.rpc("codex_definition_save", { p_campaign: cid, p_kind: d.kind, p_definition_id: d.definitionId, p_version: d.version, p_base_id: d.baseId ?? null, p_data: d.data, p_sheet: sheet, p_base_name: baseName ?? null })) as number,
    removeDefinition: async (cid, kind, id, version, sheet, originalName) => {
      const r = await client.rpc("codex_definition_remove", { p_campaign: cid, p_kind: kind, p_definition_id: id, p_version: version, p_sheet: sheet ?? null, p_original_name: originalName ?? null });
      if ((r.error as { message?: string } | null)?.message?.includes("definicao_em_uso"))
        throw Error("Há uma página da campanha ligada a esta criação. Remova a página antes de excluir.");
      semErro(r);
    },
    bancoDeNpcs: async () => (await capacidade()) >= 22,
    definirFichaNpc: async (cid, id, version, nova, pedido) => {
      const p_nova = !nova ? null : nova.tipo === "personagem" ? { tipo: "personagem", draft: { ...nova.draft, id, _protocolo: 2 } }
        : { tipo: "criatura", base: nova.base ?? null, definicao: nova.definicao, secoes: nova.secoes };
      const r = await client.rpc("codex_npc_sheet_set", { p_campaign: cid, p_entry: id, p_version: version, p_nova, p_operation: pedido.operacao, p_revision: pedido.revisao ?? null, p_confirm: pedido.confirmar ? "remover-ficha" : null });
      const erro = r.error as { code?: string; message?: string } | null;
      if (erro?.code === "PGRST202") throw Error("O banco precisa da atualização 0022 para gerenciar fichas de NPC. Nada foi gravado.");
      if (erro?.message?.includes("conflito_de_revisao")) throw Error("A ficha mudou em outra sessão. Recarregue antes de substituir ou remover; nada foi alterado.");
      semErro(r);
      return (r.data ?? {}) as { revision?: number };
    },
    vidas: async (cid) => {
      if ((await capacidade()) < 22) return [];
      const r = await client.from("character_life").select("note_id, estado, pv, temp, condicoes, version").eq("campaign_id", cid);
      return (conferir(r) as unknown as { note_id: string; estado: EstadoVitalidade; pv: number | null; temp: number; condicoes: string[]; version: number }[]).map(linhaDeVida);
    },
    gravarVida: async (cid, noteId, patch, operacao, version) => {
      const r = await client.rpc("character_life_set", { p_campaign: cid, p_note: noteId, p_patch: patch, p_operation: operacao, p_version: version ?? null });
      semErro(r);
      return linhaDeVida(r.data as { note_id: string; estado: EstadoVitalidade; pv: number | null; temp: number; condicoes: string[]; version: number });
    },
    setCombatSheet: async (cid, id, version, definitionId) => {
      await exigirBanco();
      semErro(await client.rpc("codex_set_combat_sheet", { p_campaign: cid, p_entry: id, p_version: version, p_definition_id: definitionId }));
    },
    links: async (cid, id) => conferir(await client.rpc("codex_links_for", { p_campaign: cid, p_entry: id })) as CodexLink[],
    link: async (cid, source, target, r) => conferir(await client.rpc("codex_link", { p_campaign: cid, p_source: source, p_target: target, p_kind: r.kind, p_relation: r.label, p_inverse: r.inverse, p_revealed: !!r.revealed })) as string,
    unlink: async (cid, id) => semErro(await client.rpc("codex_unlink", { p_campaign: cid, p_link: id })),
    feed: async (cid) => conferir(await client.rpc("codex_notification_feed", { p_campaign: cid })) as NotificationFeed,
    list: async (cid) =>
      conferir(await client.rpc("codex_list", { p_campaign: cid })) as Conhecimento[],
    save: async (cid, id, version, data) => {
      await exigirBanco();
      return conferir(await client.rpc("codex_save", { p_campaign: cid, p_entry: id, p_version: version, p_data: data })) as string;
    },
    reveal: async (cid, id, version, data) => {
      await exigirBanco();
      semErro(await client.rpc("codex_reveal", { p_campaign: cid, p_entry: id, p_version: version, p_visible: data.visible, p_revealed: data.revealed, p_links: data.links ?? {}, p_sheet: data.sheet ?? null }));
    },
    preview: async (cid, id) => conferir(await client.rpc("codex_preview", { p_campaign: cid, p_entry: id })) as Previa,
    remove: async (cid, id, version) => {
      const r = await client.rpc("codex_remove", {
        p_campaign: cid,
        p_entry: id,
        p_version: version,
      });
      if ((r.error as { message?: string } | null)?.message?.includes("npc_com_ficha")) throw Error("Este NPC tem uma ficha própria. Remova a ficha antes de remover a página.");
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
    seenAll: (cid,through,signal) => marcarLote(client,cid,through,signal),
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
  const { ativa } = useModoJogador();
  const real = useMemo(() => injected ?? (client && status === "authenticated" ? createCodexApi(client) : null), [injected, client, status]);
  return useMemo(() => real && ativa ? apiDePrevia(real) : real, [real, ativa]);
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
  const scope = `${user?.id}:${active?.campaign.id}:${active?.role}`;
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
      x.visible,
  );
