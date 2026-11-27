// Ciclo de vida dos personagens na interface: situação, ofertas e avisos da campanha ativa, e as janelas de renúncia, gestão pelo
// mestre, exclusão em lote e aceite de transferência. Quem pode o quê é decidido no banco (0021); sem ela nada disto é oferecido.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useCampaigns } from "./CampaignsContext";
import { useFichas, useRegistros } from "./RegistrosContext";
import { avisarRegistros, useVersaoRegistros } from "./registrosStore";
import { avisarConhecimento } from "./compendio/conhecimento";
import { limparRecuperacao } from "./criador/recuperacao";
import { listarPersonagens, type PersonagemCampanha } from "./personagensCampanha";
import { useJogadoresCampanha } from "./jogadoresCampanha";
import { CONFIRMACAO_DE_EXCLUSAO, type AcaoCiclo, type AvisoPersonagem, type OfertaPersonagem, type Situacao } from "./cicloPersonagem";
import type { Member } from "./campaigns";
import type { Kind } from "./workspace";
import { Modal } from "./ui/Modal";

/** Pede ao workspace (computador e celular) que feche as páginas que o usuário não pode mais acessar. */
export const CICLO_ACESSO = "compendio:ciclo-acesso";
export type DetalheAcesso = { campaignId: string; ids: string[]; kinds: Kind[] };

export const ROTULO_SITUACAO: Record<Situacao, string> = { ativo: "Ativo", aguardando: "Aguardando decisão", arquivado: "Arquivado", npc: "NPC", compendio: "Só no Compêndio" };

type Janela =
  | { tipo: "renuncia"; id: string }
  | { tipo: "gestao"; id: string }
  | { tipo: "lote"; ids: string[] }
  | { tipo: "oferta"; oferta: OfertaPersonagem };

type Ciclo = {
  /** O banco tem a 0021. */ disponivel: boolean;
  ofertas: OfertaPersonagem[]; avisos: AvisoPersonagem[];
  lerAvisos: (ids: number[]) => Promise<boolean>;
  pedirRenuncia: (id: string) => void;
  gerenciar: (id: string) => void;
  excluirVarios: (ids: string[]) => void;
  abrirOferta: (o: OfertaPersonagem) => void;
};
const Ctx = createContext<Ciclo>({ disponivel: false, ofertas: [], avisos: [], lerAvisos: async () => true, pedirRenuncia() {}, gerenciar() {}, excluirVarios() {}, abrirOferta() {} });
export const useCiclo = () => useContext(Ctx);

