// Tema da interface: escuro (padrão do Compêndio), claro ou o do aparelho. É preferência deste aparelho; as cores vivem em `style.css`.
export type Tema = "escuro" | "claro" | "sistema";
export const CHAVE_TEMA = "compendio5e:preferencia-tema";
export const TEMAS: [Tema, string][] = [["escuro", "Escuro"], ["claro", "Claro"], ["sistema", "Igual ao aparelho"]];

export function lerTema(): Tema {
  try { const v = localStorage.getItem(CHAVE_TEMA); return v === "claro" || v === "sistema" ? v : "escuro"; } catch { return "escuro"; }
}
const consulta = () => (typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: light)") : null);
export function aplicarTema(tema: Tema = lerTema()) {
  const claro = tema === "claro" || (tema === "sistema" && !!consulta()?.matches);
  document.documentElement.dataset.tema = claro ? "claro" : "escuro";
}
export function salvarTema(tema: Tema) {
  try { localStorage.setItem(CHAVE_TEMA, tema); } catch { /* vale só nesta sessão */ }
  aplicarTema(tema);
}
/** Aplica ao abrir e acompanha o aparelho quando a escolha é "Igual ao aparelho". */
export function iniciarTema() {
  aplicarTema();
  consulta()?.addEventListener?.("change", () => { if (lerTema() === "sistema") aplicarTema(); });
}
