// A ficha técnica de um NPC num só lugar: adicionar, editar, trocar e remover. A identidade (nome, retrato, história, vínculos,
// divulgação) não muda aqui. Criatura e editor são os do Bestiário; a ficha de personagem é feita no criador dos aventureiros.
import { useRef, useState } from "react";
import { ClipboardList, Pencil, Trash2 } from "lucide-react";
import { useCampaigns } from "../CampaignsContext";
import { useFichas } from "../RegistrosContext";
import { Aviso } from "../Diario";
import { SeletorMonstro } from "../CombateCompartilhado";
import { avisarConhecimento, useCodexApi, type Conhecimento } from "../compendio/conhecimento";
import { carregarDefinicao, secoesDaDefinicao, useDefinicoes, type Definicao } from "../compendio/definicoes";
import { EditorDefinicao, definicaoEmBranco } from "../compendio/EditorDefinicao";
import { avisarRegistros } from "../registrosStore";
import type { Monstro } from "../catalogue/sistemas/dnd5e-2014/esquemas";
import type { TabSpec } from "../workspace";
import { Modal } from "../ui/Modal";
import { novaOperacao } from "../vitais/vitais";
import { avisarVida, idDaCriaturaPropria, tipoDeFicha, type NovaFichaDeNpc } from "./estado";

const NOMES = { nenhuma: "Sem ficha", personagem: "Ficha de personagem", criatura: "Ficha de criatura própria", referencia: "Vínculo com uma criatura compartilhada do Bestiário" } as const;
/** Aba do criador para dar (ou trocar por) uma ficha de personagem; o sufixo evita reabrir uma edição antiga. */
export const abaDeFichaDeNpc = (entry: Pick<Conhecimento, "id" | "title">, trocar: boolean): TabSpec =>
  ({ kind: "criador", ref: `novo-npc-${entry.id}-${trocar ? "trocar" : "nova"}-${novaOperacao().slice(0, 8)}`, title: `Ficha de ${entry.title}` });

