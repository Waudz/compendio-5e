// Aba "Inventário", na ordem aprovada: moedas, carga e sintonização juntas; itens em cartões (imagem quadrada, números de jogo à vista,
// ação principal discreta e reticências) ou em lista; histórico recolhido. Armas equipadas geram ataques em Habilidades e armaduras e
// escudos entram na CA pelo motor 2014: nada aqui soma bônus por conta própria. O que o jogador pode adicionar segue
// `catalogue/disponibilidade` (o banco aplica a mesma lista).
import { ScanSearch, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Backpack, Check, ChevronDown, Dices, FlaskConical, Hash, History, Info, LayoutGrid, Link2, List, Plus, RefreshCw, Shield, ShieldCheck, ShieldOff, Sparkles, Swords, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { itemDaCampanha, itensDaCampanha, useVersaoCatalogo } from "../catalogue/campanha";
import { normalizar } from "../catalogue/nucleo/busca";
import { avisarConhecimento, useCodexApi } from "../compendio/conhecimento";
import { avisarRegistros } from "../registrosStore";
import { jogadorPodeAdicionar } from "../catalogue/disponibilidade";
import { raridadeRotulo, srdItem } from "../catalogue/srd-2014-items";
import { searchCompendium } from "../rules/compendium-query";
import { addInventoryInstance, changeInventoryInstanceQuantity, type InventoryEntry } from "../rules/character-domain";
import { criadorRules } from "../criador/catalogo-criador";
import { CartaoMoedas } from "../moedas/CartaoMoedas";
import { TODAS_AS_MOEDAS, type ChaveMoeda } from "../moedas/moedas";
import { MenuDeAcoes, type AcaoDeMenu } from "../ui/MenuDeAcoes";
import { DetalhesItem, ExcluirItem, kg, nomeDaInstancia as nome, podeUsar, QuantidadeItem, RecuperarCargas, temCargas, TransferirItem, TransferirMoedas, UsarItem } from "./DialogosItem";
import { dadosDaArma } from "./regrasFicha";
import { capacidadeDeCarga, categoriaDoItem, definirMoeda, pesoCarregado, podeEquipar, registrarMovimento } from "./estadoJogo";
import { imagemDoItem } from "./imagensCatalogo";
import { infoDoItem } from "./infoItem";
import { novoId, type PropsAba } from "./tipos";

export type FiltroInv = "todos" | "armas" | "protecao" | "consumiveis" | "outros" | "magicos";
export type VistaInv = "lista" | "grade";
const FILTROS: [FiltroInv, string][] = [["todos", "Todos"], ["armas", "Armas"], ["protecao", "Armaduras"], ["consumiveis", "Consumíveis"], ["outros", "Equipamentos"], ["magicos", "Mágicos"]];
/** Limite padrão do SRD 5.1. Um limite por personagem depende de operação no banco (pendente). */
export const LIMITE_SINTONIA = 3;
const magico = (id: string) => { const r = srdItem(id)?.raridade; return !!r && r !== "mundano"; };

type Props = PropsAba & {
  vista: VistaInv; onVista: (v: VistaInv) => void; filtro: FiltroInv; onFiltro: (f: FiltroInv) => void;
  /** Moedas em uso na campanha; `null` enquanto a configuração carrega (nada de mostrar moedas que a mesa não usa). */
  moedas?: readonly ChaveMoeda[] | null; /** O mestre pode entregar qualquer item. */ mestre?: boolean;
  usarItem: (instancia: string, cura: number) => Promise<string | null>;
  transferir?: (destino: string, instancia: string, quantidade: number) => Promise<string | null>;
  personagemId?: string; campaignId?: string;
};
type Janela = { tipo: "detalhes" | "usar" | "transferir" | "quantidade" | "excluir" | "cargas"; item: InventoryEntry } | null;

export function AbaInventario({ draft, sheet, stats, estado, onChange, onOpenContent, vista, onVista, filtro: filtroGuardado, onFiltro, moedas = TODAS_AS_MOEDAS, mestre = false, usarItem, transferir, personagemId, campaignId }: Props) {
  const [texto, setTexto] = useState(""), [novo, setNovo] = useState(""), [adicionando, setAdicionando] = useState(false), [janela, setJanela] = useState<Janela>(null), [moedasAbertas, setMoedasAbertas] = useState(false);
  const filtro: FiltroInv = FILTROS.some(([v]) => v === filtroGuardado) ? filtroGuardado : "todos";   // preferência antiga não vale mais
  const codex = useCodexApi(), [falha, setFalha] = useState("");
  useVersaoCatalogo();
  const peso = pesoCarregado(draft), capacidade = capacidadeDeCarga(sheet.abilities.str);
  const termo = texto.trim().toLocaleLowerCase("pt-BR");
  const itens = sheet.inventory.filter(i => (!termo || nome(i).toLocaleLowerCase("pt-BR").includes(termo)) && (filtro === "todos" || (filtro === "magicos" ? magico(i.itemId) : categoriaDoItem(i.itemId) === filtro)));
  const comSintonia = sheet.inventory.filter(i => srdItem(i.itemId)?.sintonia);
  const permitido = (id: string) => mestre || jogadorPodeAdicionar(id);
  // A pesquisa soma as definições da campanha: substituições com o nome da mesa e criações (que só o mestre adiciona).
  const termoNovo = normalizar(novo);
  const daMesa = itensDaCampanha().filter(x => !x.mascara);
  const sugestoes = termoNovo.length >= 2 ? [
    ...daMesa.filter(x => permitido(x.item.id) && normalizar(x.item.nome).includes(termoNovo)).map(x => ({ id: x.item.id, nome: x.item.nome })),
    ...searchCompendium(criadorRules, { kind: "item", text: novo }).filter(l => permitido(l.ref.id) && !daMesa.some(x => x.item.id === l.ref.id)).map(l => ({ id: l.ref.id, nome: l.name })),
  ].slice(0, 12) : [];
  const identificar = (i: InventoryEntry) => {
    if (!codex?.identifyItem || !campaignId || !window.confirm(`Identificar "${nome(i)}"? Os personagens com este item passarão a ver o nome e as propriedades verdadeiros.`)) return;
    setFalha("");
    codex.identifyItem(campaignId, i.itemId).then(() => { avisarConhecimento(); avisarRegistros(); }, e => setFalha(e instanceof Error ? e.message : "Não foi possível identificar o item."));
  };
  // Item que ainda não chegou na sobreposição (recebido agora): busca de novo uma vez.
  const semDefinicao = sheet.inventory.filter(i => !srdItem(i.itemId)).map(i => i.itemId).join();
  useEffect(() => { if (semDefinicao) avisarConhecimento(); }, [semDefinicao]);

  const definirQuantidade = (i: InventoryEntry, n: number) => onChange(registrarMovimento(changeInventoryInstanceQuantity(draft, i.id, n - i.quantity), `${nome(i)}: quantidade de ${i.quantity} para ${n}`));
  const excluir = (i: InventoryEntry) => onChange(registrarMovimento(changeInventoryInstanceQuantity(draft, i.id, -i.quantity), `Removido: ${i.quantity > 1 ? `${i.quantity}× ` : ""}${nome(i)}`));
  const equipar = (i: InventoryEntry, equipped: boolean) => onChange(registrarMovimento({ ...draft, inventory: draft.inventory.map(x => (x.id === i.id ? { ...x, equipped } : x)) }, `${equipped ? "Equipado" : "Desequipado"}: ${nome(i)}`));
  const adicionar = (itemId: string, rotulo: string) => { if (!permitido(itemId)) return; onChange(registrarMovimento(addInventoryInstance(draft, { id: novoId(), itemId, quantity: 1, equipped: false, origin: "acquired" }), `Adicionado: ${rotulo}`)); setNovo(""); };

  const acoes = (i: InventoryEntry): AcaoDeMenu[] => [
    { rotulo: "Ver detalhes", icone: Info, acao: () => setJanela({ tipo: "detalhes", item: i }) },
    ...(mestre && itemDaCampanha(i.itemId)?.identificaComo ? [{ rotulo: "Identificar item", icone: ScanSearch, acao: () => identificar(i) }] : []),
    ...(podeEquipar(i.itemId) ? [{ rotulo: i.equipped ? "Desequipar" : "Equipar", icone: i.equipped ? ShieldOff : ShieldCheck, acao: () => equipar(i, !i.equipped) }] : []),
    ...(podeUsar(i.itemId) ? [{ rotulo: "Usar", icone: Sparkles, acao: () => setJanela({ tipo: "usar", item: i }) }] : []),
    ...(temCargas(i.itemId) ? [{ rotulo: "Recuperar cargas", icone: RefreshCw, acao: () => setJanela({ tipo: "cargas", item: i }) }] : []),
    ...(srdItem(i.itemId)?.sintonia ? [{ rotulo: "Sintonizar", icone: Link2, acao: () => {}, desabilitada: true, motivo: "Sintonização ainda indisponível" }] : []),
    { rotulo: "Transferir", icone: ArrowLeftRight, acao: () => setJanela({ tipo: "transferir", item: i }), desabilitada: !transferir, motivo: "Disponível para personagens salvos na campanha" },
    { rotulo: "Alterar quantidade", icone: Hash, acao: () => setJanela({ tipo: "quantidade", item: i }) },
    { rotulo: "Excluir", icone: Trash2, perigo: true, acao: () => setJanela({ tipo: "excluir", item: i }) },
  ];
  // o item da janela é sempre o atual (a quantidade pode ter mudado enquanto ela estava aberta)
  const doDialogo = janela ? sheet.inventory.find(i => i.id === janela.item.id) ?? janela.item : null;

  return <div className="ficha-pilha">
    {falha && <p role="alert" className="notice err">{falha}</p>}
    <section className="ficha-bloco ficha-moedas-carga" aria-label="Moedas e carga">
      <div className="ficha-moedas-area" role="region" aria-label="Moedas">
        <div className="ficha-titulo"><h2>Moedas</h2>
          <button type="button" className="ficha-acao-discreta" aria-label="Transferir moedas" title="Transferir moedas" disabled={!moedas} onClick={() => setMoedasAbertas(true)}><ArrowLeftRight size={15} aria-hidden="true"/></button></div>
        {moedas ? <CartaoMoedas carteira={draft.currency} ativas={moedas} onDefinir={(chave, n) => onChange(definirMoeda(draft, chave, n))}/> : <p className="muted" role="status">Carregando as moedas da campanha…</p>}
      </div>
      <div className="ficha-carga" role="region" aria-label="Carga">
        <p><span className="ficha-carga-rotulo">Carga</span> <strong data-testid="carga">{kg(peso)} de {kg(capacidade)}</strong></p>
        <div className="ficha-barra" role="meter" aria-label="Carga" aria-valuemin={0} aria-valuemax={capacidade} aria-valuenow={Math.min(peso, capacidade)}><span style={{ width: `${Math.min(100, capacidade ? (peso / capacidade) * 100 : 0)}%` }} className={peso > capacidade ? "excesso" : ""}/></div>
        {peso > capacidade && <p role="note" className="notice err">Carga acima da capacidade.</p>}
        {stats.ambiguousArmor && <p role="note" className="notice err">Há mais de uma armadura equipada; revise o equipamento.</p>}
        {stats.armorWithoutProficiency && <p role="note" className="notice err">Há armadura equipada sem proficiência.</p>}
      </div>
      {comSintonia.length > 0 && <details className="ficha-recolhivel ficha-sintonia">
        <summary><Link2 size={14} aria-hidden="true"/> <span>Sintonização</span> <span className="ficha-sintonia-contador"><span aria-hidden="true">{Array.from({ length: LIMITE_SINTONIA }, (_, i) => <span key={i} className="ficha-ponto"/>)}</span> 0/{LIMITE_SINTONIA}</span> <ChevronDown size={14} aria-hidden="true"/></summary>
        <p className="muted">Sintonizar ainda não está disponível. Nenhum item está sintonizado, e os benefícios que exigem sintonização continuam a ser aplicados na mesa.</p>
        <ul className="ficha-linhas">{comSintonia.map(i => <li key={i.id}><span>{nome(i)}</span><small className="muted">requer sintonização</small></li>)}</ul>
      </details>}
    </section>

    <section className="ficha-bloco" aria-label="Inventário do personagem">
      <div className="ficha-titulo"><h2>Inventário</h2>
        <div className="ficha-barra-itens">
          <button type="button" className="ficha-botao" aria-label={adicionando ? "Fechar adição" : "Adicionar item"} aria-expanded={adicionando} onClick={() => { setAdicionando(a => !a); setNovo(""); }}>{adicionando ? <><X size={13} aria-hidden="true"/> Fechar adição</> : <><Plus size={13} aria-hidden="true"/> Adicionar</>}</button>
          <span className="ficha-vistas" role="group" aria-label="Exibição do inventário">
            <button type="button" className={"ficha-botao" + (vista === "lista" ? " ativo" : "")} aria-pressed={vista === "lista"} aria-label="Ver em lista" onClick={() => onVista("lista")}><List size={14} aria-hidden="true"/></button>
            <button type="button" className={"ficha-botao" + (vista === "grade" ? " ativo" : "")} aria-pressed={vista === "grade"} aria-label="Ver em grade" onClick={() => onVista("grade")}><LayoutGrid size={14} aria-hidden="true"/></button>
          </span>
        </div></div>
      {adicionando && <div className="ficha-adicionar">
        <label>Adicionar item do catálogo<input type="search" autoFocus={!window.matchMedia("(max-width:700px)").matches} aria-label="Adicionar item do catálogo" placeholder="Digite ao menos 2 letras" value={novo} onChange={e => setNovo(e.target.value)}/></label>
        <p className="muted">{mestre ? "Como mestre, você pode entregar qualquer item do catálogo." : "Você adiciona itens comuns e as poções comuns. Itens mágicos e raros são entregues pelo mestre."}</p>
        {novo.trim().length >= 2 && <ul className="ficha-linhas" aria-label="Resultados da pesquisa de itens">
          {sugestoes.length === 0 && <li className="muted">Nenhum item disponível com esse nome.</li>}
          {sugestoes.map(l => <li key={l.id}><span>{l.nome} <small className="muted">{infoDoItem(l.id)[0]}</small></span><button type="button" className="btn-secondary" aria-label={`Adicionar ${l.nome}`} onClick={() => adicionar(l.id, l.nome)}><Plus size={14} aria-hidden="true"/> Adicionar</button></li>)}
        </ul>}
      </div>}
      <input type="search" className="ficha-busca" aria-label="Buscar no inventário" placeholder="Buscar no inventário..." value={texto} onChange={e => setTexto(e.target.value)}/>
      <div className="ficha-filtro-acao" role="group" aria-label="Filtrar inventário">{FILTROS.map(([v, r]) => <button key={v} type="button" className={filtro === v ? "ativo" : ""} aria-pressed={filtro === v} onClick={() => onFiltro(v)}>{r}</button>)}</div>
      {sheet.inventory.length === 0 ? <p className="muted">Inventário vazio.</p> : itens.length === 0 ? <p className="muted" role="status">Nenhum item com esse filtro.</p> :
        <ul className={"ficha-itens " + vista}>{itens.map(i => {
          const def = srdItem(i.itemId), efeito = efeitoPrincipal(i.itemId);
          return <li key={i.id} className={"item-cartao" + (i.equipped ? " equipado" : "")} aria-label={nome(i)}>
            {/* imagem e nome abrem os detalhes; os números ficam fora do botão */}
            <button type="button" className="item-abrir" aria-label={`Detalhes de ${nome(i)}`} onClick={() => setJanela({ tipo: "detalhes", item: i })}>
              <ImagemItem itemId={i.itemId}/>
              <span className="item-nome">{nome(i)}</span>
            </button>
            <div className="item-dados">
              {efeito && <p className="item-efeito">{efeito}{dadosDaArma(i.itemId)?.duasMaos && <span className="item-duas-maos"> ({dadosDaArma(i.itemId)!.duasMaos} com duas mãos)</span>}</p>}
              <p>{[magico(i.itemId) && def ? capitalizar(raridadeRotulo(def.raridade)) : null, def?.peso != null ? `${kg(def.peso)}${i.quantity > 1 ? "/un." : ""}` : "Peso não especificado"].filter(Boolean).join(" · ")} · <span className="item-quantidade" aria-label={`Quantidade: ${i.quantity}`}>×{i.quantity}</span></p>
            </div>
            <div className="item-rodape">
              <AcaoPrincipal item={i} nome={nome(i)} onEquipar={() => equipar(i, !i.equipped)} onUsar={() => setJanela({ tipo: "usar", item: i })}/>
              <span className="item-menu"><MenuDeAcoes titulo={nome(i)} rotulo={`Ações de ${nome(i)}`} acoes={acoes(i)}/></span>
            </div>
          </li>;
        })}</ul>}
    </section>

    {estado.historico.length > 0 && <section className="ficha-bloco" aria-label="Histórico de movimentações">
      <details className="ficha-recolhivel"><summary><History size={14} aria-hidden="true"/> <span>Histórico de movimentações ({estado.historico.length})</span> <ChevronDown size={14} aria-hidden="true"/></summary>
        <ol className="ficha-historico">{estado.historico.map((m, i) => { const texto = m.itemId ? m.texto.replace("{item}", srdItem(m.itemId)?.nome ?? "item") : m.texto, Icone = iconeDoMovimento(texto);
          return <li key={m.em + i}><span className="ficha-historico-icone" aria-hidden="true"><Icone size={14}/></span><span>{texto}</span><time dateTime={m.em || undefined} title={m.em ? new Date(m.em).toLocaleString("pt-BR") : undefined}>{quando(m.em)}</time></li>; })}</ol></details>
    </section>}

    {moedasAbertas && moedas && <TransferirMoedas carteira={draft.currency} ativas={moedas} campaignId={campaignId} personagemId={personagemId} onFechar={() => setMoedasAbertas(false)}/>}
    {janela && doDialogo && <>
      {janela.tipo === "cargas" && <RecuperarCargas item={doDialogo} onFechar={() => setJanela(null)}/>}
      {janela.tipo === "detalhes" && <DetalhesItem item={doDialogo} draft={draft} onOpenContent={onOpenContent} onFechar={() => setJanela(null)}/>}
      {janela.tipo === "usar" && <UsarItem item={doDialogo} nomeProprio={draft.name.trim() || "este personagem"} campaignId={campaignId} personagemId={personagemId} vida={draft.currentHp} maximo={sheet.maxHp} onUsar={cura => usarItem(doDialogo.id, cura)} onFechar={() => setJanela(null)}/>}
      {janela.tipo === "transferir" && transferir && <TransferirItem item={doDialogo} campaignId={campaignId} personagemId={personagemId} onTransferir={(destino, q) => transferir(destino, doDialogo.id, q)} onFechar={() => setJanela(null)}/>}
      {janela.tipo === "quantidade" && <QuantidadeItem item={doDialogo} podeAumentar={permitido(doDialogo.itemId)} onDefinir={n => definirQuantidade(doDialogo, n)} onFechar={() => setJanela(null)}/>}
      {janela.tipo === "excluir" && <ExcluirItem item={doDialogo} restrito={!mestre && !jogadorPodeAdicionar(doDialogo.itemId)} onExcluir={() => excluir(doDialogo)} onFechar={() => setJanela(null)}/>}
    </>}
  </div>;
}

/** O número que importa na mesa, só com o que o catálogo informa. */
function efeitoPrincipal(id: string): string | null {
  const d = srdItem(id); if (!d) return null;
  const arma = dadosDaArma(id);
  if (arma) return `${arma.dado}${arma.tipo ? ` ${arma.tipo}` : ""}`;
  if (d.armadura) return d.armadura.categoria === "shield" ? `+${d.armadura.ca} CA` : `CA ${d.armadura.ca}${d.armadura.somaDes ? ` + Des${d.armadura.maxDes != null ? ` (máx. ${d.armadura.maxDes})` : ""}` : ""}`;
  if (d.cura) return `${d.cura} PV`;
  if (d.sintonia) return "Requer sintonização";
  return null;
}
const capitalizar = (t: string) => t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1);

