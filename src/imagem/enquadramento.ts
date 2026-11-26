// Enquadramento NÃO destrutivo de qualquer imagem editável: ponto em foco (x, y em %) e zoom. O arquivo original nunca é cortado.
// Geometria do Compêndio 1.0 (`js/enquadramento.js`): a imagem cobre o quadro, é ampliada pelo zoom e deslocada pelo ponto em foco.
// A mesma conta é o que o CSS faz com `object-fit: cover` + `object-position` + `scale` na origem do ponto, então a prévia é exata.
export type Enquadramento = { zoom: number; x: number; y: number };
export const ENQUADRAMENTO_PADRAO: Enquadramento = { zoom: 1, x: 50, y: 50 };
/** Mesmo limite da capa no banco (migração 0012). */
export const ZOOM_MAXIMO = 3;

const faixa = (v: unknown, min: number, max: number, padrao: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao);
export function normalizar(v: unknown): Enquadramento {
  const o = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  return { zoom: faixa(o.zoom, 1, ZOOM_MAXIMO, 1), x: faixa(o.x, 0, 100, 50), y: faixa(o.y, 0, 100, 50) };
}
export const ehPadrao = (e: Enquadramento) => e.zoom === 1 && e.x === 50 && e.y === 50;
export const estiloEnquadramento = (e: Enquadramento) => ({ objectPosition: `${e.x}% ${e.y}%`, transform: `scale(${e.zoom})`, transformOrigin: `${e.x}% ${e.y}%` });

/** Tamanho e posição da imagem num quadro `largura` × `altura`, e quanto sobra em cada eixo (o que dá para arrastar). */
export function medir(imagem: { largura: number; altura: number }, quadro: { largura: number; altura: number }, e: Enquadramento) {
  const escala = Math.max(quadro.largura / imagem.largura, quadro.altura / imagem.altura) * e.zoom;
  const largura = imagem.largura * escala, altura = imagem.altura * escala;
  return { largura, altura, sobraX: largura - quadro.largura, sobraY: altura - quadro.altura };
}
/** Arrastar a imagem `dx`, `dy` pixels: a imagem acompanha o dedo ou o mouse. */
export function arrastar(e: Enquadramento, dx: number, dy: number, sobra: { sobraX: number; sobraY: number }): Enquadramento {
  return normalizar({ zoom: e.zoom, x: sobra.sobraX > 0.5 ? e.x - (dx * 100) / sobra.sobraX : e.x, y: sobra.sobraY > 0.5 ? e.y - (dy * 100) / sobra.sobraY : e.y });
}

// ---------------------------------------------------------------- referência + enquadramento no mesmo texto
// O retrato é guardado como texto (ficha, apresentação pública, listas). O enquadramento viaja no fim dele (`#enq=zoom,x,y`), para
// que todo lugar que mostra a imagem mostre o MESMO recorte.
const SUFIXO = /#enq=(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/;
export function separar(referencia: string): { base: string; enquadramento: Enquadramento } {
  const m = SUFIXO.exec(referencia);
  return m ? { base: referencia.slice(0, m.index), enquadramento: normalizar({ zoom: Number(m[1]), x: Number(m[2]), y: Number(m[3]) }) } : { base: referencia, enquadramento: ENQUADRAMENTO_PADRAO };
}
const curto = (n: number) => String(Math.round(n * 100) / 100);
export function juntar(base: string, e: Enquadramento): string {
  const limpo = separar(base).base, n = normalizar(e);
  return ehPadrao(n) ? limpo : `${limpo}#enq=${curto(n.zoom)},${curto(n.x)},${curto(n.y)}`;
}
