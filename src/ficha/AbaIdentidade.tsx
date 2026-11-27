/** Aba Identidade da ficha: a projeção pública do mesmo personagem (não é outro registro). O dono edita; o mestre consulta. */
import { lazy, Suspense, useState } from "react";
import { Pencil } from "lucide-react";
import { retratoValido } from "../fichas";
import { RetratoQuadrado } from "../RetratoCombate";
import { presentation, publicIdentityCard, type PublicIdentity, type SheetPublicSource } from "../rules/public-identity";
import { Carta, FatosCarta } from "../compendio/Carta";
import { NaCartaContext } from "../compendio/ConsultaCarta";

const Editor = lazy(() => import("../criador/identidade-publica-editor"));

export function AbaIdentidade({ identity, source, retrato, editavel, onChange }: {
  identity: PublicIdentity; source: SheetPublicSource; retrato?: string;
  /** Falso quando quem olha não é o dono: a identidade publicada não é editável nem reconstruída. */
  editavel: boolean; onChange: (identity: PublicIdentity) => void;
}) {
  const [editando, setEditando] = useState(false);
  if (!editavel) return <section className="ficha-bloco" aria-label="Identidade pública"><h2>Identidade pública</h2>
    <p className="muted">Somente o dono do personagem edita a identidade pública. Veja o que os outros recebem na carta dele em Personagens.</p></section>;
  const card = publicIdentityCard(identity, { ...source, portrait: retrato ?? source.portrait }), visto = presentation(card);
  return <section className="ficha-bloco ficha-bloco-aberto ficha-identidade-publica" aria-label="Identidade pública">
    {editando ? <>
      <Suspense fallback={<p role="status">Carregando…</p>}><Editor source={source} initialIdentity={identity} onChange={onChange}/></Suspense>
      <button type="button" className="ficha-botao" onClick={() => setEditando(false)}>Concluir</button>
    </> : <NaCartaContext.Provider value={null}><Carta trilha="Como os outros jogadores veem" nome={visto.nome} alcunha={visto.alcunha} rotulo="Prévia da identidade pública"
      retratoGrande imagem={<RetratoQuadrado tipo="personagem" tamanho={300} src={retratoValido(card.imageUrl) ? card.imageUrl : null} ampliar={visto.nome}/>}
      linha={[card.race, card.characterClass, card.level && `Nível ${card.level}`].filter(Boolean).join(" · ") || null}
      acoes={<button type="button" className="ficha-botao" onClick={() => setEditando(true)}><Pencil size={13} aria-hidden="true"/> Editar identidade pública</button>}>
      <FatosCarta fatos={[]}/>{card.description && <p className="cd-texto">{card.description}</p>}
    </Carta></NaCartaContext.Provider>}
  </section>;
}
