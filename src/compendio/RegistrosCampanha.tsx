import { Modal } from "../ui/Modal";
import { EditorEnquadramento } from "../imagem/EditorEnquadramento";
import { ENQUADRAMENTO_PADRAO, juntar, type Enquadramento } from "../imagem/enquadramento";
import { CAMPOS, type Campo } from "./campos";
import { useUnsavedGuard } from "../unsaved";
import { useContext, useEffect, useRef, useState } from "react";
import { OrigemAbaContext } from "../abrirEmAba";
import { ImagePlus, ScrollText, ExternalLink, Trash2 } from "lucide-react";
import { useCampaigns } from "../CampaignsContext";
import { Aviso } from "../Diario";
import { paraBlocos, deBlocos } from "../registros";
import { RetratoQuadrado } from "../RetratoCombate";
import { carregarDefinicao, secoesDaDefinicao, useDefinicao, useDefinicoes } from "./definicoes";
import { registroSpec } from "./navegacao";
import type { TabSpec } from "../workspace";
import {
  validarImagemConhecimento,
  useConhecimento,
  useCodexApi,
  avisarConhecimento,
  type Conhecimento,
  type CodexApi,
  type CodexCategoria,
  type EdicaoConhecimento,
} from "./conhecimento";

export function ImagemConhecida({ path, framing, tamanho=160 }: { path: string; framing?:Enquadramento; tamanho?:number }) {
  const api = useCodexApi();
  const [image, setImage] = useState<{ path: string; url: string }>();
  useEffect(() => {
    let alive = true,
      url: string | undefined;
    if (api)
      void api.image(path).then(
        (blob) => {
          url = URL.createObjectURL(blob);
          if (alive) setImage({ path, url });
          else URL.revokeObjectURL(url);
        },
        () => {},
      );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [api, path]);
  return (
    <RetratoQuadrado
      src={image?.path === path ? juntar(image.url,framing??ENQUADRAMENTO_PADRAO) : null}
      tamanho={tamanho}
    />
  );
}

/** Conteúdo atual de um registro, para regravar sem perder nada. */
export const edicaoDe = (e: Conhecimento): EdicaoConhecimento => ({
  category: e.category, systemId: e.systemId, definitionId: e.definitionId, instanceId: e.instanceId, title: e.title,
  description: e.description ?? [], secret: e.secret, fields: e.fields ?? {}, sheet: e.sheet, framing: e.framing, imagePath: e.imagePath, registered: e.registered,
});

/** Página da campanha ligada a uma definição. Cria o registro SECRETO se preciso; não concede item nem revela nada. */
export async function garantirRegistro(api: CodexApi, campaignId: string, items: readonly Conhecimento[], category: "monster" | "item", definitionId: string, registered = true): Promise<string> {
  const entry = items.find((x) => x.category === category && x.systemId === "dnd5e-2014" && x.definitionId === definitionId);
  if (entry) {
    if (registered && entry.registered === false) await api.save(campaignId, entry.id, entry.version, { ...edicaoDe(entry), registered: true });
    return entry.id;
  }
  // Falha aqui interrompe: sem as definições da campanha, a página poderia nascer com o conteúdo original.
  const daMesa = (await api.definitions?.(campaignId)) ?? [];
  const definition = await carregarDefinicao(category, definitionId, daMesa);
  if (!definition) throw Error("Definição não encontrada nesta campanha.");
  return api.save(campaignId, null, 0, {
    category, systemId: "dnd5e-2014", definitionId, title: definition.nome.slice(0, 120), description: [], fields: {},
    sheet: secoesDaDefinicao(definition), registered,
  });
}

export function RegistrarDescoberta({ category, id, onOpenContent }: { category: "monster" | "item"; id: string; onOpenContent: (s: TabSpec) => void }) {
  const { active } = useCampaigns(),
    { api, items, error, loading, refresh } = useConhecimento();
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState("");
  if (active?.role !== "mestre") return null;
  const entry = items.find((x) => x.category === category && x.definitionId === id);
  const registered = !!entry && entry.registered !== false;
  const open = () => {
    if (!api || busy) return;
    if (registered) return onOpenContent(registroSpec(entry!.id, entry!.title));
    setBusy(true);
    setFailure("");
    garantirRegistro(api, active.campaign.id, items, category, id).then(
      (eid) => { setBusy(false); refresh(); onOpenContent(registroSpec(eid)); },
      (e) => { setBusy(false); setFailure(e instanceof Error ? e.message : "Não foi possível registrar."); },
    );
  };
  return (
    <div className="cd-registrar">
      <button className="btn-secondary" disabled={!!error || loading || busy} title={error} onClick={open}>
        {registered ? <ExternalLink size={15} aria-hidden="true" /> : <ScrollText size={15} aria-hidden="true" />}{" "}
        {registered ? "Abrir registro da campanha" : category === "item" ? "Registrar como descoberta" : "Registrar na campanha"}
      </button>
      {failure && <Aviso erro t={failure} />}
    </div>
  );
}

export function EditorConhecimento({
  entry,
  category,
  onDone,
}: {
  entry: Conhecimento | null;
  category: CodexCategoria;
  onDone: (id?:string) => void;
}) {
  const { active } = useCampaigns(),
    api = useCodexApi();
  const carregada = useDefinicao(category, entry?.definitionId, entry?.systemId), semDefinicoes = useDefinicoes().indisponivel;
  const definition = semDefinicoes ? undefined : carregada;
  const [title, setTitle] = useState(entry?.title ?? ""),
    [text, setText] = useState(deBlocos(entry?.description ?? [])),
    [secret, setSecret] = useState(entry?.secret ?? "");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const created = useRef<{ id: string; version: number }>();
  const [file, setFile] = useState<File>(),
    [removeImage, setRemoveImage] = useState(false);
  const [fields,setFields]=useState<Record<string,string>>(entry?.fields??{});
  const [framing,setFraming]=useState<Enquadramento>(entry?.framing??ENQUADRAMENTO_PADRAO);
  const [crop,setCrop]=useState(false),[preview,setPreview]=useState<string>();
  useEffect(()=>{let alive=true,url:string|undefined;if(file){url=URL.createObjectURL(file);setPreview(url);}else if(entry?.imagePath&&api)void api.image(entry.imagePath).then(blob=>{url=URL.createObjectURL(blob);if(alive)setPreview(url);else URL.revokeObjectURL(url);},()=>{});return()=>{alive=false;if(url)URL.revokeObjectURL(url);};},[file,entry?.imagePath,api]);
  const origin = useContext(OrigemAbaContext);
  const releaseGuard=useUnsavedGuard(
    origin ?? "secao:compendio",
    title !== (entry?.title ?? "") ||
      text !== deBlocos(entry?.description ?? []) ||
      secret !== (entry?.secret ?? "") ||
      !!file ||
      removeImage || JSON.stringify(fields)!==JSON.stringify(entry?.fields??{}) || JSON.stringify(framing)!==JSON.stringify(entry?.framing??ENQUADRAMENTO_PADRAO),
  );
  const save = async () => {
    if (!api || !active || busy) return;
    setBusy(true);
    setError("");
    try {
      if (file) validarImagemConhecimento(file);
      let id = entry?.id ?? created.current?.id ?? null;
      let version = entry?.version ?? created.current?.version ?? 0;
      const data: EdicaoConhecimento = {
        category,
        systemId: entry?.systemId ?? "dnd5e-2014",
        definitionId: entry?.definitionId,
        instanceId: entry?.instanceId,
        title,
        description: paraBlocos(text),
        secret,
        fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim())),
        framing,
        sheet: definition ? secoesDaDefinicao(definition) : entry?.sheet,
        registered: entry?.registered,
        imagePath: removeImage ? undefined : entry?.imagePath,
      };
      // O Storage só aceita arquivo de registro existente. Registro novo nasce secreto.
      if (file) {
        if (!id) {
          id = await api.save(active.campaign.id, null, 0, data);
          version = 1;
          created.current = { id, version };
        }
        const path = await api.upload(active.campaign.id, id, file);
        await api.save(active.campaign.id, id, version, { ...data, imagePath: path });
      } else id=await api.save(active.campaign.id, id, version, data);
      releaseGuard();
      avisarConhecimento();
      onDone(id??undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };
  const campo = (f: Campo) => {
    const value = fields[f.id] ?? "", set = (v: string) => setFields((x) => ({ ...x, [f.id]: v }));
    return (
      <label key={f.id}>
        {f.label}
        {f.opcoes ? (
          <select value={value} onChange={(e) => set(e.target.value)}>
            <option value="">Não definido</option>
            {[...new Set([...f.opcoes, ...(value ? [value] : [])])].map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : f.long ? (
          <textarea value={value} maxLength={4000} onChange={(e) => set(e.target.value)} />
        ) : (
          <input value={value} maxLength={4000} onChange={(e) => set(e.target.value)} />
        )}
      </label>
    );
  };
  const campos = CAMPOS[category] ?? [];
  return (
    <Modal titulo={entry?"Editar registro":"Novo registro"} onFechar={()=>onDone()} ocupado={busy} largura={640}><section className="codex-editor cd-form" aria-label="Editar conhecimento">
      <p className="muted">{entry ? "A visibilidade é controlada na página do registro." : "Somente o nome é obrigatório. O registro nasce secreto; revele na página dele."}</p>
      <label>
        Nome
        <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </label>
      {campos.filter((f) => !f.long).map(campo)}
      <label>
        Descrição compartilhada
        <textarea value={text} maxLength={10000} onChange={(e) => setText(e.target.value)} />
      </label>
      {campos.some((f) => f.long) && <details open={campos.some((f) => f.long && !!entry?.fields?.[f.id])}><summary>História e detalhes opcionais</summary>{campos.filter((f) => f.long).map(campo)}</details>}
      <label>
        Notas privadas do mestre
        <textarea value={secret} maxLength={4000} onChange={(e) => setSecret(e.target.value)} />
      </label>
      <div className="cd-arquivo">
        <label className="file-btn btn-secondary">
        <ImagePlus size={15} aria-hidden="true" /> Escolher imagem
        <input
          type="file"
          className="arquivo-invisivel"
          aria-label="Escolher imagem privada (JPEG, PNG, WebP; até 5 MiB)"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            setFile(e.target.files?.[0]);
            setRemoveImage(false);setFraming(ENQUADRAMENTO_PADRAO);
          }}
        />
        </label>
        <small className="muted">{file ? file.name : "Privada. JPEG, PNG ou WebP; até 5 MiB."}</small>
      </div>
      {preview&&!removeImage&&<div className="cd-editor-portrait"><RetratoQuadrado src={juntar(preview,framing)} tamanho={100}/><button className="btn-secondary" onClick={()=>setCrop(true)}>Ajustar enquadramento</button></div>}
      {crop&&preview&&<EditorEnquadramento titulo="Enquadrar imagem" src={preview} inicial={framing} proporcao={1} onCancelar={()=>setCrop(false)} onConfirmar={value=>{setFraming(value);setCrop(false);}}/>}
      {entry?.imagePath && (
        <label className="cd-check">
          <input
            type="checkbox"
            checked={removeImage}
            onChange={(e) => {
              setRemoveImage(e.target.checked);
              setFile(undefined);
            }}
          />{" "}
          Remover imagem do registro
        </label>
      )}
      {error && <Aviso erro t={error} />}
      <div className="row">
        <button className="btn-primary" disabled={busy || !title.trim()} onClick={() => void save()}>
          {busy ? "Salvando…" : "Salvar"}
        </button>
        <button className="btn-secondary" disabled={busy} onClick={()=>onDone()}>
          Cancelar
        </button>
        {entry && (
          <button
            className="btn-danger"
            disabled={busy}
            onClick={() => {
              if (api && active && window.confirm("Remover este registro do Compêndio?")) {
                setBusy(true);
                void api.remove(active.campaign.id, entry.id, entry.version).then(
                  () => onDone(),
                  () => { setBusy(false); setError("Não foi possível remover. Recarregue para conferir a versão."); },
                );
              }
            }}
          >
            <Trash2 size={15} /> Remover
          </button>
        )}
      </div>
    </section></Modal>
  );
}
