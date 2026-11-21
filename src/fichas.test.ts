// Cliente de fichas (Supabase) com um cliente SIMULADO: confere as chamadas e o mapeamento de erros. O comportamento real do banco (RLS, revisão,
// imutabilidade) é validado em `supabase/character-sheets.test.ts`; o funcionamento no Supabase hospedado depende da migração 0012 (não aplicada).
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ERRO_SCHEMA } from "./campaigns";
import { cartaoPublico, createFichasApi, ehConflitoDeRevisao, ehGuiado, ERRO_CONFLITO_REVISAO, identidadeDe, MAX_META_IDENTIDADE, projetarIdentidade } from "./fichas";
import type { CharacterDraft } from "./rules/character-domain";
import { defaultPublicIdentity } from "./rules/public-identity";

const draft = { id: "x", name: "Thorin Real", level: 3, inventory: [{ id: "i", itemId: "longsword", quantity: 1, equipped: false, origin: "acquired" }] } as unknown as CharacterDraft;
const entrada = (o: { nome?: string; modoNome?: "real" | "hidden" | "custom"; titulo?: string; publicar?: boolean } = {}) => ({
  identity: { ...defaultPublicIdentity(), title: o.titulo ?? "", name: { mode: o.modoNome ?? "real", customValue: "Alcunha" } }, source: { name: o.nome ?? "Thorin Real", surname: "", race: "Anão", characterClass: "Guerreiro" }, publicar: o.publicar ?? false,
});

type Resp = { data?: unknown; error?: unknown };
/** Cliente falso: registra as chamadas e devolve as respostas configuradas. Encadeamento de consultas suficiente para o que a API usa. */
function falso(respostas: { rpc?: Resp | (() => Promise<Resp>); tabelas?: Record<string, Resp> }) {
  const chamadas: { rpc?: [string, Record<string, unknown>]; from?: string; filtros: [string, unknown][] } = { filtros: [] };
  const cadeia = (tabela: string): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "order"]) c[m] = () => c;
    c.eq = (col: string, v: unknown) => { chamadas.filtros.push([col, v]); return c; };
    const fim = () => Promise.resolve(respostas.tabelas?.[tabela] ?? { data: [], error: null });
    c.maybeSingle = fim; c.then = (ok: (v: Resp) => unknown, err: (e: unknown) => unknown) => fim().then(ok, err);
    return c;
  };
  const client = {
    from: (t: string) => { chamadas.from = t; return cadeia(t); },
    rpc: (nome: string, args: Record<string, unknown>) => { chamadas.rpc = [nome, args]; const r = respostas.rpc; return typeof r === "function" ? r() : Promise.resolve(r ?? { data: [], error: null }); },
  } as unknown as SupabaseClient;
  return { client, chamadas };
}

describe("projeção da identidade pública (o que vai para a linha pública do banco)", () => {
  it("nome oculto nunca vaza o nome real; sem título, nome ou alcunha o título cai em 'Personagem'", () => {
    const p = projetarIdentidade(entrada({ modoNome: "hidden" }));
    expect(p.titulo).toBe("Personagem");
    expect(JSON.stringify(p)).not.toContain("Thorin Real");
    expect(projetarIdentidade(entrada({ modoNome: "custom" })).titulo).toBe("Alcunha");
    expect(projetarIdentidade(entrada({ titulo: "O Escudo" })).titulo).toBe("O Escudo");
  });
  it("o meta público tem só `identidadePublica` (configurações + cartão): sem ficha, nível, PV, inventário ou atributos", () => {
    const e = entrada({ modoNome: "hidden" }); e.identity.race = { mode: "hidden" }; e.identity.characterClass = { mode: "hidden" };
    const p = projetarIdentidade(e);
    expect(Object.keys(p.meta)).toEqual(["identidadePublica"]);
    expect(Object.keys(p.meta.identidadePublica).sort()).toEqual(["card", "settings"]);
    expect(JSON.stringify(p.meta)).not.toMatch(/level|nivel|inventory|baseAbilities|currentHp|Guerreiro|Anão|Thorin Real/);   // raça e classe só aparecem se o jogador as mostrar (modo real/personalizado)
  });
  it("recusa identidade grande demais para a coluna meta (16 KiB) em vez de truncar", () => {
    const e = entrada(); e.identity.description = "x".repeat(MAX_META_IDENTIDADE + 10);
    expect(() => projetarIdentidade(e)).toThrow(/grande demais/);
  });
  it("cartão público de meta malformado é descartado (nunca inventa dados) e `guiado` é reconhecido", () => {
    expect(cartaoPublico({ identidadePublica: { card: { title: 3 } } })).toBeNull();
    expect(cartaoPublico(undefined)).toBeNull();
    expect(identidadeDe({ guiado: true, identidadePublica: { settings: defaultPublicIdentity() } }, true)).toBeNull();   // sem cartão
    expect(ehGuiado({ guiado: true })).toBe(true); expect(ehGuiado({ classe: "Mago" })).toBe(false); expect(ehGuiado({ guiado: "true" })).toBe(false);
  });
});