/** A ação do dia a dia de cada item, discreta no rodapé do cartão. */
function AcaoPrincipal({ item, nome, onEquipar, onUsar }: { item: InventoryEntry; nome: string; onEquipar: () => void; onUsar: () => void }) {
  if (podeEquipar(item.itemId)) return <button type="button" className={"item-acao" + (item.equipped ? " ativa" : "")} aria-pressed={item.equipped} aria-label={item.equipped ? `Equipado: ${nome}` : `Equipar ${nome}`} onClick={onEquipar}>{item.equipped ? <><Check size={13} aria-hidden="true"/> Equipado</> : "Equipar"}</button>;
  if (podeUsar(item.itemId)) return <button type="button" className="item-acao" aria-label={`Usar ${nome}`} onClick={onUsar}>Usar</button>;
  if (srdItem(item.itemId)?.sintonia) return <button type="button" className="item-acao" disabled title="Sintonização ainda indisponível" aria-label={`Sintonizar ${nome} (indisponível)`}>Sintonizar</button>;
  return <span/>;
}

const iconeDoMovimento = (t: string) => (/^(Recebeu|Adicionado|\+)/.test(t) ? ArrowDownLeft : /^(Enviou|Removido)/.test(t) ? ArrowUpRight : /^Usou/.test(t) ? FlaskConical : /descanso/i.test(t) ? RefreshCw : /equipado/i.test(t) ? ShieldCheck : Dices);
/** Hora para hoje; data e hora para os outros dias. */
function quando(em: string): string {
  const d = new Date(em); if (!em || Number.isNaN(d.getTime())) return "";
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? hora : `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}

/** Imagem cadastrada do item; sem imagem (ou se ela não carregar), o ícone da categoria. */
function ImagemItem({ itemId }: { itemId: string }) {
  const [falhou, setFalhou] = useState(false), url = imagemDoItem(itemId), cat = categoriaDoItem(itemId);
  const Icone = cat === "armas" ? Swords : cat === "protecao" ? Shield : cat === "consumiveis" ? FlaskConical : Backpack;
  return <span className="item-imagem">{url && !falhou ? <img src={url} alt="" loading="lazy" onError={() => setFalhou(true)}/> : <Icone aria-hidden="true"/>}</span>;
}