export function CicloProvider({ children }: { children: ReactNode }) {
  const fichas = useFichas(), { active } = useCampaigns(), { user } = useAuth(), versao = useVersaoRegistros();
  const api = fichas?.ciclo, cid = active?.campaign.id, souMestre = active?.role === "mestre";
  const escopo = `${user?.id}:${cid}:${active?.role}`;
  const [estado, setEstado] = useState<{ escopo: string; disponivel: boolean; ofertas: OfertaPersonagem[]; avisos: AvisoPersonagem[] }>();
  const [janela, setJanela] = useState<Janela | null>(null), [volta, setVolta] = useState(0);
  const assinatura = useRef<{ escopo: string; valor: string }>();
  const escopoAtual = useRef(escopo); escopoAtual.current = escopo;
  useEffect(() => { setJanela(null); }, [escopo]);
  useEffect(() => {
    if (!api) return;
    const reler = () => { if (document.visibilityState !== "hidden") setVolta(v => v + 1); };
    window.addEventListener("focus", reler);
    const timer = setInterval(reler, 30000);
    return () => { window.removeEventListener("focus", reler); clearInterval(timer); };
  }, [api]);
  useEffect(() => {
    if (!api || !cid) return;
    let vivo = true;
    void (async () => {
      const s = await api.situacoes(cid);
      if (!vivo || !s.ok) return;
      if (s.data === null) { setEstado({ escopo, disponivel: false, ofertas: [], avisos: [] }); return; }
      const [o, a] = await Promise.all([api.ofertas(cid), api.avisos(cid)]);
      if (!vivo) return;
      setEstado({ escopo, disponivel: true, ofertas: o.ok ? o.data : [], avisos: a.ok ? a.data : [] });
      // outro aparelho (ou o mestre) mudou a situação: atualiza listas e, para o jogador, fecha a ficha que saiu do alcance dele
      const valor = JSON.stringify([s.data, o.ok ? o.data.map(x => x.id) : []]);
      const anterior = assinatura.current;
      assinatura.current = { escopo, valor };
      if (anterior?.escopo === escopo && anterior.valor !== valor) { avisarRegistros(); avisarConhecimento(); }
      const fora = souMestre ? [] : s.data.filter(x => x.state !== "ativo").map(x => x.id);
      if (fora.length) window.dispatchEvent(new CustomEvent<DetalheAcesso>(CICLO_ACESSO, { detail: { campaignId: cid, ids: fora, kinds: ["ficha", "criador"] } }));
    })().catch(() => {});
    return () => { vivo = false; };
  }, [api, cid, escopo, souMestre, versao, volta]);

  const atual = estado?.escopo === escopo ? estado : undefined;
  const lerAvisos = useCallback(async (ids: number[]) => {
    if (!api || !ids.length) return true;
    const r = await api.lerAvisos(ids);
    if (r.ok) setEstado(e => e && { ...e, avisos: e.avisos.map(a => (ids.includes(a.id) && !a.readAt ? { ...a, readAt: new Date().toISOString() } : a)) });
    return r.ok;
  }, [api]);
  const fechar = () => setJanela(null);
  /** Depois de uma operação confirmada pelo banco: fecha o que saiu do alcance, descarta cópias locais e recarrega as telas. */
  const concluir = (ids: string[], fecharAbas: Kind[]) => {
    if (!cid || escopoAtual.current !== escopo) return;
    if (fecharAbas.length) {
      if (user) ids.forEach(id => limparRecuperacao(user.id, cid, id));
      window.dispatchEvent(new CustomEvent<DetalheAcesso>(CICLO_ACESSO, { detail: { campaignId: cid, ids, kinds: fecharAbas } }));
    }
    setJanela(null); setVolta(v => v + 1); avisarRegistros(); avisarConhecimento();
  };

  const valor: Ciclo = {
    disponivel: !!atual?.disponivel, ofertas: atual?.ofertas ?? [], avisos: atual?.avisos ?? [], lerAvisos,
    pedirRenuncia: id => setJanela({ tipo: "renuncia", id }),
    gerenciar: id => setJanela({ tipo: "gestao", id }),
    excluirVarios: ids => setJanela({ tipo: "lote", ids }),
    abrirOferta: oferta => setJanela({ tipo: "oferta", oferta }),
  };
  return <Ctx.Provider value={valor}>{children}
    {janela?.tipo === "renuncia" && <Renuncia key={janela.id} id={janela.id} onFechar={fechar} onFeito={() => concluir([janela.id], ["ficha", "criador"])}/>}
    {janela?.tipo === "gestao" && <Gestao key={janela.id} id={janela.id} onFechar={fechar} onFeito={kinds => concluir([janela.id], kinds)}/>}
    {janela?.tipo === "lote" && <Lote key={janela.ids.join()} ids={janela.ids} onFechar={fechar} onFeito={() => concluir(janela.ids, ["ficha", "criador", "identidade"])}/>}
    {janela?.tipo === "oferta" && <Oferta key={janela.oferta.id} oferta={janela.oferta} onFechar={fechar} onFeito={() => concluir([janela.oferta.characterId], [])}/>}
  </Ctx.Provider>;
}

/** Lê de novo os personagens ao abrir a janela: a revisão conferida pelo banco é a que a pessoa está vendo. */
function usePersonagensAtuais() {
  const registros = useRegistros(), fichas = useFichas(), { active } = useCampaigns(), { user } = useAuth();
  const [r, setR] = useState<{ lista?: PersonagemCampanha[]; erro?: string }>({});
  const cid = active?.campaign.id, uid = user?.id ?? null;
  useEffect(() => {
    if (!registros || !cid) return;
    let vivo = true;
    listarPersonagens(cid, { registros, fichas, userId: uid }).then(x => { if (vivo) setR(x.ok ? { lista: x.data.personagens } : { erro: x.error }); }, () => { if (vivo) setR({ erro: "Não foi possível carregar o personagem." }); });
    return () => { vivo = false; };
  }, [registros, fichas, cid, uid]);
  return r;
}

