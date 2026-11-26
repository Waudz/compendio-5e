import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthGate } from "./AuthGate";
import { AuthProvider } from "./AuthContext";
import { CampaignsProvider } from "./CampaignsContext";
import { RegistrosProvider } from "./RegistrosContext";
import "./style.css";
import { iniciarTema } from "./tema";

iniciarTema();
const root = ReactDOM.createRoot(document.getElementById("root")!);
const demo = __PREVIEW_DEMO__ ? (new URLSearchParams(window.location.search).get("demo") === "jogador" ? "jogador" : "mestre") : import.meta.env.DEV ? new URLSearchParams(window.location.search).get("demo") : null;
if (__PREVIEW_DEMO__) {
  document.title = "Preview experimental — Compêndio 5e";
  const aviso = document.createElement("div");
  aviso.textContent = "PREVIEW EXPERIMENTAL · dados simulados · não use dados reais";
  aviso.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#704c13;color:white;text-align:center;font:12px sans-serif;padding:3px;pointer-events:none";
  document.body.append(aviso);
}
if (demo === "criador-piloto") {
  void import("./dev/character-pilot").then(({ default: CharacterPilot }) => root.render(<React.StrictMode><CharacterPilot/></React.StrictMode>));
} else if (demo === "compendio-piloto") {
  void import("./dev/compendium-pilot").then(({ default: CompendiumPilot }) => root.render(<React.StrictMode><CompendiumPilot/></React.StrictMode>));
} else if (demo === "mestre" || demo === "jogador") {
  void import("./dev/demo").then(({ DemoRoot }) => root.render(<React.StrictMode><DemoRoot papel={demo}/></React.StrictMode>));
} else {
  root.render(<React.StrictMode><AuthProvider><CampaignsProvider><RegistrosProvider><AuthGate><App /></AuthGate></RegistrosProvider></CampaignsProvider></AuthProvider></React.StrictMode>);
}
