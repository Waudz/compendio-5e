// Editor rico de páginas (BlockNote 0.57.0, versão fixa). Carregado sob demanda (import dinâmico) pelo Diário e pelo Planejamento.
// Formato guardado: o array de blocos do BlockNote em `notes.content` (jsonb). O servidor (migração 0005) valida o formato e deriva o texto de busca.
// Imagem, vídeo, áudio e arquivo ficam FORA: o contrato da 0005 só aceita mídia em `storage:campaign-assets/...`, ainda sem upload no editor.
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useRef } from "react";
import type { BlocoTexto } from "./inicio";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { image, video, audio, file, ...permitidos } = defaultBlockSpecs;
const schema = BlockNoteSchema.create({ blockSpecs: permitidos });

export type PageEditorProps = {
  /** Conteúdo inicial (lido uma vez; para trocar de registro, remonte com `key`). */
  inicial: BlocoTexto[];
  /** Chamado a cada alteração com o documento completo. */
  onChange?: (blocos: BlocoTexto[]) => void;
  editavel?: boolean;
  rotulo?: string;
  /** Coloca o cursor no editor ao montar (ex.: clicar no texto de um cartão para editar). */
  focar?: boolean;
};

export default function PageEditor({ inicial, onChange, editavel = true, rotulo = "Conteúdo da página", focar = false }: PageEditorProps) {
  const editor = useCreateBlockNote({ schema, initialContent: inicial.length ? (inicial as never) : undefined, ...(focar && { autofocus: "end" as const }) });
  const cb = useRef(onChange); useEffect(() => { cb.current = onChange; }, [onChange]);
  return <div className="page-editor" role="group" aria-label={rotulo}>
    <BlockNoteView editor={editor as never} theme="dark" editable={editavel} onChange={() => cb.current?.(editor.document as unknown as BlocoTexto[])}/>
  </div>;
}
