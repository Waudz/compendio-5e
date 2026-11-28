/** Campos de história e personalidade (`draft.story`), usados pelo editor e pela ficha. Privados: só dono e mestre. */
export const CAMPOS_ORIGEM = [["idade", "Idade"], ["ocupacao", "Ocupação"], ["naturalidade", "Naturalidade"], ["residencia", "Residência"]] as const;
/** Campos de texto que também podem apontar para um local do Compêndio. */
export const LOCAIS_DA_HISTORIA: Partial<Record<string, "naturalidadeLocal" | "residenciaLocal">> = { naturalidade: "naturalidadeLocal", residencia: "residenciaLocal" };
export const CAMPOS_HISTORIA = [["personalidade", "Traços de personalidade"], ["ideais", "Ideais"], ["vinculos", "Vínculos"], ["defeitos", "Defeitos"], ["historia", "História"]] as const;
/** Tudo o que a ficha mostra, na ordem do formulário. */
export const CAMPOS_NARRATIVOS = [...CAMPOS_ORIGEM, ...CAMPOS_HISTORIA, ["observacoes", "Observações"]] as const;
