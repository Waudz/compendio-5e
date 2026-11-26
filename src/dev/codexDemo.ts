/** Somente demonstração isolada; autorização de produção é SQL, não este adaptador. */
import type {
  CodexApi,
  Conhecimento,
  CodexAviso,
} from "../compendio/conhecimento";
export function codexDemo(master: boolean, campaign: string): CodexApi {
  const key = "demo:codex:v1";
  const read = (): Conhecimento[] => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      return [];
    }
  };
  const write = (xs: Conhecimento[]) =>
    localStorage.setItem(key, JSON.stringify(xs));
  const check = () => {
    if (!master) throw Error("Somente o mestre.");
  };
  return {
    list: async (cid) => {
      if (cid !== campaign) throw Error("Outra campanha.");
      return read()
        .filter((x) => master || x.knowledge > 0)
        .map((x) =>
          master
            ? x
            : {
                id: x.id,
                title: x.title,
                category: x.category,
                systemId: x.systemId,
                version: x.version,
                knowledge: x.knowledge,
                ...(x.knowledge >= 2 ? { description: x.description } : {}),
                ...(x.knowledge >= 3
                  ? {
                      imagePath: x.imagePath,
                      imageDefinitionId: x.definitionId,
                    }
                  : {}),
                ...(x.knowledge === 4 || x.category === "item"
                  ? { definitionId: x.definitionId }
                  : {}),
                ...(x.knowledge === 4 ? { stats: x.stats } : {}),
              },
        );
    },
    save: async (cid, id, version, data) => {
      check();
      if (cid !== campaign) throw Error("Outra campanha.");
      const xs = read(),
        old = xs.find((x) => x.id === id);
      if (id && old?.version !== version) throw Error("Conflito de versão.");
      if (
        !id &&
        data.definitionId &&
        xs.some(
          (x) =>
            x.category === data.category &&
            x.definitionId === data.definitionId,
        )
      )
        throw Error("Já existe uma descoberta para essa definição.");
      const eid = id ?? crypto.randomUUID();
      write([
        ...xs.filter((x) => x.id !== eid),
        { ...data, id: eid, version: version + 1 },
      ]);
      return eid;
    },
    remove: async (cid, id, version) => {
      check();
      const xs = read();
      if (cid !== campaign || xs.find((x) => x.id === id)?.version !== version)
        throw Error("Conflito.");
      write(xs.filter((x) => x.id !== id));
    },
    upload: async () => {
      throw Error(
        "Upload exige Storage privado. A demonstração não envia arquivos.",
      );
    },
    image: async () => {
      throw Error("Imagem indisponível.");
    },
    holders: async () => [],
    notices: async () => [] as CodexAviso[],
    seen: async () => {},
  };
}
