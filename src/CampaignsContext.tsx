import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  const [snapshot, setSnapshot] = useState<{ api: CampaignApi; memberships: Membership[]; loading: boolean; error: string | null } | null>(null);
  const request = useRef(0);
  const liveApi = useRef(api); liveApi.current = api;
  const validated = useRef<{ api: CampaignApi; ids: Set<string> } | null>(null);
  const current = snapshot?.api === api ? snapshot : null;
  const memberships = useMemo(() => current?.memberships ?? [], [current]);
  const loading = !!api && (!current || current.loading);
  const error = current?.error ?? null;
  const [chosen, setChosen] = useState<{ uid: string; id: string | null } | null>(null);
  const activeRaw = userId ? (chosen?.uid === userId ? chosen.id : read(activeKey(userId))) : null;

  const refresh = useCallback(async () => {
    if (!api) return;
    const ticket = ++request.current;
    setSnapshot(prev => ({ api, memberships: prev?.api === api ? prev.memberships : [], loading: true, error: null }));
    let r: Awaited<ReturnType<CampaignApi["list"]>>;
    try { r = await api.list(); }
    catch { r = { ok: false, error: "Não foi possível carregar suas campanhas. Verifique a conexão e tente novamente." }; }
    if (ticket !== request.current || liveApi.current !== api) return;
    if (r.ok) validated.current = { api, ids: new Set(r.data.map(m => m.campaign.id)) };
    setSnapshot(prev => ({ api, memberships: r.ok ? r.data : prev?.api === api ? prev.memberships : [], loading: false, error: r.ok ? null : r.error }));
  }, [api]);

  useEffect(() => {
    if (api) void refresh();
    else setSnapshot(null);
    return () => { request.current++; };
  }, [api, refresh]);

  const active = useMemo(() => memberships.find(m => m.campaign.id === activeRaw)
    ?? (!loading && !error ? [...memberships].sort((a,b) => a.campaign.id.localeCompare(b.campaign.id))[0] ?? null : null),
    [memberships, activeRaw, loading, error]);
  const activeId = active?.campaign.id ?? (loading || error ? activeRaw : null);
  const setActive = useCallback((id: string | null) => {
    if (userId && id && api && liveApi.current === api && validated.current?.api === api && validated.current.ids.has(id)) {
      write(activeKey(userId), id); setChosen({ uid: userId, id });
    }
  }, [userId, api]);
  useEffect(() => {
    if (!userId || loading || error) return;
    if (active && active.campaign.id !== activeRaw) setActive(active.campaign.id);
    else if (!active && activeRaw) {
      write(activeKey(userId), null);
      setChosen({ uid: userId, id: null });
    }
  }, [userId, loading, error, active, activeRaw, setActive]);

  const value = useMemo(() => ({ api, memberships, loading, error, activeId, active, setActive, refresh }), [api, memberships, loading, error, activeId, active, setActive, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
