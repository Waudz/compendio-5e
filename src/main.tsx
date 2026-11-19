import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthGate } from "./AuthGate";
import { AuthProvider } from "./AuthContext";
import { CampaignsProvider } from "./CampaignsContext";
import "./style.css";
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><AuthProvider><CampaignsProvider><AuthGate><App /></AuthGate></CampaignsProvider></AuthProvider></React.StrictMode>);
