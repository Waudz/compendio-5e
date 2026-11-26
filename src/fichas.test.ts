// Cliente de fichas (Supabase) com um cliente SIMULADO: confere as chamadas e o mapeamento de erros. O comportamento real do banco (RLS, revisão,
// imutabilidade) é validado em `supabase/character-sheets.test.ts`; o funcionamento no Supabase hospedado depende da migração 0008 (não aplicada).
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ERRO_SCHEMA } from "./campaigns";
import { cartaoPublico, createFichasApi, ehConflitoDeRevisao, ehGuiado, ERRO_CONFLITO_REVISAO, identidadeDe, MAX_META_IDENTIDADE, projetarIdentidade } from "./fichas";
import type { CharacterDraft } from "./rules/character-domain";
import { defaultPublicIdentity, type CampoPublico } from "./rules/public-identity";

const draft = { id: "x", name: "Thorin Real", level: 3, inventory: [{ id: "i", itemId: "longsword", quantity: 1, equipped: false, origin: "acquired" }] } as unknown as CharacterDraft;
const entrada = (o: { nome?: string; modoNome?: "sheet" | "hidden" | "custom"; alcunha?: string; retrato?: string } = {}) => ({
  identity: { ...defaultPublicIdentity(), name: { mode: o.modoNome ?? "sheet", value: "Apelido" } as CampoPublico }, source: { name: o.nome ?? "Thorin Real", alias: o.alcunha ?? "", race: "Anão", characterClass: "Guerreiro", level: "3", portrait: o.retrato ?? "" },
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
    expect(projetarIdentidade(entrada({ modoNome: "custom" })).titulo).toBe("Apelido");
    expect(projetarIdentidade(entrada({ alcunha: "O Escudo" })).titulo).toBe("O Escudo");
  });
  it("o meta público tem só `identidadePublica` (configurações + cartão): sem ficha, PV, inventário ou atributos; o nível oculto não vai", () => {
    const e = entrada({ modoNome: "hidden" }); e.identity.race = { mode: "hidden" }; e.identity.characterClass = { mode: "hidden" }; e.identity.alias = { mode: "hidden" }; e.identity.level = { mode: "hidden" };
    const p = projetarIdentidade(e);
    expect(p.meta.identidadePublica.card.level).toBeNull();
    expect(Object.keys(p.meta)).toEqual(["identidadePublica"]);
    expect(Object.keys(p.meta.identidadePublica).sort()).toEqual(["card", "settings"]);
    expect(JSON.stringify(p.meta)).not.toMatch(/nivel|inventory|baseAbilities|currentHp|Guerreiro|Anão|Thorin Real/);   // raça e classe só aparecem se o jogador as mostrar (modo real/personalizado)
  });
  it("espelha as regras do servidor (0008): retrato só https, textos dentro dos limites, sem retrato vira nenhum", () => {
    const com = (f: (e: ReturnType<typeof entrada>) => void) => { const e = entrada(); f(e); return () => projetarIdentidade(e); };
    expect(com(e => { e.source.portrait = "http://exemplo.com/a.png"; })).toThrow(/https/);
    expect(com(e => { e.source.portrait = "javascript:alert(1)"; })).toThrow(/https/);
    expect(com(e => { e.source.portrait = "https://x.com/a b.png"; })).toThrow(/https/);
    expect(com(e => { e.identity.alias = { mode: "custom", value: "x".repeat(121) }; })).toThrow(/alcunha pública passa de 120/);
    expect(com(e => { e.identity.description = "x".repeat(4001); })).toThrow(/descrição pública passa de 4000/);
    expect(com(e => { e.identity.name = { mode: "custom", value: "x".repeat(121) }; })).toThrow(/nome público passa de 120/);
    expect(com(e => { e.source.portrait = "https://exemplo.com/retrato.png"; })).not.toThrow();
    expect(com(e => { e.source.portrait = "storage:11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222"; })).not.toThrow();
    expect(com(e => { e.source.portrait = "storage:../segredo"; })).toThrow(/https/);
    const vazio = projetarIdentidade(entrada({ retrato: "   " })).meta.identidadePublica;
    expect(vazio.card.imageUrl).toBeNull();
    expect(vazio.settings.imageUrl).toBeNull();
  });
  it("grava só as chaves que o banco aceita, e a leitura devolve o mesmo modelo", () => {
    const e = entrada({ alcunha: "O Escudo", retrato: "https://exemplo.com/r.png" }); e.identity.race = { mode: "hidden" }; e.identity.characterClass = { mode: "custom", value: "Mercenário" };
    const { meta } = projetarIdentidade(e), chaves = ["characterClass", "description", "imageUrl", "level", "name", "race", "surname", "title"];
    expect(Object.keys(meta.identidadePublica.card).sort()).toEqual(chaves);
    expect(Object.keys(meta.identidadePublica.settings).sort()).toEqual(chaves);
    const lido = identidadeDe({ guiado: true, ...meta }, true)!;
    expect(lido.card).toEqual({ name: "Thorin Real", alias: "O Escudo", race: null, characterClass: "Mercenário", level: "3", description: "", imageUrl: "https://exemplo.com/r.png" });
    expect(lido.identity).toEqual({ ...e.identity, name: { mode: "sheet" } });
  });
  it("recusa descrição grande demais em vez de truncar (limite de 4000; o meta total cabe com folga nos 16 KiB da coluna)", () => {
    const e = entrada(); e.identity.description = "x".repeat(4001);
    expect(() => projetarIdentidade(e)).toThrow(/passa de 4000/);
    const ok = entrada(); ok.identity.description = "x".repeat(4000);
    expect(JSON.stringify(projetarIdentidade(ok).meta).length).toBeLessThan(MAX_META_IDENTIDADE);
  });
  it("cartão público de meta malformado é descartado (nunca inventa dados) e `guiado` é reconhecido", () => {
    expect(cartaoPublico({ identidadePublica: { card: { title: 3 } } })).toBeNull();
    expect(cartaoPublico(undefined)).toBeNull();
    expect(identidadeDe({ guiado: true, identidadePublica: { settings: defaultPublicIdentity() } }, true)).toBeNull();   // sem cartão
    expect(ehGuiado({ guiado: true })).toBe(true); expect(ehGuiado({ classe: "Mago" })).toBe(false); expect(ehGuiado({ guiado: "true" })).toBe(false);
  });
});

