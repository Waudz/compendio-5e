// Estado remoto versionado com salvamento automático (DEC-20261123-H): toda alteração vai ao servidor, uma gravação por vez e em ordem, com confirmação antes de
// dizer "salvo", nova tentativa automática quando a rede falha, conflito de versão explícito (nunca sobrescreve em silêncio) e recarga segura entre aparelhos.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiLinha, ResultadoLinha } from "./linhaRemota";

/** salvo = confirmado pelo servidor · salvando = gravação em andamento · falha = rede/servidor (tentando de novo) · conflito = outra sessão gravou antes · permissao = acesso negado */
export type SyncRemoto = "salvo" | "salvando" | "falha" | "conflito" | "permissao";
export type CargaRemota<T> = { status: "carregando" } | { status: "erro"; mensagem: string } | { status: "pronto"; valor: T };
type Falha = Extract<ResultadoLinha<unknown>, { ok: false }>;

export function useLinhaRemota<T>({ api, campaignId, vazio, chaveBackup, atrasoBase = 2000 }: {
  api: ApiLinha<T> | null; campaignId: string | null; vazio: () => T; chaveBackup: string | null; atrasoBase?: number;
}) {
  const [carga, setCarga] = useState<CargaRemota<T>>({ status: "carregando" });
  const [sync, setSync] = useState<SyncRemoto>("salvo");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const valor = useRef<T | null>(null), versao = useRef(0), pendente = useRef(false), emVoo = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), tentativas = useRef(0), montado = useRef(true), escopo = useRef(0);
  const syncRef = useRef<SyncRemoto>("salvo"), apiRef = useRef(api), vazioRef = useRef(vazio);
  apiRef.current = api; vazioRef.current = vazio;
  const marcar = useCallback((s: SyncRemoto, m: string | null = null) => { syncRef.current = s; if (montado.current) { setSync(s); setMensagem(m); } }, []);
  const camp = campaignId;

  const guardarBackup = useCallback(() => {
    if (!chaveBackup || valor.current === null) return;
    try { localStorage.setItem(`${chaveBackup}:nao-sincronizado`, JSON.stringify({ em: new Date().toISOString(), valor: valor.current })); } catch { /* sem armazenamento: o aviso na tela já explica */ }
  }, [chaveBackup]);

  const drenar = useCallback((): Promise<void> => {
    if (emVoo.current) return emVoo.current;
    const meuEscopo = escopo.current;
    const tarefa = (async () => {
      try {
        while (pendente.current && apiRef.current && camp && meuEscopo === escopo.current) {
          pendente.current = false;
          marcar("salvando");
          const alvo = valor.current as T;
          const r = await apiRef.current.salvar(camp, alvo, versao.current);
          if (meuEscopo !== escopo.current) return;
          if (r.ok) { versao.current = r.data.versao; tentativas.current = 0; continue; }
          const f: Falha = r;
          if (f.tipo === "indisponivel") {
            pendente.current = true; marcar("falha", f.mensagem);
            const atraso = Math.min(30000, atrasoBase * 2 ** tentativas.current++);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => { timer.current = null; void drenar(); }, atraso);
            return;
          }
          guardarBackup();   // conflito/permissão/inválido: o que o mestre digitou não se perde
          marcar(f.tipo === "conflito" ? "conflito" : f.tipo === "permissao" ? "permissao" : "falha", f.mensagem);
          return;
        }
        if (meuEscopo === escopo.current && !pendente.current) marcar("salvo");
      } finally { emVoo.current = null; }
    })();
    emVoo.current = tarefa;
    return tarefa;
  }, [camp, marcar, atrasoBase, guardarBackup]);

  const carregar = useCallback(async () => {
    const meuEscopo = ++escopo.current;
    pendente.current = false; tentativas.current = 0;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const a = apiRef.current;
    if (!a || !camp) { setCarga({ status: "carregando" }); return; }
    setCarga({ status: "carregando" });
    const r = await a.carregar(camp);
    if (meuEscopo !== escopo.current || !montado.current) return;
    if (!r.ok) { setCarga({ status: "erro", mensagem: r.mensagem }); return; }
    valor.current = r.data.valor; versao.current = r.data.versao; marcar("salvo");
    setCarga({ status: "pronto", valor: r.data.valor });
  }, [camp, marcar]);

  useEffect(() => { montado.current = true; void carregar(); return () => { montado.current = false; escopo.current++; if (timer.current) clearTimeout(timer.current); }; }, [carregar, api]);

  /** Aplica a alteração na tela na hora e a envia ao servidor. Recusada (false) enquanto houver conflito/permissão negada, para não empilhar alterações sem base. */
  const alterar = useCallback((fn: (atual: T) => T): boolean => {
    if (valor.current === null || syncRef.current === "conflito" || syncRef.current === "permissao") return false;
    const novo = fn(valor.current);
    if (novo === valor.current) return true;
    valor.current = novo; pendente.current = true;
    setCarga({ status: "pronto", valor: novo });
    void drenar();
    return true;
  }, [drenar]);

  /** Descarta as alterações locais ainda não confirmadas e lê de novo do servidor (ação explícita do mestre). */
  const recarregar = useCallback(async () => { await carregar(); }, [carregar]);
  const tentarAgora = useCallback(() => { tentativas.current = 0; if (timer.current) { clearTimeout(timer.current); timer.current = null; } void drenar(); }, [drenar]);

  /** Aguarda gravações pendentes e remove o combate no servidor (apenas se houver linha). Devolve `true` somente com confirmação. */
  const finalizar = useCallback(async (): Promise<{ ok: true } | { ok: false; mensagem: string }> => {
    const a = apiRef.current; if (!a?.finalizar || !camp) return { ok: false, mensagem: "Finalização remota indisponível." };
    await drenar();
    if (pendente.current || syncRef.current !== "salvo") return { ok: false, mensagem: "Há alterações ainda não gravadas no servidor. Resolva antes de finalizar." };
    if (versao.current > 0) {
      const r = await a.finalizar(camp, versao.current);
      if (!r.ok) return { ok: false, mensagem: r.mensagem };
    }
    valor.current = vazioRef.current(); versao.current = 0; marcar("salvo"); setCarga({ status: "pronto", valor: valor.current });
    return { ok: true };
  }, [camp, drenar, marcar]);

  // outro aparelho pode ter gravado: ao voltar à janela, relê se não há nada pendente (nunca por cima de alteração local)
  /** Relê só se o servidor tem versão mais nova e não há nada pendente (nunca por cima de alteração local). */
  const reler = useCallback(async () => {
    if (pendente.current || emVoo.current || syncRef.current !== "salvo" || !apiRef.current || !camp) return;
      const meuEscopo = escopo.current, r = await apiRef.current.carregar(camp);
      if (!r.ok || meuEscopo !== escopo.current || pendente.current || emVoo.current || r.data.versao <= versao.current) return;
      valor.current = r.data.valor; versao.current = r.data.versao; setCarga({ status: "pronto", valor: r.data.valor });
  }, [camp, api]);
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState !== "hidden") void reler(); };
    document.addEventListener("visibilitychange", aoVoltar); window.addEventListener("focus", aoVoltar);
    return () => { document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("focus", aoVoltar); };
  }, [reler]);
  useEffect(() => {
    const aoSair = (e: BeforeUnloadEvent) => { if (pendente.current || emVoo.current || syncRef.current === "falha" || syncRef.current === "conflito") { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", aoSair); return () => window.removeEventListener("beforeunload", aoSair);
  }, []);

  return { carga, sync, mensagem, alterar, recarregar, reler, tentarAgora, finalizar, sujo: sync !== "salvo" };
}
