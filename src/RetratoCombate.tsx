// Retrato padronizado do combate e dos encontros: quadrado, cantos levemente arredondados, imagem existente (ficha/catálogo) ou placeholder único.
import { Skull, Swords, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useAventureiros } from "./AventureirosContext";

export type TipoRetrato = "personagem" | "monstro" | "avulso";

/** Decorativo (o nome já aparece em texto ao lado): `alt` vazio. Se a imagem falhar ao carregar, cai no placeholder. */
export function RetratoQuadrado({ src, tipo = "avulso", tamanho = 44 }: { src?: string | null; tipo?: TipoRetrato; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [src]);
  const Icone = tipo === "monstro" ? Skull : tipo === "personagem" ? UserRound : Swords;
  return <span className="retrato-q" data-tipo={tipo} style={{ width: tamanho, height: tamanho }}>
    {src && !falhou ? <img src={src} alt="" loading="lazy" onError={() => setFalhou(true)}/> : <span className="retrato-q-vazio" aria-hidden="true" data-testid="retrato-placeholder"><Icone size={Math.round(tamanho * 0.5)}/></span>}
  </span>;
}

/** Retratos dos personagens da campanha (imagens já existentes nas fichas/identidade pública), por id estável. Sem fonte ou sem imagem: mapa vazio. */
export function useRetratosPersonagens(campaignId: string | null): ReadonlyMap<string, string> {
  const fonte = useAventureiros();
  const [mapa, setMapa] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    if (!fonte || !campaignId) { setMapa(new Map()); return; }
    let vivo = true;
    fonte.listar(campaignId).then(r => { if (vivo && r.ok) setMapa(new Map(r.data.flatMap(p => p.retratoUrl ? [[p.id, p.retratoUrl] as const] : []))); }, () => {});
    return () => { vivo = false; };
  }, [fonte, campaignId]);
  return mapa;
}
