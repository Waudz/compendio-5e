// Planejamento (ponto de entrada). Só o mestre da campanha ativa. NESTA etapa é apenas a seção navegável com estado vazio:
// sessões, colunas, cartões, editor e persistência (migrações 0005+) entram em PRs próprios. Nada aqui finge estar pronto.
import { ClipboardList } from "lucide-react";
import { useCampaigns } from "./CampaignsContext";

export function PlanningPanel() {
  const { active } = useCampaigns();
  if (!active) return <div className="content"><h1>Planejamento</h1><div className="notice" role="status">O Planejamento pertence a uma campanha. Escolha uma campanha ativa na barra lateral.</div></div>;
  if (active.role !== "mestre") return <div className="content"><h1>Planejamento</h1><div className="notice" role="status">O Planejamento é exclusivo do mestre desta campanha.</div></div>;
  return <div className="content">
    <div className="eyebrow">{active.campaign.name.toLocaleUpperCase("pt-BR")}</div>
    <h1>Planejamento</h1>
    <p>Prepare as sessões da campanha em colunas e cartões, com páginas e encontros vinculados.</p>
    <div className="placeholder" data-testid="planejamento-vazio"><ClipboardList size={30} aria-hidden="true"/><strong>Nenhuma sessão planejada</strong>
      <span>O quadro de sessões ainda está em desenvolvimento: nesta versão esta seção só reserva o lugar. Nada é salvo aqui por enquanto.</span></div>
  </div>;
}