describe("criar e salvar (RPC)", () => {
  it("criar envia a ficha e SÓ a identidade pública projetada, com a escolha explícita de publicar", async () => {
    const { client, chamadas } = falso({ rpc: { data: [{ character_id: "srv-1", revision: 1, updated_at: "t" }], error: null } });
    const r = await createFichasApi(client).criar("ca", draft, entrada({ modoNome: "hidden", titulo: "O Escudo", publicar: true }));
    expect(r).toEqual({ ok: true, data: { id: "srv-1", revision: 1, updatedAt: "t" } });
    const [nome, args] = chamadas.rpc!;
    expect(nome).toBe("create_guided_character");
    expect(args).toMatchObject({ p_campaign_id: "ca", p_title: "O Escudo", p_publish: true, p_draft: draft });
    expect(Object.keys(args).sort()).toEqual(["p_campaign_id", "p_draft", "p_meta", "p_publish", "p_title"]);   // nenhuma coluna de dono/campanha/revisão do cliente
    expect(JSON.stringify(args.p_meta)).not.toMatch(/Thorin Real|inventory|longsword/);
  });
  it("salvar envia a revisão esperada; sem identidade (mestre) não envia título, meta nem publicação", async () => {
    const { client, chamadas } = falso({ rpc: { data: [{ revision: 5, updated_at: "t" }], error: null } });
    const api = createFichasApi(client);
    expect(await api.salvar("srv-1", 4, draft)).toEqual({ ok: true, data: { id: "srv-1", revision: 5, updatedAt: "t" } });
    expect(Object.keys(chamadas.rpc![1]).sort()).toEqual(["p_draft", "p_expected_revision", "p_id"]);
    await api.salvar("srv-1", 5, draft, entrada({ titulo: "Novo" }));
    expect(chamadas.rpc![1]).toMatchObject({ p_id: "srv-1", p_expected_revision: 5, p_title: "Novo", p_publish: false });
  });
  it("mapeia os erros do banco para mensagens em português sem expor detalhes internos", async () => {
    const com = (error: unknown) => createFichasApi(falso({ rpc: { data: null, error } }).client).salvar("i", 1, draft);
    const conflito = await com({ message: "conflito_de_revisao", code: "40001" });
    expect(ehConflitoDeRevisao(conflito)).toBe(true); expect(conflito).toEqual({ ok: false, error: ERRO_CONFLITO_REVISAO });
    expect(await com({ message: "ficha_nao_encontrada", code: "P0002" })).toMatchObject({ ok: false, error: expect.stringMatching(/não encontrado ou sem permissão/) });
    expect(await com({ message: "identidade_so_do_dono", code: "42501" })).toMatchObject({ error: expect.stringMatching(/Só o dono/) });
    expect(await com({ message: "violates check constraint \"character_sheets_draft_check\"" })).toMatchObject({ error: expect.stringMatching(/grande demais/) });
    expect(await com({ message: "violates check constraint \"notes_guiado_meta_check\"" })).toMatchObject({ error: expect.stringMatching(/não permitidos/) });
    expect(await com({ message: "permission denied for table character_sheets", code: "42501" })).toMatchObject({ error: "Você não tem permissão para esta operação." });
    const faltando = await com({ message: "Could not find the function public.save_guided_character", code: "PGRST202" });
    expect(faltando).toEqual({ ok: false, error: ERRO_SCHEMA });                                   // migração 0012 ainda não aplicada: mensagem clara, nunca "lista vazia"
    expect(ehConflitoDeRevisao(faltando)).toBe(false);
  });
  it("queda de rede (exceção do fetch) vira 'sem conexão', não um erro técnico", async () => {
    const { client } = falso({ rpc: () => Promise.reject(new TypeError("Failed to fetch")) });
    expect(await createFichasApi(client).salvar("i", 1, draft)).toEqual({ ok: false, error: "Sem conexão com o servidor." });
    expect(await createFichasApi(client).criar("ca", draft, entrada())).toEqual({ ok: false, error: "Sem conexão com o servidor." });
  });
  it("resposta vazia do servidor é erro, nunca sucesso presumido", async () => {
    const { client } = falso({ rpc: { data: [], error: null } });
    expect((await createFichasApi(client).salvar("i", 1, draft)).ok).toBe(false);
    expect((await createFichasApi(client).criar("ca", draft, entrada())).ok).toBe(false);
  });
});

