// Retrato padronizado do combate e dos encontros: quadrado, cantos levemente arredondados, imagem existente (ficha/catálogo) ou placeholder único.
import { Skull, Swords, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useAventureiros } from "./AventureirosContext";
import { useCapa, useFichas } from "./RegistrosContext";
import { estiloEnquadramento, juntar, separar } from "./imagem/enquadramento";

export type TipoRetrato = "personagem" | "monstro" | "avulso";

/** Retrato enviado (`storage:<campanha>/<arquivo>`) vira um endereço temporário; os demais valores passam como estão. O enquadramento
 *  que viaja no fim da referência é preservado. */
export function useEnderecoDaImagem(src: string | null | undefined): string | null {
  const capa = useCapa();
  const partes = src?.startsWith("storage:") ? separar(src) : null;
  const guardado = partes ? partes.base.slice("storage:".length) : null;
  const [assinado, setAssinado] = useState<{ de: string; url: string } | null>(null);
  useEffect(() => {
    if (!guardado || !capa) return;
    let vivo = true;
    void capa.urlDe(guardado).then(r => { if (vivo && r.ok) setAssinado({ de: guardado, url: r.data }); }, () => { /* sem acesso: fica o ícone padrão */ });
    return () => { vivo = false; };
  }, [guardado, capa]);
  if (guardado) return assinado?.de === guardado ? juntar(assinado.url, partes!.enquadramento) : null;
  return src ?? null;
}

/** Decorativo (o nome já aparece em texto ao lado): `alt` vazio. Se a imagem falhar ao carregar, cai no placeholder. */
export function RetratoQuadrado({ src, tipo = "avulso", tamanho = 44 }: { src?: string | null; tipo?: TipoRetrato; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false);
  const referencia = useEnderecoDaImagem(src);
  const { base: endereco, enquadramento } = referencia ? separar(referencia) : { base: null, enquadramento: null };
  useEffect(() => setFalhou(false), [endereco]);
  const Icone = tipo === "monstro" ? Skull : tipo === "personagem" ? UserRound : Swords;
  return <span className="retrato-q" data-tipo={tipo} style={{ width: tamanho, height: tamanho }}>
    {endereco && !falhou ? <img src={endereco} alt="" loading="lazy" style={estiloEnquadramento(enquadramento!)} onError={() => setFalhou(true)}/> : <span className="retrato-q-vazio" aria-hidden="true" data-testid="retrato-placeholder"><Icone size={Math.round(tamanho * 0.5)}/></span>}
  </span>;
}

/** Retratos dos personagens da campanha, por id estável: a MESMA imagem da ficha (para quem pode lê-la) e, para os demais, a da
 *  apresentação publicada. Sem fonte ou sem imagem: mapa vazio. */
export function useRetratosPersonagens(campaignId: string | null): ReadonlyMap<string, string> {
  const fonte = useAventureiros(), fichas = useFichas();
  const [mapa, setMapa] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    if (!campaignId || (!fonte && !fichas)) { setMapa(new Map()); return; }
    let vivo = true;
    const publicos = fonte ? fonte.listar(campaignId).then(r => (r.ok ? r.data : []), () => []) : Promise.resolve([]);
    const dasFichas = fichas ? fichas.listar(campaignId).then(r => (r.ok ? r.data : []), () => []) : Promise.resolve([]);
    void Promise.all([publicos, dasFichas]).then(([p, f]) => {
      if (!vivo) return;
      const m = new Map(p.flatMap(x => (x.retratoUrl ? [[x.id, x.retratoUrl] as const] : [])));
      for (const x of f) if (x.retrato) m.set(x.id, x.retrato);   // a ficha é a origem do retrato
      setMapa(m);
    });
    return () => { vivo = false; };
  }, [fonte, fichas, campaignId]);
  return mapa;
}
