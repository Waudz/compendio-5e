import { createContext, useContext, useMemo } from "react";
import { useRegistros, useCapa } from "./RegistrosContext";
import { fontePersonagens } from "./perfilPersonagem";
import type { FonteAventureiros } from "./inicio";

/** Fonte compartilhada dos personagens publicados da campanha. Usa a API autenticada de registros; a fonte explícita atende testes e integrações. */
export const AventureirosContext = createContext<FonteAventureiros | null>(null);
export function useAventureiros() {
  const explicita = useContext(AventureirosContext), registros = useRegistros(), capa = useCapa();
  return useMemo(() => explicita ?? (registros ? fontePersonagens(registros, capa) : null), [explicita, registros, capa]);
}
