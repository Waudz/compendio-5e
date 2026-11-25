// Classificação informativa: ainda não dispensa nenhum check obrigatório.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
export function classify(paths) {
  if (!paths.length) return "full";
  if (paths.every(p => /^(README\.md|docs\/[^\n]+\.md)$/.test(p))) return "quick";
  if (paths.every(p => /^src\/(?:[^/]+\/)*[^/]+\.css$/.test(p))) return "functional";
  return "full";
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, head] = process.argv.slice(2);
  let level = "full";
  try {
    if (!/^[a-f0-9]{40}$/i.test(base ?? "") || !/^[a-f0-9]{40}$/i.test(head ?? "")) throw new Error("SHA inválido");
    const paths = execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", base + "..." + head], { encoding: "utf8" }).split("\0").filter(Boolean);
    level = classify(paths);
  } catch { /* falha fechada: validação completa */ }
  console.log(level);
}
