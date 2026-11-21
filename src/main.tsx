import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthGate } from "./AuthGate";
import { AuthProvider } from "./AuthContext";
import { CampaignsProvider } from "./CampaignsContext";
import { RegistrosProvider } from "./RegistrosContext";
import "./style.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);
const demo = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("demo") : null;   // só em `npm run dev`; removido do build de produção
if (demo === "criador-piloto") {
  void import("./dev/character-pilot").then(({ default: CharacterPilot }) => root.render(<React.StrictMode><CharacterPilot/></React.StrictMode>));
} else if (demo === "compendio-piloto") {
  void import("./dev/compendium-pilot").then(({ default: CompendiumPilot }) => root.render(<React.StrictMode><CompendiumPilot/></React.StrictMode>));
} else if (demo === "mestre" || demo === "jogador") {
  void import("./dev/demo").then(({ DemoRoot }) => root.render(<React.StrictMode><DemoRoot papel={demo}/></React.StrictMode>));
} else {
  root.render(<React.StrictMode><AuthProvider><CampaignsProvider><RegistrosProvider><AuthGate><App /></AuthGate></RegistrosProvider></CampaignsProvider></AuthProvider></React.StrictMode>);
}
