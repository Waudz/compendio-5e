// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BackupLocal } from "./CombateCompartilhado";

afterEach(() => { cleanup(); localStorage.clear(); });
it("dispensa somente o aviso, preserva o backup e respeita a chave da campanha", () => {
  localStorage.setItem("combate-a", '{"rodada":2}');
  localStorage.setItem("combate-b", '{"rodada":3}');
  const view = render(<BackupLocal chave="combate-a" rotulo="combate"/>);
  fireEvent.click(screen.getByRole("button", { name: "Dispensar aviso" }));
  expect(screen.queryByRole("note")).toBeNull();
  expect(localStorage.getItem("combate-a")).toBe('{"rodada":2}');
  view.unmount();
  const again = render(<BackupLocal chave="combate-a" rotulo="combate"/>);
  expect(screen.queryByRole("note")).toBeNull();
  again.rerender(<BackupLocal chave="combate-b" rotulo="combate"/>);
  expect(screen.getByRole("button", { name: "Baixar backup" })).toBeTruthy();
});
