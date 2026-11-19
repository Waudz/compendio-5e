// Carrega o editor rico sob demanda (o app inicial não paga o custo do BlockNote) com estados de carregamento e de falha.
import { Component, lazy, Suspense, type ReactNode } from "react";
import type { PageEditorProps } from "./PageEditor";

const PageEditor = lazy(() => import("./PageEditor"));

class Falha extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  render() {
    return this.state.erro
      ? <div className="notice err" role="alert">Não foi possível carregar o editor. Verifique a conexão e <button className="btn-link" onClick={() => this.setState({ erro: false })}>tente de novo</button>.</div>
      : this.props.children;
  }
}

export function EditorLazy(p: PageEditorProps) {
  return <Falha><Suspense fallback={<p className="muted" role="status">Carregando o editor…</p>}><PageEditor {...p}/></Suspense></Falha>;
}
