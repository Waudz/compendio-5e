import {ListChecks} from "lucide-react";
import {MenuDeAcoes} from "./MenuDeAcoes";
// Seleção múltipla em listas e grades: um texto discreto liga o modo; as caixas só aparecem nele; as ações coletivas, só com algo
// marcado. Vale apenas o que está elegível E visível: quem a página passar em `elegiveis` já respeita campanha, filtros e permissões.
import { useEffect, useState, type ReactNode } from "react";
import "./ui.css";

export type Selecao = {
  ativa: boolean;
  /** Marcados que continuam elegíveis (o que saiu do filtro não conta nem entra em ações). */ marcados: string[];
  total: number;
  entrar: () => void; cancelar: () => void;
  alternar: (id: string) => void; marcado: (id: string) => boolean;
  marcarTodos: () => void; desmarcarTodos: () => void;
};

/** `escopo`: ao mudar (outra campanha, outro usuário), a seleção é encerrada. O resultado recebe os elegíveis a cada desenho, depois
 *  dos filtros da página (que pode ter retornos antecipados entre o estado e a lista). */
export function useSelecao(escopo: string): (elegiveis: readonly string[]) => Selecao {
  const [estado, setEstado] = useState<{ escopo: string; ids: string[] } | null>(null);
  useEffect(() => { setEstado(null); }, [escopo]);
  const ativa = estado?.escopo === escopo;
  const definir = (ids: string[]) => setEstado({ escopo, ids });
  return elegiveis => {
    const marcados = ativa ? elegiveis.filter(id => estado.ids.includes(id)) : [];
    return {
      ativa, marcados, total: elegiveis.length,
      entrar: () => definir([]), cancelar: () => setEstado(null),
      alternar: id => definir(marcados.includes(id) ? marcados.filter(x => x !== id) : [...marcados, id]),
      marcado: id => marcados.includes(id),
      marcarTodos: () => definir([...elegiveis]), desmarcarTodos: () => definir([]),
    };
  };
}

export function BarraDeSelecao({ selecao, acoes, rotulo = "Seleção" }: { selecao: Selecao; /** Ações coletivas: só aparecem com algo marcado. */ acoes?: ReactNode; rotulo?: string }) {
  if (!selecao.ativa) return selecao.total ? <MenuDeAcoes rotulo="Mais ações da lista" acoes={[{rotulo:"Selecionar",icone:ListChecks,acao:selecao.entrar}]}/> : null;
  const n = selecao.marcados.length, todos = selecao.total > 0 && n === selecao.total;
  return <div className="multi-selecao" role="group" aria-label={rotulo}>
    {selecao.total > 0 && <button type="button" className="multi-selecao-link" onClick={todos ? selecao.desmarcarTodos : selecao.marcarTodos}>{todos ? "Desmarcar todos" : "Selecionar todos"}</button>}
    <span className="multi-selecao-contagem" role="status">{n} {n === 1 ? "selecionado" : "selecionados"}</span>
    <button type="button" className="multi-selecao-link" onClick={selecao.cancelar}>Cancelar</button>
    {n > 0 && acoes && <span className="multi-selecao-acoes">{acoes}</span>}
  </div>;
}