/** Uma operação por janela: repetir depois de uma falha de rede usa o mesmo identificador. */
function useOperacao() {
  const fichas = useFichas(), { active } = useCampaigns();
  const id = useRef<{ acao: string; operacao: string }>();
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
  const executar = async (ids: string[], acao: AcaoCiclo, revisoes: Record<string, number>, destino?: string) => {
    if (!fichas?.ciclo || !active || ocupado) return false;
    const chave = JSON.stringify([ids, acao, destino]);
    if (id.current?.acao !== chave) id.current = { acao: chave, operacao: crypto.randomUUID() };
    setOcupado(true); setErro("");
    try {
      // só se chega aqui pela exclusão depois da confirmação explícita da própria janela
      const r = await fichas.ciclo.agir({ campaignId: active.campaign.id, ids, acao, operacao: id.current.operacao, revisoes, destino, ...(acao === "excluir" ? { confirmacao: CONFIRMACAO_DE_EXCLUSAO } : {}) });
      if (!r.ok) { setErro(r.error); return false; }
      return true;
    } catch { setErro("Não foi possível confirmar a operação. Confira a lista antes de tentar de novo."); return false; }
    finally { setOcupado(false); }
  };
  return { executar, ocupado, erro, setErro };
}
const revisoesDe = (ps: PersonagemCampanha[]) => Object.fromEntries(ps.flatMap(p => (p.revisao !== undefined ? [[p.id, p.revisao]] : [])));

function Renuncia({ id, onFechar, onFeito }: { id: string; onFechar: () => void; onFeito: () => void }) {
  const { lista, erro: falhaDeLeitura } = usePersonagensAtuais(), op = useOperacao();
  const p = lista?.find(x => x.id === id), [ciente, setCiente] = useState(false);
  return <Modal titulo="Excluir personagem" onFechar={onFechar} ocupado={op.ocupado} acoes={<>
    <button type="button" className="btn-secondary" data-foco disabled={op.ocupado} onClick={onFechar}>Cancelar</button>
    <button type="button" className="btn-secondary danger" disabled={!p || !p.meu || !ciente || op.ocupado} onClick={() => void op.executar([id], "renunciar", revisoesDe(p ? [p] : [])).then(ok => { if (ok) onFeito(); })}>{op.ocupado ? "Excluindo…" : "Excluir personagem"}</button></>}>
    {!lista && !falhaDeLeitura && <p role="status">Carregando personagem…</p>}
    {falhaDeLeitura && <p role="alert">{falhaDeLeitura}</p>}
    {lista && (!p || !p.meu) && <p role="alert">Este personagem não está mais sob o seu controle.</p>}
    {p?.meu && <>
      <p>Você vai perder o controle de <strong>{p.nome}</strong> nesta campanha: a ficha sai da sua lista e você não poderá mais abri-la nem editá-la.</p>
      <p>O mestre será avisado e decide o destino do personagem. Ele pode preservar a ficha, o inventário, o progresso, a identidade e os vínculos. Alterações ainda não salvas são descartadas. Você pode criar outro personagem em seguida.</p>
      <label className="check ciclo-confirmo"><input type="checkbox" checked={ciente} disabled={op.ocupado} onChange={e => setCiente(e.target.checked)}/> Entendo que vou perder o controle deste personagem</label>
    </>}
    {op.erro && <p role="alert">{op.erro}</p>}
  </Modal>;
}

type Opcao = { acao: AcaoCiclo; titulo: string; texto: string };
const OPCOES: Opcao[] = [
  { acao: "compendio", titulo: "Manter apenas no Compêndio", texto: "Remove a ficha técnica; a identidade e os vínculos continuam no Compêndio. Uma cópia privada fica guardada por 30 dias para recuperação pelo responsável do sistema." },
  { acao: "arquivar", titulo: "Arquivar personagem", texto: "Preserva a ficha inteira e os vínculos, sem prazo, enquanto a campanha existir. Sai das listas de ativos." },
  { acao: "npc", titulo: "Converter em NPC", texto: "A ficha completa passa ao seu controle, no mesmo registro, listado entre os NPCs." },
  { acao: "reativar", titulo: "Reativar", texto: "Volta a ser um personagem ativo, sob o seu controle. Para devolver a um jogador, transfira." },
  { acao: "transferir", titulo: "Transferir para outro jogador", texto: "Quem receber precisa aceitar. Ficha, inventário, progresso, identidade e vínculos vão junto." },
  { acao: "excluir", titulo: "Excluir definitivamente", texto: "Apaga a ficha e a cópia de recuperação, o registro no Compêndio e os vínculos. Ficam só os documentos e históricos. Não há como recuperar; cópias em backups técnicos expiram no prazo do provedor." },
];
const opcoesPara = (p: PersonagemCampanha): Opcao[] => OPCOES.filter(o => {
  if (o.acao === "excluir") return true;
  if (!p.guiado || p.situacao === "compendio") return false;
  if (o.acao === "arquivar") return p.situacao !== "arquivado";
  if (o.acao === "npc") return p.situacao !== "npc";
  if (o.acao === "reativar") return p.situacao !== "ativo";
  return true;
});

