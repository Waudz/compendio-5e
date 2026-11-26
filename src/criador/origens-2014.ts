// Origens (antecedentes) do D&D 5e 2014. LICENÇA: o SRD 5.1 (CC BY 4.0) traz apenas o Acólito como origem completa. As demais usam os
// DADOS MECÂNICOS e os RESUMOS PRÓPRIOS do Compêndio 1.0 (`js/origens.js`, do mesmo responsável): perícias, idiomas, ferramentas, ouro e
// equipamento básico. Nenhum texto oficial do Livro do Jogador é distribuído; a característica aparece com o resumo próprio e o que ela
// permite em jogo é combinado com o mestre. Origens de 2014 não concedem bônus de atributo.
import dados from "./data/character-2014.json";

export type ItemDeOrigem = { itemId: string; quantidade?: number; nome?: string };
export type CategoriaFerramenta = "artisans-tools" | "musical-instrument" | "gaming-sets";
export type Origem2014 = {
  id: string; nome: string; fonte: "srd" | "compendio" | "personalizada";
  pericias: string[]; idiomas: number;
  /** Ferramentas fixas (ids do catálogo ou `land-vehicles`/`water-vehicles`). */ ferramentas: string[];
  /** Uma ferramenta à escolha desta categoria. */ escolhaFerramenta?: CategoriaFerramenta;
  ouro: number; equipamento: ItemDeOrigem[];
  caracteristica: string; resumo: string;
};
/** Objeto narrativo sem linha própria no catálogo (carta, troféu, lembrança): entra com o nome informado e sem peso inventado. */
export const OBJETO_DE_ORIGEM = "background-trinket";
const lembranca = (nome: string): ItemDeOrigem => ({ itemId: OBJETO_DE_ORIGEM, nome });

