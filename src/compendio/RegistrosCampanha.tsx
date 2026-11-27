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
import { CampoNarrativo } from "./referencias";
import { useLinhasCampanha } from "./consulta";
import { useVinculos, ListaVinculos, NovoVinculoBotao } from "./Vinculos";
import { RELACOES, VAGAS, type Vaga } from "./relacoes";
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
  type EdicaoVinculos,
  type CodexLink,
} from "./conhecimento";

export function ImagemConhecida({ path, framing, tamanho=160, ampliar }: { path: string; framing?:Enquadramento; tamanho?:number; ampliar?: string }) {
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
      ampliar={ampliar}
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
  const dados = useLinhasCampanha(), vinculos = useVinculos(entry?.id ?? "", dados);
  // Naturalidade, residência, liderança e sede: texto livre ou um registro existente (o vínculo substitui o texto).
  const [ligacoes, setLigacoes] = useState<Record<string, string>>({});
  const vagas = (VAGAS[category] ?? []).filter((v) => CAMPOS[category]?.some((f) => f.id === v.campo && !f.long));
  const [removidos,setRemovidos]=useState<string[]>([]);
  const [adicionados,setAdicionados]=useState<(EdicaoVinculos['adicionar'][number]&{linha:CodexLink})[]>([]);
  const linksDoRascunho=[...vinculos.links.filter(l=>!removidos.includes(l.id)),...adicionados.map(a=>a.linha)];
  const vinculadosEm = (v: Vaga) => (entry ? linksDoRascunho.filter((l) => l.kind === v.kind && l.outgoing === v.outgoing) : []);
  const candidatos = (v: Vaga) => dados.rows.filter((r) => r.id !== entry?.id && (v.campo === "leadership" ? r.category === "npc" || r.category === "character" : r.category === "location"));
  const removerVinculo = (link: string, titulo: string) => {
    if (!window.confirm(`Remover o vínculo com ${titulo} ao salvar? Os registros serão preservados.`)) return;
    if(adicionados.some(a=>a.linha.id===link))setAdicionados(xs=>xs.filter(a=>a.linha.id!==link));
    else setRemovidos(xs=>[...xs,link]);
  };
  const releaseGuard=useUnsavedGuard(
    origin ?? "secao:compendio",
    title !== (entry?.title ?? "") ||
      text !== deBlocos(entry?.description ?? []) ||
      secret !== (entry?.secret ?? "") ||
      !!file ||
      removeImage || removidos.length>0 || adicionados.length>0 || Object.values(ligacoes).some(Boolean) || JSON.stringify(fields)!==JSON.stringify(entry?.fields??{}) || JSON.stringify(framing)!==JSON.stringify(entry?.framing??ENQUADRAMENTO_PADRAO),
  );
  const save = async () => {
    if (!api || !active || busy) return;
    setBusy(true);
    setError("");
    try {
      const alteraVinculos=removidos.length>0||adicionados.length>0||Object.values(ligacoes).some(Boolean);
      if(alteraVinculos&&(!api.salvarEdicao||!await api.edicaoAtomica?.()))throw Error('Salvar vínculos junto da edição requer a atualização 0023, ainda não aplicada. Nada foi gravado; seu rascunho continua aberto.');
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
        fields: Object.fromEntries(Object.entries(fields).filter(([k, v]) => v.trim() && !ligacoes[k])),
        framing,
        sheet: definition ? secoesDaDefinicao(definition) : entry?.sheet,
        registered: entry?.registered,
        imagePath: removeImage ? undefined : entry?.imagePath,
      };
      // Uploads são novos objetos imutáveis; nunca sobrescrevem a imagem anterior.
      let imagePath=data.imagePath;
      if(file){
        if(!id){id=await api.save(active.campaign.id,null,0,data);version=1;created.current={id,version};}
        imagePath=await api.upload(active.campaign.id,id,file);
      }
      const novos:EdicaoVinculos['adicionar'] = adicionados.map(({source,target,relation})=>({source,target,relation}));
      for(const v of vagas){
        const alvo=ligacoes[v.campo],r=RELACOES.find(x=>x.kind===v.kind)!;
        if(alvo&&!linksDoRascunho.some(l=>l.targetId===alvo&&l.kind===v.kind))novos.push({source:v.outgoing?null:alvo,target:v.outgoing?alvo:null,relation:{kind:r.kind,label:r.a,inverse:r.b}});
      }
      id=alteraVinculos?await api.salvarEdicao!(active.campaign.id,id,version,{...data,imagePath},{remover:removidos,adicionar:novos}):await api.save(active.campaign.id,id,version,{...data,imagePath});
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
    if (f.long) return <CampoNarrativo key={f.id} label={f.label} value={value} maxLength={4000} onChange={set} rows={dados.rows.filter((r) => r.id !== entry?.id)} />;
    const vaga = vagas.find((v) => v.campo === f.id);
    if (vaga) {
      const atuais = vinculadosEm(vaga);
      return (
        <div key={f.id} className="vinculo-campo">
          <label>{f.label}<input value={value} maxLength={4000} disabled={!!ligacoes[f.id]} onChange={(e) => set(e.target.value)} placeholder={atuais.length ? "Já vinculado a um registro" : "Texto livre"} /></label>
          <select aria-label={`Vincular ${f.label} a um registro`} value={ligacoes[f.id] ?? ""} onChange={(e) => setLigacoes((x) => ({ ...x, [f.id]: e.target.value }))}>
            <option value="">Ou vincular um registro existente…</option>
            {candidatos(vaga).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          {atuais.map((l) => <small key={l.id} className="muted">Vinculado: {l.title}{" "}
            <button type="button" className="btn-link" disabled={busy} aria-label={`Remover vínculo com ${l.title}`} onClick={() => removerVinculo(l.id, l.title)}>remover</button></small>)}
        </div>
      );
    }
    return (
      <label key={f.id}>
        {f.label}
        {f.opcoes ? (
          <select value={value} onChange={(e) => set(e.target.value)}>
            <option value="">Não definido</option>
            {[...new Set([...f.opcoes, ...(value ? [value] : [])])].map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : (
          <input value={value} maxLength={4000} onChange={(e) => set(e.target.value)} />
        )}
      </label>
    );
  };
  const campos = CAMPOS[category] ?? [];
  const acoes = <>
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
  </>;
  return (
    <Modal titulo={entry?"Editar registro":"Novo registro"} onFechar={()=>onDone()} ocupado={busy} largura={640} acoes={acoes}><section className="codex-editor cd-form" aria-label="Editar conhecimento">
      <p className="muted">{entry ? "A visibilidade é controlada na página do registro." : "Somente o nome é obrigatório. O registro nasce secreto; revele na página dele."}</p>
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
      <label>
        Nome
        <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </label>
      {campos.filter((f) => !f.long).map(campo)}
      <CampoNarrativo label="Descrição compartilhada" value={text} maxLength={10000} onChange={setText} rows={dados.rows.filter((r) => r.id !== entry?.id)} />
      <p className="muted">Digite @ para citar um registro; o texto entre colchetes é o que aparece. Linha iniciada por ## vira subtítulo.</p>
      {campos.some((f) => f.long) && <details open={campos.some((f) => f.long && !!entry?.fields?.[f.id])}><summary>História e detalhes opcionais</summary>{campos.filter((f) => f.long).map(campo)}</details>}
      {entry && (
        <section className="cd-relations" aria-label="Vínculos">
          <h3>Vínculos</h3>
          <p className="muted">Vínculos só serão gravados ao salvar esta edição. Cancelar preserva os vínculos existentes.</p>
          {vinculos.error && <Aviso erro t={vinculos.error} />}
          {/* os que ocupam um campo próprio são removidos no próprio campo, acima */}
          <ListaVinculos
            links={linksDoRascunho.filter((l) => !vagas.some((v) => v.kind === l.kind && v.outgoing === l.outgoing))}
            rows={dados.rows}
            onOpenContent={() => {}}
            semAbrir
            controles={{ busy, onRemover: (l) => removerVinculo(l.id, l.title) }}
          />
          <NovoVinculoBotao id={entry.id} vinculos={{...vinculos,links:linksDoRascunho}} onAdicionar={(source,target,relation,chosen)=>setAdicionados(xs=>[...xs,{source,target,relation,linha:{id:'draft:'+crypto.randomUUID(),targetId:chosen.id,title:chosen.title,category:chosen.category as CodexLink['category'],kind:relation.kind,relation:source===entry.id?relation.label:relation.inverse,outgoing:source===entry.id,revealed:relation.revealed}}])} />
        </section>
      )}
      <label>
        Notas privadas do mestre
        <textarea value={secret} maxLength={4000} onChange={(e) => setSecret(e.target.value)} />
      </label>
      {error && <Aviso erro t={error} />}
    </section></Modal>
  );
}
