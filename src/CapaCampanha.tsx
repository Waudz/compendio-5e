// Capa da campanha: faixa de destaque (com o nome sobre um gradiente) e o editor de imagem e enquadramento, usado no diálogo "Editar".
// Com a migração 0012 o enquadramento é NÃO destrutivo (só ponto de foco e zoom). Sem ela, mantém o comportamento anterior: o recorte substitui a imagem.
import { Image as ImageIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ENQUADRAMENTO_PADRAO, estiloEnquadramento, validarCapa, type Enquadramento } from "./capa";
import { useCapa } from "./RegistrosContext";

const mesmo = (a: Enquadramento, b: Enquadramento) => a.zoom === b.zoom && a.x === b.x && a.y === b.y;

/** Estado único da capa: o que está salvo e o rascunho em edição (a faixa mostra o rascunho ao vivo). */
export function useCapaCampanha(campaignId: string) {
  const api = useCapa();
  const [url, setUrl] = useState<string | null>(null), [pronto, setPronto] = useState(false), [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [salvo, setSalvo] = useState<Enquadramento>(ENQUADRAMENTO_PADRAO), [suportado, setSuportado] = useState(false);
  const [rascunho, setRascunho] = useState<Enquadramento | null>(null), [arquivo, setArquivo] = useState<File | null>(null), [urlArquivo, setUrlArquivo] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null); setSalvo(ENQUADRAMENTO_PADRAO); setRascunho(null); setArquivo(null); setMsg(null);   // nada de uma campanha aparece em outra
    if (!api) { setPronto(true); return; }
    let vivo = true; setPronto(false);
    Promise.all([api.obter(campaignId), api.enquadramento?.(campaignId) ?? null]).then(([r, e]) => {
      if (!vivo) return;
      if (r.ok) setUrl(r.data); else setMsg(r.error);
      if (e?.ok) { setSuportado(e.data.suportado); setSalvo(e.data.valor); } else setSuportado(false);
      setPronto(true);
    }, () => { if (vivo) { setMsg("Não foi possível carregar a capa."); setPronto(true); } });
    return () => { vivo = false; };
  }, [api, campaignId]);
  useEffect(() => { if (!arquivo) { setUrlArquivo(null); return; } const u = URL.createObjectURL(arquivo); setUrlArquivo(u); return () => URL.revokeObjectURL(u); }, [arquivo]);

  const enquadramento = rascunho ?? salvo;
  const descartar = () => { setArquivo(null); setRascunho(null); setMsg(null); };
  const escolher = (f: File | undefined) => {
    if (!f || !api) return; const bad = validarCapa(f); if (bad) { setMsg(bad); return; }
    setArquivo(f); setRascunho(ENQUADRAMENTO_PADRAO); setMsg(null);
  };

  /** Banco sem a 0012: gera a imagem recortada (comportamento anterior, que substitui a original). */
  const recortar = async (origem: string, e: Enquadramento): Promise<File> => {
    const img = new Image(); img.crossOrigin = "anonymous"; img.src = origem; await img.decode();
    const canvas = document.createElement("canvas"); canvas.width = 1920; canvas.height = 540;
    const escala = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight) * e.zoom;
    const w = img.naturalWidth * escala, h = img.naturalHeight * escala, ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sem canvas");
    ctx.drawImage(img, (canvas.width - w) * e.x / 100, (canvas.height - h) * e.y / 100, w, h);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", .92));
    if (!blob) throw new Error("sem imagem");
    return new File([blob], "capa.jpg", { type: "image/jpeg" });
  };

  const salvar = async () => {
    const origem = urlArquivo ?? url; if (!api || !origem) return;
    setBusy(true); setMsg(null);
    const e = enquadramento;
    try {
      if (suportado && api.salvarEnquadramento) {
        if (arquivo) { const r = await api.definir(campaignId, arquivo); if (!r.ok) { setMsg(r.error); return; } setUrl(r.data); setSalvo(ENQUADRAMENTO_PADRAO); setArquivo(null); }   // a original é enviada intacta
        const g = await api.salvarEnquadramento(campaignId, e);
        if (!g.ok) { setMsg(g.error); setRascunho(e); return; }
        setSalvo(e); setRascunho(null); return;
      }
      const enviar = arquivo && mesmo(e, ENQUADRAMENTO_PADRAO) ? arquivo : await recortar(origem, e);
      const r = await api.definir(campaignId, enviar);
      if (r.ok) { setUrl(r.data); descartar(); } else setMsg(r.error);
    } catch { setMsg("Não foi possível ajustar a capa. A imagem anterior foi mantida."); } finally { setBusy(false); }
  };
  const remover = async () => {
    if (!api) return; descartar(); setBusy(true);
    const r = await api.remover(campaignId); setBusy(false);
    if (r.ok) { setUrl(null); setSalvo(ENQUADRAMENTO_PADRAO); } else setMsg(r.error);
  };
  return { disponivel: !!api, suportado, url, urlMostrada: urlArquivo ?? url, enquadramento, pronto, msg, busy,
    alterado: !!arquivo || (!!rascunho && !mesmo(rascunho, salvo)),
    ajustar: (p: Partial<Enquadramento>) => setRascunho({ ...enquadramento, ...p }), escolher, salvar, remover, descartar };
}
export type EstadoCapa = ReturnType<typeof useCapaCampanha>;

