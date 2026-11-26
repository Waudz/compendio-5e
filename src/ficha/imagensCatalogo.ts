// Imagens que o responsável cadastrou no Compêndio 1.0, associadas ao catálogo do 2.0 (ver docs/IMAGENS-V1.md). Os arquivos continuam
// onde estão, no armazenamento público do 1.0; aqui ficam só as associações. Item ou monstro sem imagem usa o ícone padrão.
import mapa from "../catalogue/data/imagens-v1.json";

type Entrada = { chaveV1: string; caminho?: string; url?: string };
const itens = mapa.itens as Record<string, Entrada>, monstros = mapa.monstros as Record<string, Entrada>;
const url = (e: Entrada | undefined) => e?.url ?? (e?.caminho ? mapa.base + e.caminho : null);

export const imagemDoItem = (id: string): string | null => url(itens[id]);
export const imagemDoMonstro = (id: string): string | null => url(monstros[id]);
export const totalDeImagens = () => ({ itens: Object.keys(itens).length, monstros: Object.keys(monstros).length });
