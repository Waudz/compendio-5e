// Ícone de moeda em SVG próprio: disco com acabamento metálico na cor de cada metal. Serve ao inventário e, depois, ao loot, ao
// equipamento inicial, aos preços e às transferências. As cores do metal são fixas; o aro escuro e o brilho claro garantem contraste
// tanto no tema escuro quanto no claro. Decorativo por padrão: o nome da moeda sempre aparece em texto ao lado (ou em `rotulo`).
import { useId } from "react";
import { MOEDAS, type ChaveMoeda } from "./moedas";

const METAL: Record<ChaveMoeda, { brilho: string; base: string; sombra: string; aro: string }> = {
  cp: { brilho: "#f6c2a0", base: "#c2733f", sombra: "#7c3f1c", aro: "#5c2d12" },
  sp: { brilho: "#ffffff", base: "#bcc4cc", sombra: "#6f7a86", aro: "#4b545e" },
  ep: { brilho: "#f3f6c8", base: "#b9c177", sombra: "#6f7a3c", aro: "#4d5528" },
  gp: { brilho: "#fff0a8", base: "#e0ad1f", sombra: "#8f6606", aro: "#6a4a03" },
  pp: { brilho: "#f4fbff", base: "#a9c4d6", sombra: "#557389", aro: "#35505f" },
};

export function IconeMoeda({ tipo, tamanho = 20, rotulo }: { tipo: ChaveMoeda; tamanho?: number; rotulo?: boolean }) {
  const id = useId().replace(/:/g, ""), c = METAL[tipo], nome = MOEDAS.find(m => m.chave === tipo)!.nome;
  return <svg className="icone-moeda" data-moeda={tipo} width={tamanho} height={tamanho} viewBox="0 0 24 24" focusable="false"
    {...(rotulo ? { role: "img", "aria-label": `Moeda de ${nome.toLocaleLowerCase("pt-BR")}` } : { "aria-hidden": true })}>
    <defs>
      <linearGradient id={`f${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c.brilho}/><stop offset=".45" stopColor={c.base}/><stop offset="1" stopColor={c.sombra}/></linearGradient>
      <linearGradient id={`m${id}`} x1="1" y1="1" x2="0" y2="0"><stop offset="0" stopColor={c.brilho}/><stop offset=".55" stopColor={c.base}/><stop offset="1" stopColor={c.sombra}/></linearGradient>
    </defs>
    <circle cx="12" cy="12" r="11" fill={`url(#f${id})`} stroke={c.aro} strokeWidth="1"/>
    <circle cx="12" cy="12" r="7.6" fill={`url(#m${id})`} stroke={c.aro} strokeWidth=".6" strokeOpacity=".7"/>
    <path d="M12 7.4l1.35 3.25 3.25 1.35-3.25 1.35L12 16.6l-1.35-3.25L7.4 12l3.25-1.35z" fill={c.brilho} fillOpacity=".85" stroke={c.sombra} strokeWidth=".5"/>
    <path d="M4.6 8.2A8.6 8.6 0 0 1 12 3.4" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>;
}
