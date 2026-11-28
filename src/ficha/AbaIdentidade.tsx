import {Modal} from "../ui/Modal";
import {MenuDeAcoes} from "../ui/MenuDeAcoes";
import {useUnsavedGuard} from "../unsaved";
import {OrigemAbaContext} from "../abrirEmAba";
import type {CharacterDraft} from "../rules/character-domain";
/** Aba Identidade da ficha: a projeção pública do mesmo personagem (não é outro registro). O dono edita; o mestre consulta. */
import { lazy, Suspense, useContext,useState } from "react";
import { Pencil } from "lucide-react";
import { retratoValido } from "../fichas";
import { RetratoQuadrado } from "../RetratoCombate";
import { presentation, publicIdentityCard, type PublicIdentity, type SheetPublicSource } from "../rules/public-identity";
import { Carta, FatosCarta } from "../compendio/Carta";
import { NaCartaContext } from "../compendio/ConsultaCarta";

const Editor = lazy(() => import("../criador/identidade-publica-editor"));

export function AbaIdentidade({ identity, source, retrato, editavel, onChange,story,onStory }: {
  story?:CharacterDraft["story"];onStory?:(s:NonNullable<CharacterDraft["story"]>)=>void;
  identity: PublicIdentity; source: SheetPublicSource; retrato?: string;
  /** Falso quando quem olha não é o dono: a identidade publicada não é editável nem reconstruída. */
  editavel: boolean; onChange: (identity: PublicIdentity) => void;
}) {
  const [editando,setEditando]=useState(false),[rascunho,setRascunho]=useState(identity),[historia,setHistoria]=useState<NonNullable<CharacterDraft['story']>>(story??{});
  const origem=useContext(OrigemAbaContext);
  useUnsavedGuard(origem??'ficha',editando&&(JSON.stringify(rascunho)!==JSON.stringify(identity)||JSON.stringify(historia)!==JSON.stringify(story??{})));
  const abrir=()=>{setRascunho(identity);setHistoria(story??{});setEditando(true);};
  if (!editavel) return <section className="ficha-bloco" aria-label="Identidade pública"><h2>Identidade pública</h2>
    <p className="muted">Somente o dono do personagem edita a identidade pública. Veja o que os outros recebem na carta dele em Personagens.</p></section>;
  const card = publicIdentityCard(identity, { ...source, portrait: retrato ?? source.portrait }), visto = presentation(card);
  return <section className="ficha-bloco ficha-bloco-aberto ficha-identidade-publica" aria-label="Identidade pública">
    {editando && <Modal titulo="Editar identidade" largura={640} onFechar={()=>setEditando(false)} acoes={<><button type="button" className="btn-primary" onClick={()=>{onChange(rascunho);onStory?.(historia);setEditando(false);}}>Salvar</button><button type="button" className="btn-secondary" onClick={()=>setEditando(false)}>Cancelar</button></>}>
      <Suspense fallback={<p role="status">Carregando…</p>}><Editor source={source} initialIdentity={identity} onChange={setRascunho} narrativa={onStory?{value:historia,onChange:setHistoria}:undefined}/></Suspense>
    </Modal>}
    {<NaCartaContext.Provider value={null}><Carta trilha="Como os outros jogadores veem" nome={visto.nome} alcunha={visto.alcunha} rotulo="Prévia da identidade pública"
      retratoGrande imagem={<RetratoQuadrado tipo="personagem" tamanho={300} src={retratoValido(card.imageUrl) ? card.imageUrl : null} ampliar={visto.nome}/>}
      linha={[card.race, card.characterClass, card.level && `Nível ${card.level}`].filter(Boolean).join(" · ") || null}
      acoes={<MenuDeAcoes rotulo="Ações da identidade" acoes={[{rotulo:"Editar identidade pública",icone:Pencil,acao:abrir}]}/>}>
      <FatosCarta fatos={[]}/>{card.description && <p className="cd-texto">{card.description}</p>}
    </Carta></NaCartaContext.Provider>}
  </section>;
}
