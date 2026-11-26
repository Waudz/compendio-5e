// Retrato ÚNICO do personagem: envio de arquivo do aparelho ou endereço, com o editor compartilhado de enquadramento. O arquivo ORIGINAL
// é enviado inteiro para o bucket privado `campaign-assets`; o enquadramento vai junto da referência e pode ser refeito quando quiser.
// O mesmo valor serve à ficha, à apresentação pública, ao Início, a Personagens, à Iniciativa e aos Encontros.
import { Crop, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { CAPA_TIPOS, validarCapa } from "../capa";
import { retratoValido } from "../fichas";
import { EditorEnquadramento } from "../imagem/EditorEnquadramento";
import { juntar, separar, type Enquadramento } from "../imagem/enquadramento";
import { useCapa } from "../RegistrosContext";
import { RetratoQuadrado, useEnderecoDaImagem } from "../RetratoCombate";

const PREVIAS = [96, 56, 36];
const NOTA = "A imagem original é preservada: você pode refazer o enquadramento depois.";

export function CampoRetrato({ valor, campaignId, onChange }: { valor: string; campaignId: string; onChange: (v: string) => void }) {
  const capa = useCapa();
  const [arquivo, setArquivo] = useState<File | null>(null), [urlArquivo, setUrlArquivo] = useState<string | null>(null), [ajustando, setAjustando] = useState(false);
  const [enviando, setEnviando] = useState(false), [erro, setErro] = useState<string | null>(null);
  const enderecoAtual = useEnderecoDaImagem(retratoValido(valor) ? separar(valor).base : null);
  useEffect(() => {
    if (!arquivo || typeof URL.createObjectURL !== "function") { setUrlArquivo(null); return; }
    const u = URL.createObjectURL(arquivo); setUrlArquivo(u); return () => URL.revokeObjectURL(u);
  }, [arquivo]);
  const escolher = (f: File | undefined) => {
    if (!f) return;
    const problema = validarCapa(f); if (problema) { setErro(problema); return; }
    setErro(null); setArquivo(f);
  };
  const enviar = async (e: Enquadramento) => {
    if (!arquivo || !capa) return;
    setEnviando(true); setErro(null);
    const r = await capa.enviar(campaignId, arquivo);
    setEnviando(false);
    if (!r.ok) { setErro(r.error); return; }
    onChange(juntar(`storage:${r.data}`, e)); setArquivo(null);
  };
  const endereco = valor.startsWith("storage:") ? "" : separar(valor).base;
  return <div className="campo-retrato" role="group" aria-label="Retrato do personagem">
    <div className="campo-retrato-atual"><RetratoQuadrado tipo="personagem" tamanho={112} src={retratoValido(valor) ? valor : null}/></div>
    <div className="campo-retrato-acoes">
      <div className="row">
        <label className="btn-secondary file-btn"><Upload size={14} aria-hidden="true"/> {valor ? "Trocar retrato" : "Enviar retrato"}
          <input type="file" className="arquivo-invisivel" aria-label="Arquivo do retrato" accept={CAPA_TIPOS.join(",")} disabled={!capa} onChange={e => { escolher(e.target.files?.[0]); e.target.value = ""; }}/></label>
        {retratoValido(valor) && <button type="button" className="btn-secondary" disabled={!enderecoAtual} onClick={() => { setErro(null); setAjustando(true); }}><Crop size={14} aria-hidden="true"/> Ajustar enquadramento</button>}
        {valor && <button type="button" className="btn-secondary" onClick={() => { setErro(null); onChange(""); }}><Trash2 size={14} aria-hidden="true"/> Remover retrato</button>}
      </div>
      <p className="muted">{capa ? "JPEG, PNG ou WebP de até 5 MB. Há um único retrato por personagem, visto pela campanha." : "O envio de arquivos exige conta na campanha. Use um endereço de imagem abaixo."}</p>
      <details><summary>Usar um endereço de imagem</summary>
        <label>Endereço https da imagem<input aria-label="Endereço do retrato" type="url" inputMode="url" placeholder="https://" value={endereco} maxLength={2000} onChange={e => onChange(e.target.value.trim())}/></label></details>
      {valor && !retratoValido(valor) && <p role="alert" className="notice err">O endereço deve começar com https:// e não ter espaços.</p>}
      {erro && !arquivo && <p role="alert" className="notice err">{erro}</p>}
    </div>
    {arquivo && urlArquivo && <EditorEnquadramento titulo="Enquadrar retrato" src={urlArquivo} proporcao={1} previas={PREVIAS} ocupado={enviando} erro={erro} nota={NOTA} confirmar="Usar esta imagem"
      onConfirmar={e => void enviar(e)} onCancelar={() => { setArquivo(null); setErro(null); }}/>}
    {ajustando && enderecoAtual && <EditorEnquadramento titulo="Ajustar enquadramento do retrato" src={enderecoAtual} inicial={separar(valor).enquadramento} proporcao={1} previas={PREVIAS} nota={NOTA}
      onConfirmar={e => { onChange(juntar(valor, e)); setAjustando(false); }} onCancelar={() => setAjustando(false)}/>}
  </div>;
}