describe("listar e carregar", () => {
  it("listar usa só a campanha pedida (a RLS decide o resto) e deriva nome e nível sem trazer a ficha toda", async () => {
    const { client, chamadas } = falso({ tabelas: { character_sheets: { data: [{ character_id: "a", owner_id: "u1", revision: 2, updated_at: "t", nome: " Thorin ", nivel: "3" }, { character_id: "b", owner_id: "u1", revision: 1, updated_at: "t", nome: null, nivel: null }], error: null } } });
    const r = await createFichasApi(client).listar("ca");
    expect(chamadas.from).toBe("character_sheets"); expect(chamadas.filtros).toEqual([["campaign_id", "ca"]]);
    expect(r).toEqual({ ok: true, data: [{ id: "a", ownerId: "u1", nome: "Thorin", nivel: 3, revision: 2, updatedAt: "t" }, { id: "b", ownerId: "u1", nome: "Sem nome", nivel: null, revision: 1, updatedAt: "t" }] });
  });
  it("listar com a tabela fechada (migração/privilégios pendentes) devolve erro, não lista vazia", async () => {
    const { client } = falso({ tabelas: { character_sheets: { data: null, error: { message: "permission denied for table character_sheets", code: "42501" } } } });
    expect(await createFichasApi(client).listar("ca")).toEqual({ ok: false, error: "Você não tem permissão para esta operação." });
  });
  it("carregar: inexistente ou sem permissão é `null`; o mestre (sem acesso à nota privada) recebe a ficha e identidade null", async () => {
    expect(await createFichasApi(falso({ tabelas: { character_sheets: { data: null, error: null } } }).client).carregar("x")).toEqual({ ok: true, data: null });
    const linha = { character_id: "a", campaign_id: "ca", owner_id: "u1", revision: 3, draft, updated_at: "t" };
    const mestre = await createFichasApi(falso({ tabelas: { character_sheets: { data: linha, error: null }, notes: { data: null, error: null } } }).client).carregar("a");
    expect(mestre).toMatchObject({ ok: true, data: { ficha: { id: "a", ownerId: "u1", revision: 3 }, identidade: null } });
    const settings = defaultPublicIdentity(), card = { imageUrl: null, title: "O Escudo", name: null, surname: null, race: null, characterClass: null, description: "" };
    const dono = await createFichasApi(falso({ tabelas: { character_sheets: { data: linha, error: null }, notes: { data: { meta: { guiado: true, identidadePublica: { settings, card } }, visibility: "campaign" }, error: null } } }).client).carregar("a");
    expect(dono).toMatchObject({ ok: true, data: { identidade: { publicada: true, card: { title: "O Escudo" } } } });
  });
});
