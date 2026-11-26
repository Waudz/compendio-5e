// Retrato ÚNICO do personagem: envio de arquivo do aparelho (com enquadramento quadrado antes de enviar), prévia, troca e remoção.
// O arquivo vai para o bucket privado `campaign-assets` (participantes da campanha leem; tipo e tamanho validados aqui e no bucket).
// O mesmo valor serve à ficha, à apresentação pública, ao Início, a Personagens e à Iniciativa.
import { Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { CAPA_TIPOS, ENQUADRAMENTO_PADRAO, estiloEnquadramento, validarCapa, type Enquadramento } from "../capa";
import { retratoValido } from "../fichas";
import { useCapa } from "../RegistrosContext";
import { RetratoQuadrado } from "../RetratoCombate";

export const LADO_RETRATO = 512;

/** Recorta o quadrado enquadrado e reduz para 512 px. Sem suporte a canvas, devolve o arquivo original. */
export async function recortarRetrato(arquivo: File, url: string, e: Enquadramento): Promise<File> {
  try {
    const img = new Image(); img.src = url; await img.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = LADO_RETRATO;
    const ctx = canvas.getContext("2d"); if (!ctx || !img.naturalWidth) return arquivo;
    const escala = (LADO_RETRATO / Math.min(img.naturalWidth, img.naturalHeight)) * e.zoom;
    const w = img.naturalWidth * escala, h = img.naturalHeight * escala;
    ctx.drawImage(img, (LADO_RETRATO - w) * (e.x / 100), (LADO_RETRATO - h) * (e.y / 100), w, h);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/webp", 0.9));
    return blob && blob.type === "image/webp" ? new File([blob], "retrato.webp", { type: "image/webp" }) : arquivo;
  } catch { return arquivo; }
}

export function CampoRetrato({ valor, campaignId, onChange }: { valor: string; campaignId: string; onChange: (v: string) => void }) {
  const capa = useCapa();
  const [arquivo, setArquivo] = useState<File | null>(null), [url, setUrl] = useState<string | null>(null), [enq, setEnq] = useState<Enquadramento>(ENQUADRAMENTO_PADRAO);
  const [enviando, setEnviando] = useState(false), [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (!arquivo || typeof URL.createObjectURL !== "function") { setUrl(null); return; }
    const u = URL.createObjectURL(arquivo); setUrl(u); return () => URL.revokeObjectURL(u);
  }, [arquivo]);
  const escolher = (f: File | undefined) => {
    if (!f) return;
    const problema = validarCapa(f); if (problema) { setErro(problema); return; }
    setErro(null); setEnq(ENQUADRAMENTO_PADRAO); setArquivo(f);
  };
  const enviar = async () => {
    if (!arquivo || !capa) return;
    setEnviando(true); setErro(null);
    const pronto = url ? await recortarRetrato(arquivo, url, enq) : arquivo;
    const r = await capa.enviar(campaignId, pronto);
    setEnviando(false);
    if (!r.ok) { setErro(r.error); return; }
    onChange(`storage:${r.data}`); setArquivo(null);
  };
  const controle = (rotulo: string, chave: keyof Enquadramento, min: number, max: number, passo: number) =>
    <label>{rotulo}<input type="range" aria-label={rotulo} min={min} max={max} step={passo} value={enq[chave]} onChange={ev => setEnq(a => ({ ...a, [chave]: Number(ev.target.value) }))}/></label>;
  const endereco = valor.startsWith("storage:") ? "" : valor;
  return <div className="campo-retrato" role="group" aria-label="Retrato do personagem">
    <div className="campo-retrato-atual">
      {arquivo && url ? <span className="campo-retrato-previa"><img src={url} alt="Prévia do enquadramento" style={estiloEnquadramento(enq)}/></span>
        : <RetratoQuadrado tipo="personagem" tamanho={112} src={retratoValido(valor) ? valor : null}/>}
    </div>
    <div className="campo-retrato-acoes">
      {!arquivo && <div className="row">
        <label className="btn-secondary file-btn"><Upload size={14} aria-hidden="true"/> {valor ? "Trocar retrato" : "Enviar retrato"}
          <input type="file" hidden aria-label="Arquivo do retrato" accept={CAPA_TIPOS.join(",")} disabled={!capa} onChange={e => { escolher(e.target.files?.[0]); e.target.value = ""; }}/></label>
        {valor && <button type="button" className="btn-secondary" onClick={() => { setErro(null); onChange(""); }}><Trash2 size={14} aria-hidden="true"/> Remover retrato</button>}
      </div>}
      {arquivo && <>
        {controle("Zoom do retrato", "zoom", 1, 3, 0.05)}{controle("Posição horizontal do retrato", "x", 0, 100, 1)}{controle("Posição vertical do retrato", "y", 0, 100, 1)}
        <div className="row"><button type="button" className="btn-primary" disabled={enviando} onClick={() => void enviar()}>{enviando ? "Enviando…" : "Usar esta imagem"}</button>
          <button type="button" className="btn-secondary" disabled={enviando} onClick={() => setArquivo(null)}>Cancelar envio</button></div>
      </>}
      <p className="muted">{capa ? "JPEG, PNG ou WebP de até 5 MB. Há um único retrato por personagem, visto pela campanha." : "O envio de arquivos exige conta na campanha. Use um endereço de imagem abaixo."}</p>
      <details><summary>Usar um endereço de imagem</summary>
        <label>Endereço https da imagem<input aria-label="Endereço do retrato" type="url" inputMode="url" placeholder="https://" value={endereco} maxLength={2000} onChange={e => onChange(e.target.value.trim())}/></label></details>
      {valor && !retratoValido(valor) && <p role="alert" className="notice err">O endereço deve começar com https:// e não ter espaços.</p>}
      {erro && <p role="alert" className="notice err">{erro}</p>}
    </div>
  </div>;
}