export const ORIGENS_2014: readonly Origem2014[] = [
  { id: "acolyte", nome: "Acólito", fonte: "srd", pericias: ["insight", "religion"], idiomas: 2, ferramentas: [], ouro: 15, caracteristica: "Abrigo dos Fiéis",
    resumo: "Sua comunidade religiosa oferece acolhimento e apoio básico a você e aos companheiros, respeitando a sua ligação com a fé.", equipamento: [] },
  { id: "entertainer", nome: "Artista", fonte: "compendio", pericias: ["acrobatics", "performance"], idiomas: 0, ferramentas: ["disguise-kit"], escolhaFerramenta: "musical-instrument", ouro: 15, caracteristica: "Pela demanda popular",
    resumo: "Você costuma obter alimentação e alojamento modestos ao se apresentar em locais que apreciam seu trabalho.", equipamento: [lembranca("Lembrança de um admirador"), { itemId: "clothes-costume" }, { itemId: "pouch" }] },
  { id: "guild-artisan", nome: "Artesão de Guilda", fonte: "compendio", pericias: ["insight", "persuasion"], idiomas: 1, ferramentas: [], escolhaFerramenta: "artisans-tools", ouro: 15, caracteristica: "Membro de guilda",
    resumo: "Sua guilda fornece contatos e apoio profissional. Os deveres e a contribuição à guilda continuam fazendo parte dessa relação.", equipamento: [lembranca("Carta de apresentação da guilda"), { itemId: "clothes-travelers" }, { itemId: "pouch" }] },
  { id: "charlatan", nome: "Charlatão", fonte: "compendio", pericias: ["deception", "sleight-of-hand"], idiomas: 0, ferramentas: ["disguise-kit", "forgery-kit"], ouro: 15, caracteristica: "Identidade falsa",
    resumo: "Você mantém uma segunda identidade, com documentos e relações de apoio, e sabe produzir falsificações que sustentam seus golpes.", equipamento: [{ itemId: "clothes-fine" }, lembranca("Adereços para golpes"), { itemId: "pouch" }] },
  { id: "criminal", nome: "Criminoso", fonte: "compendio", pericias: ["deception", "stealth"], idiomas: 0, ferramentas: ["thieves-tools"], escolhaFerramenta: "gaming-sets", ouro: 15, caracteristica: "Contato criminal",
    resumo: "Você dispõe de um contato confiável que pode transmitir mensagens e conectar você ao submundo local.", equipamento: [{ itemId: "crowbar" }, { itemId: "clothes-common", nome: "Roupas comuns escuras com capuz" }, { itemId: "pouch" }] },
  { id: "hermit", nome: "Eremita", fonte: "compendio", pericias: ["medicine", "religion"], idiomas: 1, ferramentas: ["herbalism-kit"], ouro: 5, caracteristica: "Descoberta",
    resumo: "Seu isolamento revelou um conhecimento importante. Defina a descoberta e seus efeitos na história com o mestre.", equipamento: [{ itemId: "case-map-or-scroll" }, { itemId: "blanket" }, { itemId: "clothes-common" }, { itemId: "pouch" }] },
  { id: "outlander", nome: "Forasteiro", fonte: "compendio", pericias: ["athletics", "survival"], idiomas: 1, ferramentas: [], escolhaFerramenta: "musical-instrument", ouro: 10, caracteristica: "Andarilho",
    resumo: "Você se orienta bem por mapas e terreno e consegue procurar alimento e água para o grupo onde o ambiente oferece esses recursos.", equipamento: [{ itemId: "quarterstaff" }, { itemId: "hunting-trap" }, lembranca("Troféu de animal"), { itemId: "clothes-travelers" }, { itemId: "pouch" }] },
  { id: "folk-hero", nome: "Herói do Povo", fonte: "compendio", pericias: ["animal-handling", "survival"], idiomas: 0, ferramentas: ["land-vehicles"], escolhaFerramenta: "artisans-tools", ouro: 10, caracteristica: "Hospitalidade rústica",
    resumo: "Pessoas comuns costumam oferecer abrigo e ajuda, inclusive para escondê-lo quando isso não as coloca em perigo imediato.", equipamento: [{ itemId: "shovel" }, { itemId: "pot-iron" }, { itemId: "clothes-common" }, { itemId: "pouch" }] },
  { id: "sailor", nome: "Marinheiro", fonte: "compendio", pericias: ["athletics", "perception"], idiomas: 0, ferramentas: ["navigators-tools", "water-vehicles"], ouro: 10, caracteristica: "Passagem de navio",
    resumo: "Seus contatos marítimos ajudam a conseguir passagem para você e seus companheiros, normalmente com trabalho a bordo.", equipamento: [{ itemId: "club", nome: "Pino de amarração" }, { itemId: "rope-silk-50-feet" }, lembranca("Amuleto da sorte"), { itemId: "clothes-common" }, { itemId: "pouch" }] },
  { id: "noble", nome: "Nobre", fonte: "compendio", pericias: ["history", "persuasion"], idiomas: 1, ferramentas: [], escolhaFerramenta: "gaming-sets", ouro: 25, caracteristica: "Posição privilegiada",
    resumo: "Seu título abre portas na alta sociedade e facilita o acesso a pessoas de posição, conforme os costumes locais.", equipamento: [{ itemId: "clothes-fine" }, { itemId: "signet-ring" }, lembranca("Pergaminho de linhagem"), { itemId: "pouch" }] },
  { id: "urchin", nome: "Órfão", fonte: "compendio", pericias: ["sleight-of-hand", "stealth"], idiomas: 0, ferramentas: ["disguise-kit", "thieves-tools"], ouro: 10, caracteristica: "Segredos da cidade",
    resumo: "Você conhece atalhos urbanos e consegue guiar o grupo por deslocamentos fora de combate com mais rapidez.", equipamento: [{ itemId: "small-knife" }, lembranca("Mapa da cidade natal"), lembranca("Rato de estimação"), lembranca("Lembrança da família"), { itemId: "clothes-common" }, { itemId: "pouch" }] },
  { id: "sage", nome: "Sábio", fonte: "compendio", pericias: ["arcana", "history"], idiomas: 2, ferramentas: [], ouro: 10, caracteristica: "Pesquisador",
    resumo: "Quando não conhece uma informação, você normalmente sabe onde procurar ou quem pode saber a resposta.", equipamento: [{ itemId: "ink-1-ounce-bottle" }, { itemId: "ink-pen" }, { itemId: "small-knife" }, lembranca("Carta de um colega"), { itemId: "clothes-common" }, { itemId: "pouch" }] },
  { id: "soldier", nome: "Soldado", fonte: "compendio", pericias: ["athletics", "intimidation"], idiomas: 0, ferramentas: ["land-vehicles"], escolhaFerramenta: "gaming-sets", ouro: 10, caracteristica: "Patente militar",
    resumo: "Sua antiga patente é reconhecida por aliados da organização militar e pode facilitar o uso de instalações e contatos.", equipamento: [lembranca("Insígnia de patente"), lembranca("Troféu de um inimigo"), { itemId: "clothes-common" }, { itemId: "pouch" }] },
  { id: "custom", nome: "Origem personalizada", fonte: "personalizada", pericias: [], idiomas: 0, ferramentas: [], ouro: 0, caracteristica: "Característica combinada com o mestre",
    resumo: "Escolha duas perícias e uma combinação de dois idiomas ou ferramentas; combine a característica com o mestre e escolha um pacote de equipamento.", equipamento: [] },
];
export const origem2014 = (id: string) => ORIGENS_2014.find(o => o.id === id);

/** Ferramentas (ids do catálogo) de uma categoria de escolha. */
export function ferramentasDaCategoria(categoria: CategoriaFerramenta): string[] {
  return Object.entries(dados.itemCategories as Record<string, { tool?: { category?: string } }>).filter(([, v]) => v.tool?.category === categoria).map(([id]) => (dados.itemIds as Record<string, string>)[id]).filter(Boolean);
}
export const ROTULO_VEICULO: Record<string, string> = { "land-vehicles": "Veículos terrestres", "water-vehicles": "Veículos aquáticos" };
export const ROTULO_CATEGORIA: Record<CategoriaFerramenta, string> = { "artisans-tools": "Ferramentas de artesão", "musical-instrument": "Instrumento musical", "gaming-sets": "Jogo" };
