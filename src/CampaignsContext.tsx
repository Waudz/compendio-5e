import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { createCampaignApi, type CampaignApi, type Membership } from "./campaigns";

export type CampaignsValue = {
  api: CampaignApi | null;           // null: sem sessão ou Supabase não configurado
  memberships: Membership[];
  loading: boolean;
  error: string | null;
  activeId: string | null;           // uma única campanha ativa por vez
  active: Membership | null;
  setActive: (id: string | null) => void;
  refresh: () => Promise<void>;
};
const Ctx = createContext<CampaignsValue>({ api: null, memberships: [], loading: false, error: null, activeId: null, active: null, setActive() {}, async refresh() {} });
export const useCampaigns = () => useContext(Ctx);

export const activeKey = (userId: string) => `compendio5e:active-campaign:${userId}`;
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* sem armazenamento */ } };

/** `apiFactory` existe só para testes. Em produção usa o cliente Supabase da sessão. */
export function CampaignsProvider({ children, apiFactory }: { children: ReactNode; apiFactory?: (userId: string) => CampaignApi }) {
  const { status, user, client } = useAuth();
  const userId = status === "authenticated" ? user?.id ?? null : null;
  const api = useMemo(() => userId ? (apiFactory ? apiFactory(userId) : client ? createCampaignApi(client, userId) : null) : null, [userId, client, apiFactory]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [fetching, setFetching] = useState(false);
  const [loadedFor, setLoadedFor] = useState<CampaignApi | null>(null);   // api cuja primeira listagem já terminou
  const [error, setError] = useState<string | null>(null);
  // Campanha ativa lida de forma SÍNCRONA no mesmo render em que o usuário passa a existir (antes era lida num efeito, e o primeiro
  // render do espaço de trabalho usava "nenhuma" e mostrava o layout/aba de Campanhas por um instante ao atualizar a página).
  const [chosen, setChosen] = useState<{ uid: string; id: string | null } | null>(null);
  const activeRaw = userId ? (chosen?.uid === userId ? chosen.id : read(activeKey(userId))) : null;
  // Até a primeira listagem terminar, "carregando": o espaço de trabalho mantém a campanha ativa lembrada em vez de cair em "nenhuma".
  const loading = fetching || (!!api && loadedFor !== api);

  const refresh = useCallback(async () => {
    if (!api) { setMemberships([]); setError(null); return; }
    setFetching(true);
    const r = await api.list();
    setFetching(false); setLoadedFor(api);
    if (r.ok) { setMemberships(r.data); setError(null); } else setError(r.error);
  }, [api]);

  useEffect(() => { // carrega ao entrar; ao sair, zera tudo (nada de dados de outra conta)
    setMemberships([]); setError(null);
    if (api) void refresh();
  }, [api, userId, refresh]);

  // A campanha ativa só vale se o usuário ainda participa dela (foi removido? sai do estado ativo).
  const active = useMemo(() => memberships.find(m => m.campaign.id === activeRaw) ?? null, [memberships, activeRaw]);
  const activeId = active ? active.campaign.id : (loading || error ? activeRaw : null); // enquanto carrega, mantém o espaço de trabalho
  const setActive = useCallback((id: string | null) => { if (userId) { write(activeKey(userId), id); setChosen({ uid: userId, id }); } }, [userId]);

  const value = useMemo(() => ({ api, memberships, loading, error, activeId, active, setActive, refresh }), [api, memberships, loading, error, activeId, active, setActive, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
