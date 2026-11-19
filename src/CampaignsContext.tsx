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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRaw, setActiveRaw] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api) { setMemberships([]); setError(null); return; }
    setLoading(true);
    const r = await api.list();
    setLoading(false);
    if (r.ok) { setMemberships(r.data); setError(null); } else setError(r.error);
  }, [api]);

  useEffect(() => { // carrega ao entrar; ao sair, zera tudo (nada de dados de outra conta)
    setMemberships([]); setError(null);
    setActiveRaw(userId ? read(activeKey(userId)) : null);
    if (api) void refresh();
  }, [api, userId, refresh]);

  // A campanha ativa só vale se o usuário ainda participa dela (foi removido? sai do estado ativo).
  const active = useMemo(() => memberships.find(m => m.campaign.id === activeRaw) ?? null, [memberships, activeRaw]);
  const activeId = active ? active.campaign.id : (loading || error ? activeRaw : null); // enquanto carrega, mantém o espaço de trabalho
  const setActive = useCallback((id: string | null) => { if (userId) write(activeKey(userId), id); setActiveRaw(id); }, [userId]);

  const value = useMemo(() => ({ api, memberships, loading, error, activeId, active, setActive, refresh }), [api, memberships, loading, error, activeId, active, setActive, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
