// Numeração das migrações: sem repetição, sem buracos, com rollback, e o livro-razão em dia (ver supabase/migrations/LEIA-ME.md).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const dir = join(root, "supabase", "migrations"), rb = join(root, "supabase", "rollback");
const migrations = readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
const num = (f: string) => Number(f.slice(0, 4));

describe("numeração das migrações", () => {
  it("nomes no formato NNNN_nome.sql, números únicos e sequenciais a partir de 0001", () => {
    for (const f of migrations) expect(f, f).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
    expect(migrations.map(num)).toEqual(migrations.map((_, i) => i + 1));
  });
  it("toda migração a partir da 0004 tem rollback com o mesmo número", () => {
    for (const f of migrations.filter(f => num(f) >= 4)) {
      const n = f.slice(0, 4);
      expect(readdirSync(rb).some(r => r.startsWith(n + "_") && r.endsWith("_down.sql")), `rollback da ${n}`).toBe(true);
    }
  });
  it("o livro-razão lista todas as migrações existentes e distingue migrações confirmadas e pendentes", () => {
    const l = readFileSync(join(dir, "LEIA-ME.md"), "utf8");
    for (const f of migrations) expect(l, f).toContain("`" + f.slice(0, 4) + "`");
    for (const n of ["0005", "0006", "0008"]) expect(l).toMatch(new RegExp(`\\| \`${n}\` \\|[^\\n]*aplicada — confirmada no remoto`));
    for (const n of ["0009", "0010", "0011"]) expect(l).toMatch(new RegExp(`\\| \`${n}\` \\|[^\\n]*PROPOSTA — não aplicada`));
    for (const n of ["0001", "0002", "0003", "0004", "0007"]) expect(l).toMatch(new RegExp(`\\| \`${n}\` \\|[^\\n]*\\*\\*aplicada\\*\\*`));
  });
  it("migração proposta declara no cabeçalho que não foi aplicada, e nenhum arquivo do repositório contém credenciais de banco", () => {
    expect(readFileSync(join(dir, "0005_notas_conteudo.sql"), "utf8").split("\n")[0]).toMatch(/NÃO APLICADA/);
    for (const f of migrations) expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/postgres(ql)?:\/\/[^\s]*:[^\s]*@|service_role_key|sb_secret_/i);
    expect(readFileSync(join(dir, "0006_registros_capa_personagens.sql"), "utf8").split("\n")[0]).toMatch(/NÃO APLICADA/);
    expect(existsSync(join(root, "supabase", "migrations", "0007_x.sql"))).toBe(false);   // não aceitar arquivo fictício
  });
});