function useParticipantes() {
  const { api, active } = useCampaigns(), cid = active?.campaign.id;
  const [membros, setMembros] = useState<Member[]>([]);
  useEffect(() => {
    if (!api || !cid || typeof api.members !== "function") return;
    let vivo = true;
    void api.members(cid).then(r => { if (vivo && r.ok) setMembros(r.data); }, () => {});
    return () => { vivo = false; };
  }, [api, cid]);
  return membros;
}

function Gestao({ id, onFechar, onFeito }: { id: string; onFechar: () => void; onFeito: (fecharAbas: Kind[]) => void }) {
  const { lista, erro: falhaDeLeitura } = usePersonagensAtuais(), op = useOperacao(), membros = useParticipantes(), jogador = useJogadoresCampanha(), { user } = useAuth();
  const p = lista?.find(x => x.id === id);
  const [escolha, setEscolha] = useState<AcaoCiclo | "">(""), [destino, setDestino] = useState(""), [confirmado, setConfirmado] = useState(false);
  const destrutiva = escolha === "excluir" || escolha === "compendio";
  const pronto = !!p && !!escolha && (!destrutiva || confirmado) && (escolha !== "transferir" || !!destino);
  const confirmar = () => {
    if (!p || !escolha) return;
    void op.executar([id], escolha, revisoesDe([p]), escolha === "transferir" ? destino : undefined)
      .then(ok => { if (ok) onFeito(escolha === "excluir" ? ["ficha", "criador", "identidade"] : escolha === "compendio" ? ["ficha", "criador"] : []); });
  };
  const nomeDe = (uid: string) => jogador(uid) ?? membros.find(m => m.user_id === uid)?.display_name ?? "participante";
  return <Modal titulo="Gerenciar personagem" largura={560} onFechar={onFechar} ocupado={op.ocupado} acoes={<>
    <button type="button" className="btn-secondary" data-foco disabled={op.ocupado} onClick={onFechar}>{p?.situacao === "aguardando" ? "Decidir depois" : "Fechar"}</button>
    <button type="button" className={destrutiva ? "btn-secondary danger" : "btn-primary"} disabled={!pronto || op.ocupado} onClick={confirmar}>{op.ocupado ? "Aplicando…" : escolha === "excluir" ? "Excluir definitivamente" : "Confirmar"}</button></>}>
    {!lista && !falhaDeLeitura && <p role="status">Carregando personagem…</p>}
    {falhaDeLeitura && <p role="alert">{falhaDeLeitura}</p>}
    {lista && !p && <p role="alert">Este personagem não está mais disponível nesta campanha.</p>}
    {p && <div className="ciclo-gestao">
      <p><strong>{p.nome}</strong> · {ROTULO_SITUACAO[p.situacao]}{p.ownerId && p.ownerId !== user?.id ? ` · Jogador: ${nomeDe(p.ownerId)}` : ""}</p>
      {p.pendenteDe && <p className="notice" role="note">Transferência aguardando o aceite de {nomeDe(p.pendenteDe)}.{" "}
        <button type="button" className="btn-link" disabled={op.ocupado} onClick={() => void op.executar([id], "cancelar-transferencia", {}).then(ok => { if (ok) onFeito([]); })}>Cancelar transferência</button></p>}
      <fieldset className="ciclo-opcoes" disabled={op.ocupado}><legend>O que fazer com este personagem?</legend>
        {opcoesPara(p).map(o => <label key={o.acao} className={"ciclo-opcao" + (o.acao === "excluir" ? " perigo" : "")}>
          <input type="radio" name="ciclo-acao" value={o.acao} checked={escolha === o.acao} onChange={() => { setEscolha(o.acao); setConfirmado(false); op.setErro(""); }}/>
          <span><strong>{o.titulo}</strong><small>{o.texto}</small></span></label>)}
      </fieldset>
      {escolha === "transferir" && <label>Novo jogador<select value={destino} onChange={e => setDestino(e.target.value)}><option value="">Selecione</option>
        {membros.filter(m => m.user_id !== p.ownerId).map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}{m.user_id === user?.id ? " (você, sem precisar de aceite)" : ""}</option>)}</select></label>}
      {destrutiva && <label className="check ciclo-confirmo"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)}/>
        {escolha === "excluir" ? `Confirmo a exclusão definitiva de ${p.nome}, sem cópia de recuperação` : `Confirmo a remoção da ficha técnica de ${p.nome}`}</label>}
    </div>}
    {op.erro && <p role="alert">{op.erro}</p>}
  </Modal>;
}