export function FichaDoNpc({ entry, onFechar, onOpenContent }: { entry: Conhecimento; onFechar: () => void; onOpenContent: (s: TabSpec) => void }) {
  const api = useCodexApi(), fichas = useFichas(), { active } = useCampaigns(), definicoes = useDefinicoes();
  const tipo = tipoDeFicha(entry), perde = tipo === "personagem" || tipo === "criatura";
  const [ciente, setCiente] = useState(false), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null);
  const [passo, setPasso] = useState<"inicio" | "modelo">("inicio");
  const [editor, setEditor] = useState<{ inicial: Definicao; titulo: string; base?: string; propria: boolean } | null>(null);
  const operacao = useRef(novaOperacao());
  const bloqueado = ocupado || (perde && !ciente);

  const aplicar = async (nova: NovaFichaDeNpc, confirmar = perde) => {
    if (!api?.definirFichaNpc || !active) return false;
    setOcupado(true); setErro(null);
    try {
      let revisao: number | undefined;
      if (tipo === "personagem") {
        const atual = await fichas?.carregar(entry.id);
        if (!atual?.ok || !atual.data) throw Error("Não foi possível ler a ficha atual. Nada foi alterado.");
        revisao = atual.data.ficha.revision;
      }
      await api.definirFichaNpc(active.campaign.id, entry.id, entry.version, nova, { operacao: operacao.current, revisao, confirmar });
      operacao.current = novaOperacao();
      avisarConhecimento(); avisarRegistros(); avisarVida();
      onFechar();
      return true;
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível alterar a ficha. Nada foi alterado."); return false; }
    finally { setOcupado(false); }
  };
  /** Cópia exclusiva do NPC: o catálogo e as outras criaturas da campanha não mudam. */
  const copiaDe = (m: Monstro): Monstro => ({ ...m, id: idDaCriaturaPropria(entry.id), idsAnteriores: undefined, formas: undefined });
  const usarModelo = (m: Monstro) => {
    const definicao = JSON.parse(JSON.stringify(copiaDe(m))) as Monstro;
    void aplicar({ tipo: "criatura", definicao, base: m.id, secoes: secoesDaDefinicao({ kind: "monster", id: definicao.id, nome: definicao.nome, monstro: definicao }) });
  };
  const personalizada = () => {
    const branco = definicaoEmBranco("monster") as Extract<Definicao, { kind: "monster" }>, id = idDaCriaturaPropria(entry.id);
    setEditor({ titulo: `Criatura de ${entry.title}`, propria: false, inicial: { kind: "monster", id, nome: entry.title, monstro: { ...branco.monstro, id, nome: entry.title } } });
  };
  const editar = async () => {
    if (tipo === "personagem") { onFechar(); onOpenContent({ kind: "ficha", ref: entry.id, title: entry.title }); return; }
    const d = await carregarDefinicao("monster", entry.combatDefinitionId!, definicoes.lista);
    if (d?.kind !== "monster") { setErro("A criatura desta ficha não foi encontrada."); return; }
    if (tipo === "criatura") { setEditor({ titulo: `Editar a ficha de ${entry.title}`, propria: true, inicial: d }); return; }
    // vínculo antigo: editar significa criar a cópia própria, sem tocar na criatura compartilhada
    const monstro = copiaDe(d.monstro);
    setEditor({ titulo: `Cópia própria de ${entry.title}`, propria: false, base: d.id, inicial: { kind: "monster", id: monstro.id, nome: monstro.nome, monstro } });
  };

  if (editor) return <EditorDefinicao inicial={editor.inicial} titulo={editor.titulo} baseId={editor.base} onFechar={() => setEditor(null)}
    onSalvo={() => { setEditor(null); avisarVida(); onFechar(); }}
    onGravar={editor.propria ? undefined : async pronta => {
      if (pronta.kind !== "monster") return;
      if (!(await aplicar({ tipo: "criatura", definicao: pronta.monstro, base: editor.base, secoes: secoesDaDefinicao(pronta) }))) throw Error("Não foi possível gravar a ficha. Nada foi alterado.");
    }}/>;

  return <Modal titulo={`Ficha de ${entry.title}`} onFechar={onFechar} ocupado={ocupado} largura={560}>
    <div className="ficha-npc">
      <p><strong>{NOMES[tipo]}</strong></p>
      <p className="muted">Só o mestre vê a ficha. Nome, retrato, história, vínculos e o que os jogadores sabem não mudam.</p>
      {erro && <Aviso erro t={erro}/>}
      {tipo !== "nenhuma" && <div className="row">
        <button type="button" className="btn-secondary" disabled={ocupado} onClick={() => { onFechar(); onOpenContent(tipo === "personagem" ? { kind: "ficha", ref: entry.id, title: entry.title } : { kind: "npc", ref: entry.id, title: entry.title }); }}><ClipboardList size={14} aria-hidden="true"/> Ver ficha</button>
        <button type="button" className="btn-secondary" disabled={ocupado} onClick={() => void editar()}><Pencil size={14} aria-hidden="true"/> {tipo === "referencia" ? "Editar uma cópia própria" : "Editar ficha"}</button>
      </div>}
      {perde && <label className="ciclo-confirmo"><input type="checkbox" checked={ciente} onChange={e => setCiente(e.target.checked)}/> Entendo que a ficha atual sai do NPC ao trocar ou remover. Uma cópia privada, fora do aplicativo, fica guardada por 30 dias e depois é apagada.</label>}
      <h3>{tipo === "nenhuma" ? "Adicionar ficha" : "Trocar ficha"}</h3>
      <div className="row">
        <button type="button" className="btn-secondary" disabled={bloqueado} aria-pressed={passo === "modelo"} onClick={() => setPasso(p => (p === "modelo" ? "inicio" : "modelo"))}>Modelo do Bestiário</button>
        <button type="button" className="btn-secondary" disabled={bloqueado} onClick={personalizada}>Criatura personalizada</button>
        <button type="button" className="btn-secondary" disabled={bloqueado || !fichas} onClick={() => { onFechar(); onOpenContent(abaDeFichaDeNpc(entry, perde)); }}>Ficha de personagem</button>
      </div>
      {passo === "modelo" && !bloqueado && <><p className="muted">O NPC recebe uma cópia própria; editar não altera o Bestiário.</p><SeletorMonstro rotulo="Escolher modelo" acao="Vincular" onEscolher={usarModelo}/></>}
      {tipo !== "nenhuma" && <div className="row"><button type="button" className="btn-secondary danger" disabled={bloqueado} onClick={() => void aplicar(null)}><Trash2 size={14} aria-hidden="true"/> Remover ficha</button></div>}
    </div>
  </Modal>;
}
