import { fireEvent, screen } from "@testing-library/react";
export function abrirAvulso() {
  if (!screen.queryByRole("form", { name: "Adicionar combatente" })) fireEvent.click(screen.getByRole("button", { name: "Combatente avulso" }));
}
export function abrirBusca(aba = "Todos") {
  fireEvent.click(screen.getByRole("button", { name: aba }));
  fireEvent.change(screen.getByLabelText("Buscar combatentes"), { target: { value: "" } });
  fireEvent.focus(screen.getByLabelText("Buscar combatentes"));
}
export async function abrirEncontro(nome: string) {
  abrirBusca("Encontros preparados"); fireEvent.click(await screen.findByRole("button", { name: `Selecionar encontro ${nome}` }));
}
