// Classifica o impacto de um PR para decidir quanto validar. Falha fechada: qualquer dúvida vira "full".
//   quick      -> só documentação (checagens de governança do repositório);
//   functional -> só interface isolada (CSS, componentes e testes de tela sem acesso a dados): build, testes e E2E; sem a pilha Supabase;
//   full       -> todo o resto (autenticação, permissões, banco, persistência, lógica, dependências, infraestrutura).
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DOCS = /^(?:[^/]+\.md|docs\/(?:[^/]+\/)*[^/]+\.md)$/;
const CSS = /^src\/(?:[^/]+\/)*[^/]+\.css$/;
const INTERFACE = /^(?:src\/(?:[^/]+\/)*[^/]+\.tsx|e2e\/(?:[^/]+\/)*[^/]+\.(?:spec|quality|creator)\.ts)$/;
// Nomes que indicam dados, acesso ou estrutura: sempre validação completa, mesmo sendo .tsx.
const NOME_SENSIVEL = /auth|supabase|campaign|campanha|nuvem|remot|context|permiss|rls|persist|armazen|ficha|personage|storage|sess[aã]o|session|combate|encontro|iniciativa|loot|inventar|memoria|migra|unsaved|workspace|(?:^|\/)(?:main|App)\.tsx$/i;
// Conteúdo que toca dados ou o banco, mesmo em arquivo de nome inocente.
const CONTEUDO_SENSIVEL = /from\s+["'](?:\.{1,2}\/)+(?:[\w-]+\/)*(?:supabase|auth|nuvem|AuthContext|CampaignsContext|RegistrosContext|useLinhaRemota)["']|@supabase\/|localStorage|sessionStorage|indexedDB|\.rpc\(|\bfetch\(/;

/** `ler(caminho)` devolve o conteúdo na versão do PR; se falhar (arquivo removido, por exemplo), a validação é completa. */
export function classify(paths, ler = () => { throw new Error("sem leitor"); }) {
  if (!paths.length) return "full";
  if (paths.every(p => DOCS.test(p))) return "quick";
  const interfaceIsolada = p => {
    if (DOCS.test(p) || CSS.test(p)) return true;
    if (!INTERFACE.test(p) || NOME_SENSIVEL.test(p)) return false;
    try { return !CONTEUDO_SENSIVEL.test(ler(p)); } catch { return false; }
  };
  return paths.every(interfaceIsolada) ? "functional" : "full";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, head] = process.argv.slice(2);
  let level = "full";
  try {
    if (!/^[a-f0-9]{40}$/i.test(base ?? "") || !/^[a-f0-9]{40}$/i.test(head ?? "")) throw new Error("SHA inválido");
    const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    const paths = git(["diff", "--name-only", "--no-renames", "-z", base + "..." + head]).split("\0").filter(Boolean);
    level = classify(paths, p => git(["show", head + ":" + p]));
  } catch { /* falha fechada: validação completa */ }
  console.log(level);
}
