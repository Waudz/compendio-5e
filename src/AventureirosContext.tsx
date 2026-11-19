import { createContext, useContext } from "react";
import type { FonteAventureiros } from "./inicio";

/** Fonte dos personagens vinculados à campanha. null: o módulo de personagens ainda não existe (o Início mostra isso, sem inventar dados). */
export const AventureirosContext = createContext<FonteAventureiros | null>(null);
export const useAventureiros = () => useContext(AventureirosContext);
