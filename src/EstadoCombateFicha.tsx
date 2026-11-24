// Estado em combate na ficha do jogador: PV e condições informados pelo mestre (migração 0011). Mostra SÓ isso: nada de ordem, turno, rodada ou outros combatentes.
// Atualiza em tempo real (Realtime) e, como reserva, a cada 15 s e ao voltar para a janela.
import { Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { useNuvem } from "./nuvem";
import type { StatusFicha } from "./statusCombate";

export function EstadoCombateFicha({ characterId }: { characterId: string }) {
  const api = useNuvem()?.status;
  const [status, setStatus] = useState<StatusFicha | null>(null), [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    setStatus(null); setErro(null);
    if (!api) return;
    let ativo = true, sequencia = 0;
    const ler = async () => {
      const pedido = ++sequencia;
      const r = await api.ler(characterId);
      if (!ativo || pedido !== sequencia) return;
      if (r.ok) { setStatus(r.status); setErro(null); } else setErro(r.mensagem);
    };
    const cancelar = api.assinar(characterId, () => void ler());
    void ler();
    const t = setInterval(() => void ler(), 15000), aoVoltar = () => { if (document.visibilityState !== "hidden") void ler(); };
    window.addEventListener("focus", aoVoltar); document.addEventListener("visibilitychange", aoVoltar);
    return () => { ativo = false; cancelar(); clearInterval(t); window.removeEventListener("focus", aoVoltar); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [api, characterId]);
  if (!api) return null;
  const vazio = !status || (status.hp === null && status.condicoes.length === 0);
  if (vazio && !erro) return null;
  return <section className="criador-ficha estado-combate" aria-label="Estado em combate">
    <h2><Swords size={16} aria-hidden="true"/> Estado em combate</h2>
    {erro && <p className="muted" role="status">{erro} Mostrando o último estado conhecido.</p>}
    {status && <>
      {status.hp !== null && <p><strong>PV em combate:</strong> <span data-testid="pv-combate">{status.hp}/{status.max}</span>{status.hp === 0 ? " · caído" : ""}</p>}
      {status.condicoes.length > 0 && <p><strong>Condições:</strong> {status.condicoes.map(c => <span key={c} className="ini-chip">{c}</span>)}</p>}
      <p className="muted">Informado pelo mestre{status.atualizadoEm ? ` em ${new Date(status.atualizadoEm).toLocaleString("pt-BR")}` : ""}. Seus PV na ficha continuam sendo os que você registrou.</p>
    </>}
  </section>;
}
