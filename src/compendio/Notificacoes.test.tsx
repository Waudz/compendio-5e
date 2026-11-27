// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {NotificacoesProvider,SinoNotificacoes} from "./Notificacoes";
import type {NotificationFeed} from "./conhecimento";
const h=vi.hoisted(()=>({uid:"u1",cid:"ca",feed:vi.fn(),seen:vi.fn(),seenAll:vi.fn()}));
vi.mock("../AuthContext",()=>({useAuth:()=>({user:{id:h.uid}})}));
vi.mock("../CampaignsContext",()=>({useCampaigns:()=>({active:{campaign:{id:h.cid},role:"jogador"}})}));
vi.mock("./conhecimento",()=>({EVENTO_CODEX:"test-codex",useCodexApi:()=>api}));
const api={feed:h.feed,seen:h.seen,seenAll:h.seenAll};
let feed:NotificationFeed;
const item=(id:number)=>({id,entry_id:"entry"+id,title:"Carta "+id,category:"discovery" as const,is_new:true,read_at:null,created_at:"2026-11-27T10:00:00Z"});
const app=()=> <NotificacoesProvider><SinoNotificacoes onOpenContent={()=>{}}/></NotificacoesProvider>;
const open=async()=>{fireEvent.click(await screen.findByRole("button",{name:"Notificações, 2 não lidas"}));return screen.findByRole("button",{name:"Marcar todas como lidas"});};
beforeEach(()=>{h.uid="u1";h.cid="ca";feed={items:[item(2),item(1)],unread:2,discoveries:2};h.feed.mockReset().mockImplementation(async()=>structuredClone(feed));h.seenAll.mockReset();h.seen.mockReset();});
afterEach(cleanup);
describe("janela de notificações",()=>{
 it("persiste o lote, atualiza contador e preserva a notificação que chegou durante a operação",async()=>{
  h.seenAll.mockImplementation(async()=>{feed={items:[item(3)],unread:1,discoveries:1};});render(app());fireEvent.click(await open());
  await screen.findByRole("button",{name:"Notificações, 1 não lidas"});expect(h.seenAll).toHaveBeenCalledWith("ca",2,expect.any(AbortSignal));
  cleanup();render(app());await screen.findByRole("button",{name:"Notificações, 1 não lidas"});
 });
 it("sem pendências oculta a ação; erro de rede não zera contador nem exclui notificações",async()=>{
  h.seenAll.mockRejectedValue(Error("offline"));render(app());fireEvent.click(await open());await screen.findByRole("alert");expect(screen.getByRole("button",{name:"Notificações, 2 não lidas"})).toBeTruthy();
  cleanup();feed={items:[],unread:0,discoveries:0};render(app());fireEvent.click(await screen.findByRole("button",{name:"Notificações"}));expect(screen.queryByRole("button",{name:"Marcar todas como lidas"})).toBeNull();
 });
 it.each(["campanha","usuário"])("troca de %s aborta lote e ignora resposta antiga",async mode=>{
  let finish!:()=>void;let signal!:AbortSignal;
  h.seenAll.mockImplementation((_c,_id,s)=>{signal=s;return new Promise<void>(r=>{finish=r;});});
  const view=render(app());fireEvent.click(await open());await waitFor(()=>expect(h.seenAll).toHaveBeenCalledOnce());
  if(mode==="campanha")h.cid="cb";else h.uid="u2";
  feed={items:[],unread:0,discoveries:0};view.rerender(app());expect(signal.aborted).toBe(true);
  await act(async()=>finish());expect(screen.queryByRole("dialog")).toBeNull();expect(screen.queryByRole("alert")).toBeNull();await screen.findByRole("button",{name:"Notificações"});
 });
});