export function FaixaCapa({ capa, nome, acao }: { capa: EstadoCapa; nome: string; acao?: ReactNode }) {
  return <section className="home-cover-wrap" aria-label="Capa da campanha" data-testid="inicio-capa">
    <div className="home-cover" data-com-imagem={capa.urlMostrada ? "true" : undefined}>
      {capa.urlMostrada ? <img src={capa.urlMostrada} alt="Capa da campanha" style={estiloEnquadramento(capa.enquadramento)}/>
        : <div className="home-cover-empty"><ImageIcon size={26} aria-hidden="true"/><span>{capa.pronto ? "Sem capa" : "Carregando…"}</span></div>}
      <h1 className="home-name">{nome}</h1>{acao}
    </div>
  </section>;
}

export function EditorCapa({ capa }: { capa: EstadoCapa }) {
  if (!capa.disponivel) return <p className="muted">A capa não está disponível neste modo.</p>;
  const e = capa.enquadramento;
  const controle = (rotulo: string, chave: keyof Enquadramento, min: number, max: number, passo: number, texto: string) =>
    <label>{rotulo} <small className="muted">{texto}</small><input type="range" aria-label={rotulo} min={min} max={max} step={passo} value={e[chave]} onChange={ev => capa.ajustar({ [chave]: Number(ev.target.value) })}/></label>;
  return <div className="capa-editor">
    <div className="capa-previa">{capa.urlMostrada ? <img src={capa.urlMostrada} alt="Prévia do enquadramento" style={estiloEnquadramento(e)}/> : <span className="muted">Nenhuma imagem escolhida.</span>}</div>
    <div className="row">
      <label className="btn-secondary file-btn">{capa.url ? "Substituir capa" : "Adicionar capa"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={capa.busy} onChange={ev => { capa.escolher(ev.target.files?.[0]); ev.target.value = ""; }}/></label>
      {capa.url && <button type="button" className="btn-secondary" disabled={capa.busy} onClick={() => { if (window.confirm("Remover a capa da campanha?")) void capa.remover(); }}>Remover capa</button>}
    </div>
    {capa.urlMostrada && <>
      <div className="home-crop">
        {controle("Zoom", "zoom", 1, 3, .05, `${Math.round(e.zoom * 100)}%`)}
        {controle("Posição horizontal", "x", 0, 100, 1, `${Math.round(e.x)}%`)}
        {controle("Posição vertical", "y", 0, 100, 1, `${Math.round(e.y)}%`)}
      </div>
      <p className="muted capa-nota">{capa.suportado ? "A imagem original é preservada; o ponto em foco é mantido em qualquer tamanho de tela." : "O enquadramento salvo substitui a imagem da capa."}</p>
      <div className="row">
        <button type="button" className="btn-secondary" disabled={capa.busy} onClick={() => void capa.salvar()}>Salvar enquadramento</button>
        <button type="button" className="btn-secondary" disabled={capa.busy || !capa.alterado} onClick={capa.descartar}>Descartar ajuste</button>
      </div></>}
    {capa.busy && <span className="muted" role="status">Enviando…</span>}
    {capa.msg && <div className="notice err" role="alert">{capa.msg}</div>}
  </div>;
}
