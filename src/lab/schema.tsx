// PROTÓTIPO: esquema do BlockNote com um conteúdo inline próprio, `ref` (referência interna a NPC, local ou encontro).
// Serve para validar a viabilidade de links internos: o dado guardado é só { kind, refId, label }, nunca HTML nem URL.
import { BlockNoteSchema, defaultInlineContentSpecs } from "@blocknote/core";
import { createReactInlineContentSpec } from "@blocknote/react";

export const RefInline = createReactInlineContentSpec(
  { type: "ref", propSchema: { kind: { default: "npc", values: ["npc", "local", "encontro"] }, refId: { default: "" }, label: { default: "" } }, content: "none" },
  { render: ({ inlineContent }) => (
    <span className="lab-ref" data-kind={inlineContent.props.kind} data-ref-id={inlineContent.props.refId} role="link" tabIndex={0}>{inlineContent.props.label || inlineContent.props.refId}</span>
  ) },
);

export const labSchema = BlockNoteSchema.create({ inlineContentSpecs: { ...defaultInlineContentSpecs, ref: RefInline } });
export type LabEditor = typeof labSchema.BlockNoteEditor;
