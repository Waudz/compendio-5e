// PROTÓTIPO: ponto de entrada do laboratório. Carregado por import dinâmico só em desenvolvimento (ou com VITE_EDITOR_LAB=1 para medições).
import React from "react";
import ReactDOM from "react-dom/client";
import Lab from "./Lab";

export function mountLab(el: HTMLElement) {
  ReactDOM.createRoot(el).render(<React.StrictMode><Lab/></React.StrictMode>);
}
