import { useAuth } from "../AuthContext";
import { useUnsavedGuard } from "../unsaved";
import { useContext } from "react";
import { OrigemAbaContext } from "../abrirEmAba";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Plus, Pencil, Trash2 } from "lucide-react";
import { useVersaoRegistros } from "../registrosStore";
import { useCampaigns } from "../CampaignsContext";
import { Aviso } from "../Diario";
import { paraBlocos, deBlocos } from "../registros";
import { RetratoQuadrado } from "../RetratoCombate";
import { DetalheMonstro } from "./DetalheMonstro";
import { DetalheItem } from "./DetalheItem";
import { imagemDoItem, imagemDoMonstro } from "../ficha/imagensCatalogo";
import { srdItem } from "../catalogue/srd-2014-items";
import type { Monstro } from "../catalogue/sistemas/dnd5e-2014/esquemas";
import type { TabSpec } from "../workspace";
import {
  validarImagemConhecimento,
  useConhecimento,
  useCodexApi,
  avisarConhecimento,
  type Conhecimento,
  type CodexCategoria,
  type EdicaoConhecimento,
  type CodexAviso,
} from "./conhecimento";
const consultas = new WeakMap<
  object,
  Map<string, { query: string; selected?: string }>
>();
const nomes: Record<CodexCategoria, string> = {
  npc: "NPCs",
  location: "Locais",
  organization: "Organizações",
  discovery: "Descobertas",
  monster: "Bestiário",
  item: "Itens descobertos",
};
export function ImagemConhecida({ path }: { path: string }) {
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
      src={image?.path === path ? image.url : null}
      tamanho={160}
    />
  );
}
export function DetalheConhecido({
  entry,
  onOpenContent,
}: {
  entry: Conhecimento;
  onOpenContent: (s: TabSpec) => void;
}) {
  const [monster, setMonster] = useState<{
    id: string;
    value: Monstro | undefined;
  }>();
  useEffect(() => {
    let alive = true;
    if (
      entry.category === "monster" &&
      entry.knowledge === 4 &&
      entry.systemId === "dnd5e-2014" &&
      entry.definitionId
    )
      void import("../catalogue/contratos")
        .then((c) => c.todosOsMonstros())
        .then((ms) => {
          if (alive)
            setMonster({
              id: entry.id,
              value: ms.find((m) => m.id === entry.definitionId),
            });
        });
    return () => {
      alive = false;
    };
  }, [entry.id, entry.knowledge, entry.definitionId]);
  const api = useCodexApi(),
    { active } = useCampaigns(),
    registrosVersion = useVersaoRegistros();
  const [holders, setHolders] = useState<{
    scope: string;
    data: { id: string; title: string }[];
  }>();
  const holderScope = `${active?.campaign.id}:${entry.id}`;
  useEffect(() => {
    let alive = true;
    if (api && active && entry.category === "item")
      void api.holders(active.campaign.id, entry.id).then(
        (data) => {
          if (alive) setHolders({ scope: holderScope, data });
        },
        () => {},
      );
    return () => {
      alive = false;
    };
  }, [api, holderScope, entry.category, registrosVersion]);
  const publicImage =
    entry.imageDefinitionId && entry.systemId === "dnd5e-2014"
      ? entry.category === "monster"
        ? imagemDoMonstro(entry.imageDefinitionId)
        : entry.category === "item"
          ? imagemDoItem(entry.imageDefinitionId)
          : null
      : null;
  const item =
    entry.category === "item" &&
    entry.systemId === "dnd5e-2014" &&
    entry.definitionId
      ? srdItem(entry.definitionId)
      : undefined;
  return (
    <>
      <h3>{entry.title}</h3>
      {entry.imagePath ? (
        <ImagemConhecida path={entry.imagePath} />
      ) : publicImage ? (
        <RetratoQuadrado
          src={publicImage}
          tipo={entry.category === "monster" ? "monstro" : "avulso"}
          tamanho={160}
        />
      ) : null}
      {entry.description && (
        <p style={{ whiteSpace: "pre-wrap" }}>{deBlocos(entry.description)}</p>
      )}
      {entry.category === "monster" &&
        entry.knowledge === 4 &&
        entry.systemId === "dnd5e-2014" &&
        monster?.id === entry.id &&
        monster.value && <DetalheMonstro monstro={monster.value} />}
      {item && <DetalheItem item={item} onOpenContent={onOpenContent} />}
      {holders?.scope === holderScope && holders.data.length > 0 && (
        <p>Com: {holders.data.map((x) => x.title).join(", ")}</p>
      )}
      {entry.stats && (
        <dl>
          {Object.entries(entry.stats).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
export function RegistrosCampanha({
  category,
  onOpenContent,
}: {
  category: CodexCategoria;
  onOpenContent: (s: TabSpec) => void;
}) {
  const { active } = useCampaigns(),
    { api, items, loading, error, refresh } = useConhecimento();
  const { client, user } = useAuth();
  const cache = useMemo(() => {
    if (!client) return new Map<string, { query: string; selected?: string }>();
    let c = consultas.get(client);
    if (!c) {
      c = new Map();
      consultas.set(client, c);
    }
    return c;
  }, [client]);
  const cacheKey = `${user?.id}:${active?.campaign.id}:${category}`;
  const pref = cache.get(cacheKey);
  const [edit, setEdit] = useState<Conhecimento | null | undefined>();
  const [selected, setSelected] = useState<string | undefined>(pref?.selected);
  const [query, setQuery] = useState(pref?.query ?? "");
  useEffect(() => {
    cache.set(cacheKey, { query, selected });
  }, [cache, cacheKey, query, selected]);
  const master = active?.role === "mestre";
  const entries = items.filter(
    (x) =>
      (x.category === category ||
        (category === "discovery" && x.category === "item")) &&
      x.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  if (!active) return null;
  return (
    <section className="codex-registros">
      <div className="row">
        <h2>{nomes[category]}</h2>
        {master && (
          <button
            className="btn-secondary"
            disabled={!!error || loading}
            onClick={() => setEdit(null)}
          >
            <Plus size={15} /> Novo registro
          </button>
        )}
      </div>
      <label>
        Pesquisar {nomes[category]}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {loading && <p role="status">Carregando conhecimento…</p>}
      {error && <Aviso erro t={error} onRetry={refresh} />}
      {!error && !loading && !entries.length && (
        <p className="muted">
          {master
            ? "Nenhum registro nesta categoria."
            : "Nenhuma descoberta revelada nesta categoria."}
        </p>
      )}
      <ul className="codex-entradas">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              className="btn-secondary"
              onClick={() => setSelected(selected === e.id ? undefined : e.id)}
            >
              {e.title}
              {master && ` · conhecimento ${e.knowledge}/4`}
            </button>
            {master && (
              <button
                className="icon-btn"
                aria-label={`Editar ${e.title}`}
                onClick={() => setEdit(e)}
              >
                <Pencil size={16} />
              </button>
            )}
            {selected === e.id && (
              <DetalheConhecido entry={e} onOpenContent={onOpenContent} />
            )}
          </li>
        ))}
      </ul>
      {edit !== undefined && api && (
        <EditorConhecimento
          key={edit?.id ?? "novo"}
          entry={edit}
          category={category}
          onDone={() => {
            setEdit(undefined);
            refresh();
          }}
        />
      )}
    </section>
  );
}
export function EditorConhecimento({
  entry,
  category,
  reference,
  onDone,
}: {
  entry: Conhecimento | null;
  category: CodexCategoria;
  reference?: { id: string; nome: string };
  onDone: () => void;
}) {
  const { active } = useCampaigns(),
    api = useCodexApi();
  const [title, setTitle] = useState(entry?.title ?? reference?.nome ?? ""),
    [text, setText] = useState(deBlocos(entry?.description ?? [])),
    [secret, setSecret] = useState(entry?.secret ?? "");
  const [definition, setDefinition] = useState(
    entry?.definitionId ?? reference?.id ?? "",
  );
  const [level, setLevel] = useState(entry?.knowledge ?? 0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const created = useRef<{ id: string; version: number }>();
  const [file, setFile] = useState<File>(),
    [removeImage, setRemoveImage] = useState(false);
  const origin = useContext(OrigemAbaContext);
  useUnsavedGuard(
    origin ?? "secao:compendio",
    title !== (entry?.title ?? reference?.nome ?? "") ||
      text !== deBlocos(entry?.description ?? []) ||
      secret !== (entry?.secret ?? "") ||
      level !== (entry?.knowledge ?? 0) ||
      !!file ||
      removeImage,
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
        definitionId: definition || undefined,
        instanceId: entry?.instanceId,
        title,
        description: paraBlocos(text),
        secret,
        stats: entry?.stats,
        knowledge: file ? 0 : level,
        imagePath: removeImage ? undefined : entry?.imagePath,
      };
      // New records must exist before Storage accepts a file. Never reveal until the upload and pointer save succeed.
      if (file) {
        if (!id) {
          id = await api.save(active.campaign.id, null, 0, {
            ...data,
            knowledge: 0,
          });
          version = 1;
          created.current = { id, version };
        }
        const path = await api.upload(active.campaign.id, id, file);
        await api.save(active.campaign.id, id, version, {
          ...data,
          imagePath: path,
          knowledge: level,
        });
      } else await api.save(active.campaign.id, id, version, data);
      avisarConhecimento();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="codex-editor" aria-label="Editar conhecimento">
      <h3>{entry ? "Editar registro" : "Novo registro"}</h3>
      <label>
        Nome
        <input
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      {["monster", "item"].includes(category) && (
        <label>
          Identificador canônico
          <input
            value={definition}
            readOnly={!!entry || !!reference}
            onChange={(e) => setDefinition(e.target.value)}
          />
        </label>
      )}
      <label>
        Descrição compartilhada
        <textarea
          value={text}
          maxLength={10000}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <label>
        Notas privadas do mestre
        <textarea
          value={secret}
          maxLength={4000}
          onChange={(e) => setSecret(e.target.value)}
        />
      </label>
      <label>
        Conhecimento
        <select
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
        >
          <option value={0}>Não revelado</option>
          <>
            {category === "monster" && (
              <>
                <option value={1}>1 · Nome</option>
                <option value={2}>2 · Nome e descrição</option>
                <option value={3}>3 · Nome, descrição e imagem</option>
              </>
            )}
            <option value={4}>
              {category === "monster"
                ? "4 · Informações completas"
                : "Publicado para a campanha"}
            </option>
          </>
        </select>
      </label>
      <label>
        Imagem privada (JPEG, PNG, WebP; até 5 MiB)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            setFile(e.target.files?.[0]);
            setRemoveImage(false);
          }}
        />
      </label>
      {entry?.imagePath && (
        <label>
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
        <button
          className="btn-primary"
          disabled={
            busy ||
            !title.trim() ||
            (["monster", "item"].includes(category) && !definition)
          }
          onClick={() => void save()}
        >
          {busy ? "Salvando…" : "Salvar"}
        </button>
        <button className="btn-secondary" disabled={busy} onClick={onDone}>
          Cancelar
        </button>
        {entry && (
          <button
            className="btn-danger"
            disabled={busy}
            onClick={() => {
              if (
                api &&
                active &&
                window.confirm("Remover este registro do Compêndio?")
              ) {
                setBusy(true);
                void api
                  .remove(active.campaign.id, entry.id, entry.version)
                  .then(onDone, () => {
                    setBusy(false);
                    setError(
                      "Não foi possível remover. Recarregue para conferir a versão.",
                    );
                  });
              }
            }}
          >
            <Trash2 size={15} /> Remover
          </button>
        )}
      </div>
    </section>
  );
}
export function RevelarReferencia({
  category,
  id,
  nome,
}: {
  category: "monster" | "item";
  id: string;
  nome: string;
}) {
  const { active } = useCampaigns(),
    { items, error, loading } = useConhecimento();
  const [open, setOpen] = useState(false);
  if (active?.role !== "mestre") return null;
  const entry =
    items.find((x) => x.category === category && x.definitionId === id) ?? null;
  return (
    <>
      <button
        className="btn-secondary"
        disabled={!!error || loading}
        title={error}
        onClick={() => setOpen(!open)}
      >
        {entry ? "Editar conhecimento da campanha" : "Revelar na campanha"}
      </button>
      {open && (
        <EditorConhecimento
          entry={entry}
          category={category}
          reference={{ id, nome }}
          onDone={() => {
            setOpen(false);
            avisarConhecimento();
          }}
        />
      )}
    </>
  );
}
export function AvisosConhecimento() {
  const { items, api, refresh } = useConhecimento();
  const [open, setOpen] = useState(false),
    [notices, setNotices] = useState<CodexAviso[]>([]),
    [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    setNotices([]);
    if (open && api)
      void api.notices().then(
        (n) => {
          if (alive) setNotices(n);
        },
        () => {
          if (alive) setError(true);
        },
      );
    return () => {
      alive = false;
    };
  }, [open, api, items]);
  return (
    <div className="codex-avisos">
      <button
        className="btn-secondary"
        aria-label="Notificações de descobertas"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          refresh();
        }}
      >
        <Bell size={16} />
      </button>
      {open && (
        <section aria-label="Notificações de descobertas">
          <h2>Descobertas recentes</h2>
          {error && (
            <p role="alert">Não foi possível carregar as notificações.</p>
          )}
          {notices.map((n) => {
            const e = items.find((i) => i.id === n.entry_id);
            return e ? (
              <p key={n.id}>
                <strong>{e.title}</strong> · conhecimento {n.knowledge}
                {!n.read_at && (
                  <button
                    className="btn-link"
                    onClick={() =>
                      void api?.seen(n.id).then(
                        () =>
                          setNotices((xs) =>
                            xs.map((x) =>
                              x.id === n.id
                                ? { ...x, read_at: new Date().toISOString() }
                                : x,
                            ),
                          ),
                        () => setError(true),
                      )
                    }
                  >
                    Marcar como lida
                  </button>
                )}
              </p>
            ) : null;
          })}
          {!notices.length && !error && <p>Nenhuma novidade.</p>}
        </section>
      )}
    </div>
  );
}
