import { useEffect, useState } from "react";
import { useCampaigns } from "./CampaignsContext";
import { useFichas } from "./RegistrosContext";
import { CriadorGuiado } from "./criador/CriadorGuiado";
import { FichaPagina } from "./Personagens";
import type { TabSpec } from "./workspace";

/** Resolve a origem da ficha antes de escolher o editor; fichas guiadas não pertencem à API legada de registros. */
export function FichaRoteada({ id, onOpenContent }: { id: string; onOpenContent: (s: TabSpec) => void }) {
  const fichas = useFichas();
  const { active } = useCampaigns();
  const campaignId = active?.campaign.id;
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] = useState<"carregando" | "guiada" | "legada" | "erro">("carregando");
  useEffect(() => {
    let ativo = true;
    setResultado("carregando");
    if (!fichas || !campaignId) { setResultado("legada"); return; }
    fichas.listar(campaignId).then(r => {
      if (ativo) setResultado(!r.ok ? "erro" : r.data.some(f => f.id === id) ? "guiada" : "legada");
    }).catch(() => { if (ativo) setResultado("erro"); });
    return () => { ativo = false; };
  }, [fichas, campaignId, id, tentativa]);
  if (resultado === "carregando") return <div className="content" role="status">Carregando ficha…</div>;
  if (resultado === "erro") return <div className="content" role="alert">Não foi possível verificar a ficha. Confira sua conexão e tente abrir novamente. <button type="button" className="btn-secondary" onClick={() => setTentativa(n => n + 1)}>Tentar de novo</button></div>;
  if (resultado === "guiada") return <CriadorGuiado id={id} onOpenContent={onOpenContent} initialView/>;
  return <FichaPagina id={id} onOpenContent={onOpenContent}/>;
}
