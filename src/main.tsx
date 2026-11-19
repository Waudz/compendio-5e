import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthGate } from "./AuthGate";
import { AuthProvider } from "./AuthContext";
import { CampaignsProvider } from "./CampaignsContext";
import "./style.css";
const root = document.getElementById("root")!;
// Laboratório do editor (PR 2, protótipo): só em desenvolvimento (ou build de medição com VITE_EDITOR_LAB=1) e só com ?lab=editor.
// Na build normal as duas condições são falsas em tempo de compilação: o código do laboratório e do BlockNote nem entram no pacote.
const labEnabled = import.meta.env.DEV || import.meta.env.VITE_EDITOR_LAB === "1";
if (labEnabled && new URLSearchParams(window.location.search).get("lab") === "editor") import("./lab/mount").then(m => m.mountLab(root));
else ReactDOM.createRoot(root).render(<React.StrictMode><AuthProvider><CampaignsProvider><AuthGate><App /></AuthGate></CampaignsProvider></AuthProvider></React.StrictMode>);
