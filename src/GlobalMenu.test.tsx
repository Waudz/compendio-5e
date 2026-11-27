// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, screen, within} from "@testing-library/react";
import {memoryStorage, renderApp} from "./testUtils";
import {activeKey} from "./CampaignsContext";
import type {CampaignApi} from "./campaigns";
let mobile = true;
beforeEach(() => {
  mobile = true; vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("matchMedia", (q:string) => ({matches:mobile && q.includes("max-width"),addEventListener(){},removeEventListener(){}}));
  vi.stubGlobal("ResizeObserver", class {observe(){} unobserve(){} disconnect(){}});
});
afterEach(cleanup);
const api = (role:"mestre"|"jogador") => ({list: async () => ({ok:true,data:[{role,campaign:{id:"ca",name:"Mesa",description:"",created_at:""}}]})}) as CampaignApi;
it.each(["mestre", "jogador"] as const)("menu %s contém só ações disponíveis e evita duplicar a navegação", async role => {
  localStorage.setItem(activeKey("u1"),"ca"); await renderApp({api:api(role)});
  const bottom = within(screen.getByRole("navigation",{name:"Navegação mobile"}));
  expect(document.querySelector('.mobile-topbar [aria-label="Abrir menu"]')).toBeNull();
  fireEvent.click(bottom.getByRole("button",{name:"Menu"}));
  const menu = within(screen.getByRole("dialog",{name:"Menu de navegação"}));
  for (const label of ["Minha conta","Configurações","Sobre o Compêndio","Sair","Diário"]) expect(menu.getByRole("button",{name:label})).toBeTruthy();
  for (const label of ["Início","Anotações","Iniciativa","Compêndio"]) expect(menu.queryByRole("button",{name:label})).toBeNull();
  expect(menu.queryByRole("button",{name:"Encontros"}) !== null).toBe(role === "mestre");
  expect(menu.getByRole("button",{name: role === "mestre" ? "Personagens" : "Meus personagens"})).toBeTruthy();
  expect(document.querySelectorAll('.mobile-bottom-nav [aria-current="page"]')).toHaveLength(0);
  fireEvent.keyDown(document,{key:"Escape"}); expect(screen.queryByRole("dialog",{name:"Menu de navegação"})).toBeNull();
  expect(bottom.getByRole("button",{name:"Início"}).getAttribute("aria-current")).toBe("page");
});
it("desktop usa o mesmo menu e devolve foco ao fechar", async () => {
  mobile = false; await renderApp(); const trigger = screen.getByRole("button",{name:"Abrir menu global"}); trigger.focus(); fireEvent.click(trigger);
  expect(within(screen.getByRole("dialog",{name:"Menu de navegação"})).getByRole("button",{name:"Configurações"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Fechar menu"})); expect(document.activeElement).toBe(trigger);
});
it("a confirmação de alterações não salvas recebe teclado acima do menu", async () => {
  await renderApp(); fireEvent.click(within(screen.getByRole("navigation",{name:"Navegação mobile"})).getByRole("button",{name:"Menu"}));
  const confirmation = document.createElement("div"); confirmation.setAttribute("role","alertdialog"); confirmation.setAttribute("aria-modal","true");
  const cancel = document.createElement("button"); cancel.textContent = "Cancelar saída"; confirmation.append(cancel); document.body.append(confirmation);
  try {
    cancel.focus();
    const tab = new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true});
    expect(document.dispatchEvent(tab)).toBe(true);
    fireEvent.keyDown(cancel,{key:"Escape"});
    expect(screen.getByRole("dialog",{name:"Menu de navegação"})).toBeTruthy(); expect(document.activeElement).toBe(cancel);
  } finally {confirmation.remove();}
});
it("configurações preservam o tema salvo e Sobre usa a versão do menu", async () => {
  localStorage.setItem("compendio5e:preferencia-tema","claro"); await renderApp();
  const open = () => fireEvent.click(within(screen.getByRole("navigation",{name:"Navegação mobile"})).getByRole("button",{name:"Menu"}));
  open(); const version = screen.getByText(/^Compêndio [0-9].*Alpha$/).textContent;
  fireEvent.click(screen.getByRole("button",{name:"Configurações"}));
  const select = await screen.findByLabelText("Tema neste aparelho"); expect((select as HTMLSelectElement).value).toBe("claro");
  fireEvent.change(select,{target:{value:"escuro"}}); expect(localStorage.getItem("compendio5e:preferencia-tema")).toBe("escuro");
  open(); expect(screen.getByText(/^Compêndio [0-9].*Alpha$/).textContent).toBe(version);
  fireEvent.click(screen.getByRole("button",{name:"Sobre o Compêndio"}));
  expect(await screen.findByRole("heading",{name:"Sobre o Compêndio"})).toBeTruthy();
  expect(screen.getByRole("link",{name:"Repositório e documentação do projeto"}).getAttribute("href")).toBe("https://github.com/Waudz/compendio-5e");
});