function Lote({ ids, onFechar, onFeito }: { ids: string[]; onFechar: () => void; onFeito: () => void }) {
  const { lista, erro: falhaDeLeitura } = usePersonagensAtuais(), op = useOperacao();
  const alvos = lista?.filter(p => ids.includes(p.id)) ?? [], [texto, setTexto] = useState("");
  const completos = !!lista && alvos.length === ids.length;
  return <Modal titulo="Excluir personagens" largura={520} onFechar={onFechar} ocupado={op.ocupado} acoes={<>
    <button type="button" className="btn-secondary" data-foco disabled={op.ocupado} onClick={onFechar}>Cancelar</button>
    <button type="button" className="btn-secondary danger" disabled={!completos || texto.trim() !== "EXCLUIR" || op.ocupado} onClick={() => void op.executar(ids, "excluir", revisoesDe(alvos)).then(ok => { if (ok) onFeito(); })}>{op.ocupado ? "Excluindo…" : `Excluir ${ids.length}`}</button></>}>
    {!lista && !falhaDeLeitura && <p role="status">Carregando personagens…</p>}
    {falhaDeLeitura && <p role="alert">{falhaDeLeitura}</p>}
    {lista && !completos && <p role="alert">A lista mudou. Feche esta janela e selecione de novo.</p>}
    {completos && <>
      <p>Excluir definitivamente {alvos.length === 1 ? "este personagem" : `estes ${alvos.length} personagens`}? Fichas (sem cópia de recuperação), registros no Compêndio e vínculos são apagados. Ficam só os documentos e históricos. Se um falhar, nenhum é excluído.</p>
      <ul className="ciclo-alvos" aria-label="Personagens a excluir">{alvos.map(p => <li key={p.id}>{p.nome} <small className="muted">{ROTULO_SITUACAO[p.situacao]}</small></li>)}</ul>
      <label>Digite EXCLUIR para confirmar<input value={texto} autoComplete="off" disabled={op.ocupado} onChange={e => setTexto(e.target.value)}/></label>
    </>}
    {op.erro && <p role="alert">{op.erro}</p>}
  </Modal>;
}

function Oferta({ oferta, onFechar, onFeito }: { oferta: OfertaPersonagem; onFechar: () => void; onFeito: () => void }) {
  const fichas = useFichas(), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
  const responder = async (aceitar: boolean) => {
    if (!fichas?.ciclo || ocupado) return;
    setOcupado(true); setErro("");
    try { const r = await fichas.ciclo.responder(oferta.id, aceitar); if (r.ok) onFeito(); else setErro(r.error); }
    catch { setErro("Não foi possível responder. Confira sua conexão e tente novamente."); }
    finally { setOcupado(false); }
  };
  return <Modal titulo="Transferência de personagem" onFechar={onFechar} ocupado={ocupado} acoes={<>
    <button type="button" className="btn-secondary" disabled={ocupado} onClick={() => void responder(false)}>Recusar</button>
    <button type="button" className="btn-primary" disabled={ocupado} onClick={() => void responder(true)}>Aceitar personagem</button></>}>
    <p>O mestre quer transferir <strong>{oferta.title}</strong> para você.</p>
    <p className="muted">Ao aceitar, você passa a controlar a ficha, com inventário e progresso. Fechar esta janela deixa o pedido pendente.</p>
    {erro && <p role="alert">{erro}</p>}
  </Modal>;
}
