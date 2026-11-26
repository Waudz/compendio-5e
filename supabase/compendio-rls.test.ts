// PostgreSQL descartável: políticas reais, sem conexão com produção.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { storageStub } from "./stub-storage";
const stub =
  `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
` + storageStub;

let db: PGlite;
let cid: string;
let otherCampaign: string;
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const master = uid(1),
  player = uid(2),
  other = uid(3);
async function as(user: string | null, sql: string, args: unknown[] = []) {
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user ?? "",
  ]);
  try {
    return {
      rows: (await db.query<Record<string, unknown>>(sql, args)).rows,
      error: undefined as string | undefined,
    };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  } finally {
    await db.exec("reset role");
  }
}
const call = (user: string | null, fn: string, ...args: unknown[]) =>
  as(
    user,
    `select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`,
    args,
  );
async function save(user: string, id: string | null, v: number, data: unknown) {
  const r = await call(user, "codex_save", cid, id, v, JSON.stringify(data));
  expect(r.error).toBeUndefined();
  return r.rows[0].r as string;
}
const payload = (level: number, title = "Goblin") => ({
  category: "monster",
  systemId: "dnd5e-2014",
  definitionId: crypto.randomUUID(),
  title,
  description: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Descrição pública" }],
    },
  ],
  secret: "SEGREDO",
  stats: { ca: 15, pv: 7 },
  knowledge: level,
});
beforeAll(async () => {
  db = new PGlite();
  await db.exec(stub);
  for (const f of readdirSync(join(__dirname, "migrations"))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(join(__dirname, "migrations", f), "utf8"));
  for (let i = 1; i <= 3; i++)
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      uid(i),
      `synthetic${i}@example.invalid`,
    ]);
  cid = (await call(master, "create_campaign", "A", "")).rows[0].r as string;
  otherCampaign = (await call(other, "create_campaign", "B", "")).rows[0]
    .r as string;
  const invite = (await call(master, "create_invite", cid, 10, 7)).rows[0].r;
  expect((await call(player, "join_campaign", invite)).error).toBeUndefined();
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("Compêndio: fronteira de conhecimento e isolamento", () => {
  it("autenticação e vínculo atuais são obrigatórios inclusive por chamada direta", async () => {
    expect((await call(null, "codex_list", cid)).error).toMatch(
      /permission denied/,
    );
    expect((await call(other, "codex_list", cid)).error).toMatch(
      /sem_permissao/,
    );
    expect((await call(player, "codex_list", otherCampaign)).error).toMatch(
      /sem_permissao/,
    );
  });
  it.each([0, 1, 2, 3, 4])(
    "nível %i nunca projeta campos de níveis superiores ou notas secretas",
    async (level) => {
      const data = payload(level);
      const id = await save(master, null, 0, data);
      const list = (await call(player, "codex_list", cid)).rows[0].r as Record<
        string,
        unknown
      >[];
      const entry = list.find((x) => x.id === id);
      if (level === 0) {
        expect(entry).toBeUndefined();
        return;
      }
      expect(entry?.title).toBe("Goblin");
      expect(entry).not.toHaveProperty("secret");
      expect(!!entry?.description).toBe(level >= 2);
      expect(!!entry?.stats).toBe(level === 4);
      expect(!!entry?.definitionId).toBe(level === 4);
      expect(
        (await as(player, "select * from public.notes where id=$1", [id])).rows,
      ).toEqual([]);
      expect(
        (
          await as(player, "select * from public.campaign_codex where id=$1", [
            id,
          ])
        ).rows,
      ).toEqual([]);
    },
  );
  it("jogador e outro mestre não criam/editam/removem nem publicam o registro privado pela API genérica", async () => {
    const data = payload(1),
      id = await save(master, null, 0, data);
    for (const user of [player, other]) {
      expect(
        (
          await call(
            user,
            "codex_save",
            cid,
            null,
            0,
            JSON.stringify(payload(4)),
          )
        ).error,
      ).toMatch(/sem_permissao/);
      expect(
        (await call(user, "codex_save", cid, id, 1, JSON.stringify(data)))
          .error,
      ).toMatch(/sem_permissao/);
      expect((await call(user, "codex_remove", cid, id, 1)).error).toMatch(
        /sem_permissao/,
      );
    }
    expect(
      (
        await as(
          master,
          "update public.notes set visibility='campaign' where id=$1",
          [id],
        )
      ).error,
    ).toMatch(/registro_compendio_privado/);
  });
  it("versão, referência e campanha imutáveis; duplicatas não criam outra verdade", async () => {
    const data = payload(1),
      id = await save(master, null, 0, data);
    await save(master, id, 1, { ...data, title: "Correção" });
    expect(
      (await call(master, "codex_save", cid, id, 1, JSON.stringify(data)))
        .error,
    ).toMatch(/conflito/);
    expect(
      (
        await call(
          master,
          "codex_save",
          cid,
          id,
          2,
          JSON.stringify({ ...data, definitionId: "outra" }),
        )
      ).error,
    ).toMatch(/referencia_imutavel/);
    expect(
      (await call(master, "codex_save", cid, null, 0, JSON.stringify(data)))
        .error,
    ).toMatch(/unique/);
  });
  it("notificações idempotentes: correção textual e repetição do nível não notificam; revogação esconde", async () => {
    const data = payload(1),
      id = await save(master, null, 0, data);
    await save(master, id, 1, { ...data, title: "Renomeado" });
    await save(master, id, 2, { ...data, knowledge: 2 });
    await save(master, id, 3, { ...data, knowledge: 1 });
    await save(master, id, 4, { ...data, knowledge: 2 });
    const r = await as(
      player,
      "select knowledge from public.codex_notifications where entry_id=$1 order by knowledge",
      [id],
    );
    expect(r.error).toBeUndefined();
    expect(r.rows).toEqual([{ knowledge: 1 }, { knowledge: 2 }]);
    expect(
      (await as(other, "select * from public.codex_notifications")).rows,
    ).toEqual([]);
    await save(master, id, 5, { ...data, knowledge: 0 });
    expect(
      (
        await as(
          player,
          "select * from public.codex_notifications where entry_id=$1",
          [id],
        )
      ).rows,
    ).toEqual([]);
  });
  it("Storage nega imagem secreta, escrita alheia, UUID malformado e upsert; falha preserva ponteiro anterior", async () => {
    const data = payload(2),
      id = await save(master, null, 0, data),
      path = `${cid}/${id}/${uid(90)}`;
    expect(
      (
        await as(
          master,
          "insert into storage.objects(bucket_id,name) values('codex-assets',$1)",
          [path],
        )
      ).error,
    ).toBeUndefined();
    await save(master, id, 1, { ...data, imagePath: path });
    expect(
      (
        await as(
          player,
          "select name from storage.objects where bucket_id='codex-assets' and name=$1",
          [path],
        )
      ).rows,
    ).toEqual([]);
    await save(master, id, 2, { ...data, knowledge: 3, imagePath: path });
    expect(
      (
        await as(player, "select name from storage.objects where name=$1", [
          path,
        ])
      ).rows,
    ).toEqual([{ name: path }]);
    for (const user of [player, other])
      expect(
        (
          await as(
            user,
            "insert into storage.objects(bucket_id,name) values('codex-assets',$1)",
            [`${cid}/${id}/${crypto.randomUUID()}`],
          )
        ).error,
      ).toMatch(/row-level security/);
    expect(
      (
        await call(
          master,
          "codex_save",
          cid,
          id,
          3,
          JSON.stringify({
            ...data,
            imagePath: `${otherCampaign}/${id}/${uid(91)}`,
          }),
        )
      ).error,
    ).toMatch(/imagem_de_outro/);
    expect((await call(player, "codex_visible", id, -1)).rows).toEqual([
      { r: false },
    ]);
    expect(
      (await call(master, "codex_asset_access", "not/a/uuid", true)).rows,
    ).toEqual([{ r: false }]);
    expect(
      (
        (await call(player, "codex_list", cid)).rows[0].r as Record<
          string,
          unknown
        >[]
      ).find((x) => x.id === id)?.imagePath,
    ).toBe(path);
  });
  it("ex-mestre perde acesso até ao notes de que continua dono", async () => {
    const id = await save(master, null, 0, payload(0));
    await db.exec("alter table public.campaign_members disable trigger user");
    await db.query(
      "delete from public.campaign_members where campaign_id=$1 and user_id=$2",
      [cid, master],
    );
    try {
      expect(
        (await as(master, "select meta from public.notes where id=$1", [id]))
          .rows,
      ).toEqual([]);
      expect(
        (
          await as(
            master,
            "update public.notes set title='intruso' where id=$1 returning id",
            [id],
          )
        ).rows,
      ).toEqual([]);
      expect((await call(master, "codex_list", cid)).error).toMatch(
        /sem_permissao/,
      );
    } finally {
      await db.query(
        "insert into public.campaign_members(campaign_id,user_id,role) values($1,$2,'mestre')",
        [cid, master],
      );
      await db.exec("alter table public.campaign_members enable trigger user");
    }
  });

  it("portadores expõem apenas identidade pública; descoberta sobrevive à perda do item", async () => {
    const item = {
      category: "item",
      systemId: "dnd5e-2014",
      definitionId: "ring-of-invisibility",
      title: "Anel descoberto",
      knowledge: 4,
    };
    const eid = await save(master, null, 0, item);
    const hidden = { mode: "hidden" };
    const meta = {
      identidadePublica: {
        settings: {
          imageUrl: null,
          title: "",
          name: { mode: "custom", customValue: "Portador público" },
          surname: hidden,
          race: hidden,
          characterClass: hidden,
          level: hidden,
          description: "",
        },
        card: {
          imageUrl: null,
          title: "FALSO",
          name: "FALSO",
          surname: null,
          race: "FALSO",
          characterClass: "FALSO",
          level: "99",
          description: "",
        },
      },
    };
    const draft = {
      id: "provisorio",
      name: "NOME SECRETO",
      level: 3,
      inventory: [
        {
          id: "magic-instance",
          itemId: "ring-of-invisibility",
          quantity: 1,
          equipped: false,
          origin: "acquired",
        },
        {
          id: "private-other",
          itemId: "longsword",
          quantity: 1,
          equipped: false,
          origin: "acquired",
        },
      ],
      currentHp: 10,
    };
    const created = await as(
      master,
      "select * from public.create_guided_character($1,'x',$2::jsonb,false,$3::jsonb)",
      [cid, JSON.stringify(meta), JSON.stringify(draft)],
    );
    expect(created.error).toBeUndefined();
    const character = created.rows[0].character_id;
    const r = await call(player, "codex_holders", cid, eid);
    expect(r.error).toBeUndefined();
    expect(r.rows[0].r).toEqual([{ id: character, title: "Portador público" }]);
    expect(JSON.stringify(r.rows)).not.toMatch(
      /NOME SECRETO|longsword|inventory/,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      master,
    ]);
    await db.query(
      "update public.character_sheets set draft=jsonb_set(draft,'{inventory}','[]'::jsonb),revision=revision+1 where character_id=$1",
      [character],
    );
    expect((await call(player, "codex_holders", cid, eid)).rows[0].r).toEqual(
      [],
    );
    expect(
      (
        (await call(player, "codex_list", cid)).rows[0].r as { id: string }[]
      ).some((x) => x.id === eid),
    ).toBe(true);
  });
});
