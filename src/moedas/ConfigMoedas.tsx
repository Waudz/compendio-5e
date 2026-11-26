// Configuração das moedas da campanha (só o mestre, dentro de "Editar campanha"). Desativar não apaga valores já guardados.
import { useEffect, useState } from "react";
import { EVENTO_MOEDAS, useConfigCampanha, useMoedasDaCampanha } from "../RegistrosContext";
import { IconeMoeda } from "./IconeMoeda";
import { MOEDAS, type ChaveMoeda } from "./moedas";

export function ConfigMoedas({ campaignId }: { campaignId: string }) {
  const api = useConfigCampanha(), atual = useMoedasDaCampanha(campaignId);
  const [escolha, setEscolha] = useState<ChaveMoeda[]>(atual.ativas), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [gravando, setGravando] = useState(false);
  const chave = atual.ativas.join(",");
  useEffect(() => setEscolha(atual.ativas), [chave]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!api) return <p className="muted">A configuração de moedas não está disponível neste modo.</p>;
  if (atual.pronto && !atual.suportado) return <p className="muted" role="note">A escolha de moedas depende de uma atualização do banco ainda não aplicada. Por enquanto, as cinco moedas ficam ativas.</p>;
  const salvar = async () => {
    setGravando(true); setMsg(null);
    const r = await api.salvarMoedas(campaignId, escolha); setGravando(false);
    if (!r.ok) { setMsg({ ok: false, t: r.error }); return; }
    setMsg({ ok: true, t: "Moedas da campanha atualizadas." }); window.dispatchEvent(new Event(EVENTO_MOEDAS));
  };
  return <div className="config-moedas">
    <p className="muted">Escolha as moedas que a mesa usa. As desativadas somem do inventário e das entregas; valores já guardados nelas não são apagados.</p>
    <div role="group" aria-label="Moedas em uso">{MOEDAS.map(m => <label key={m.chave} className="check"><input type="checkbox" checked={escolha.includes(m.chave)} disabled={!atual.pronto || gravando}
      onChange={e => { setMsg(null); setEscolha(a => (e.target.checked ? [...a, m.chave] : a.filter(c => c !== m.chave))); }}/> <IconeMoeda tipo={m.chave} tamanho={18}/> {m.nome} ({m.sigla})</label>)}</div>
    <button type="button" className="btn-secondary" disabled={gravando || !atual.pronto || escolha.length === 0 || [...escolha].sort().join() === [...atual.ativas].sort().join()} onClick={() => void salvar()}>{gravando ? "Salvando…" : "Salvar moedas"}</button>
    {escolha.length === 0 && <p className="notice err" role="alert">A campanha precisa de pelo menos uma moeda.</p>}
    {msg && <p className={msg.ok ? "notice ok" : "notice err"} role="status">{msg.t}</p>}
  </div>;
}