describe("criar e salvar (RPC)", () => {
  it("criar envia a ficha e SÓ a identidade pública projetada, sempre visível para a campanha", async () => {
    const { client, chamadas } = falso({ rpc: { data: [{ character_id: "srv-1", revision: 1, updated_at: "t" }], error: null } });
    const r = await createFichasApi(client).criar("ca", draft, entrada({ modoNome: "hidden", alcunha: "O Escudo" }));
    expect(r).toEqual({ ok: true, data: { id: "srv-1", revision: 1, updatedAt: "t" } });
    const [nome, args] = chamadas.rpc!;
    expect(nome).toBe("create_guided_character");
    expect(args).toMatchObject({ p_campaign_id: "ca", p_title: "O Escudo", p_publish: true, p_draft: { ...draft, _protocolo: 2 } });   // o banco remove o sinal antes de guardar
    expect(Object.keys(args).sort()).toEqual(["p_campaign_id", "p_draft", "p_meta", "p_publish", "p_title"]);   // nenhuma coluna de dono/campanha/revisão do cliente
    expect(JSON.stringify(args.p_meta)).not.toMatch(/Thorin Real|inventory|longsword/);
  });
  it("salvar envia a revisão esperada; sem identidade (mestre) não envia título, meta nem publicação", async () => {
    const { client, chamadas } = falso({ rpc: { data: [{ revision: 5, updated_at: "t" }], error: null } });
    const api = createFichasApi(client);
    expect(await api.salvar("srv-1", 4, draft)).toEqual({ ok: true, data: { id: "srv-1", revision: 5, updatedAt: "t" } });
    expect(Object.keys(chamadas.rpc![1]).sort()).toEqual(["p_draft", "p_expected_revision", "p_id"]);
    expect(chamadas.rpc![1].p_draft).toMatchObject({ _protocolo: 2 });
    expect(draft).not.toHaveProperty("_protocolo");
    await api.salvar("srv-1", 5, draft, entrada({ alcunha: "Novo" }));
    expect(chamadas.rpc![1]).toMatchObject({ p_id: "srv-1", p_expected_revision: 5, p_title: "Novo", p_publish: true });
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
    expect(faltando).toEqual({ ok: false, error: ERRO_SCHEMA });                                   // migração 0008 ainda não aplicada: mensagem clara, nunca "lista vazia"
    expect(ehConflitoDeRevisao(faltando)).toBe(false);
  });
  it("identidade inválida é recusada ANTES de qualquer chamada ao servidor, com a mensagem certa (criar e salvar)", async () => {
    const { client, chamadas } = falso({ rpc: { data: [], error: null } });
    const ruim = entrada({ retrato: "http://exemplo.com/a.png" });
    const api = createFichasApi(client);
    expect(await api.criar("ca", draft, ruim)).toEqual({ ok: false, error: expect.stringMatching(/https/) });
    expect(await api.salvar("i", 1, draft, ruim)).toEqual({ ok: false, error: expect.stringMatching(/https/) });
    expect(chamadas.rpc).toBeUndefined();
  });
  it("erros novos do banco (identidade inválida, exclusão e alteração proibidas) viram mensagens em português", async () => {
    const com = (error: unknown) => createFichasApi(falso({ rpc: { data: null, error } }).client).salvar("i", 1, draft);
    expect(await com({ message: "identidade_invalida", code: "23514" })).toMatchObject({ error: expect.stringMatching(/dados não permitidos/) });
    expect(await com({ message: "personagem_guiado_nao_exclui", code: "42501" })).toMatchObject({ error: expect.stringMatching(/não podem ser excluídos/) });
    expect(await com({ message: "personagem_guiado_imutavel", code: "42501" })).toMatchObject({ error: expect.stringMatching(/não é permitida/) });
    expect(await com({ message: "violates check constraint \"character_sheets_revision_check\"" })).toMatchObject({ error: expect.stringMatching(/grande demais ou inválida/) });
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
    const settings = { imageUrl: null, title: "", name: { mode: "real" }, surname: { mode: "real" }, race: { mode: "real" }, characterClass: { mode: "real" }, description: "" }, card = { imageUrl: null, title: "O Escudo", name: null, surname: null, race: null, characterClass: null, description: "" };
    const dono = await createFichasApi(falso({ tabelas: { character_sheets: { data: linha, error: null }, notes: { data: { meta: { guiado: true, identidadePublica: { settings, card } }, visibility: "campaign" }, error: null } } }).client).carregar("a");
    expect(dono).toMatchObject({ ok: true, data: { identidade: { publicada: true, card: { alias: "O Escudo" } } } });
  });
});
