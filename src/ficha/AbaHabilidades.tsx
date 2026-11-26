// Aba "Habilidades", na ordem aprovada: favoritos, ataques, recursos de classe, conjuração, truques, magias por círculo e habilidades
// por origem, em linhas compactas que expandem. Categorias vazias não aparecem. Favorito é a MESMA habilidade (mesmo estado e usos).
import { ChevronDown, Gift, Plus, Search, Star } from "lucide-react";
import { useState, type ReactNode } from "react";
import { srdItem } from "../catalogue/srd-2014-items";
import { resourceLabel2014, spells2014 } from "../criador/regras-2014";
import { rotuloAtributo } from "../criador/rotulos";
import { ATRIBUTOS_CONJ, comEstado, concedidosAtivos, MAX_CONCEDIDOS, recargaDe, somaTemporaria, usarRecurso, type Concedido, type TipoConcedido } from "./estadoJogo";
import { Marcadores } from "./Marcadores";
import { caracteristicasDaFicha, dadosDaArma, dadosDaMagia, formulaDano, magiasDaFicha, acaoDaMagia, ROTULO_ACAO, type Caracteristica, type MagiaDaFicha, type OrigemCaracteristica, type TipoAcao } from "./regrasFicha";
import { novoId, sinal, type PropsAba } from "./tipos";

export type FiltroHab = "todas" | TipoAcao;
const FILTROS_HAB: [FiltroHab, string][] = [["todas", "Todas"], ["acao", ROTULO_ACAO.acao], ["bonus", ROTULO_ACAO.bonus], ["reacao", ROTULO_ACAO.reacao], ["passiva", ROTULO_ACAO.passiva], ["especial", ROTULO_ACAO.especial]];
/** Categorias das características, na ordem em que aparecem. */
const CATEGORIAS: { id: string; titulo: string; origens: OrigemCaracteristica[] }[] = [
  { id: "classe", titulo: "Habilidades de classe e subclasse", origens: ["Classe", "Subclasse"] },
  { id: "raca", titulo: "Habilidades raciais", origens: ["Raça"] },
  { id: "origem", titulo: "Habilidades de origem", origens: ["Origem"] },
  { id: "talentos", titulo: "Talentos", origens: ["Talento"] },
];

export type PropsHabilidades = PropsAba & { /** Só o mestre entrega talentos, magias e habilidades. */ podeConceder?: boolean; filtro?: FiltroHab; onFiltro?: (f: FiltroHab) => void };

export function AbaHabilidades({ draft, sheet, stats, estado, onChange, onOpenContent, podeConceder = false, filtro: filtroDeFora, onFiltro }: PropsHabilidades) {
  const [filtroLocal, setFiltroLocal] = useState<FiltroHab>("todas");
  const [busca, setBusca] = useState(""), [buscando, setBuscando] = useState(false);
  const escolhido = filtroDeFora ?? filtroLocal, filtro: FiltroHab = FILTROS_HAB.some(([v]) => v === escolhido) ? escolhido : "todas", escolherFiltro = onFiltro ?? setFiltroLocal;
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const semFiltro = filtro === "todas" && !termo;
  const concedidos = concedidosAtivos(draft, estado);
  const todasAsMagias = magiasDaFicha(draft, sheet, concedidos);
  const todas = caracteristicasDaFicha(draft, sheet, concedidos);
  const espacos = Object.entries(sheet.resources).filter(([id]) => id.startsWith("spell-slot-")).sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const recursos = Object.keys(sheet.resources).filter(id => id !== "hit-dice" && !id.startsWith("spell-slot-"));
  const ataqueTemp = somaTemporaria(estado, "attacks");
  const fontes = [...new Map(todasAsMagias.flatMap(m => (m.fonte && m.cdFixa == null && !m.concedida ? [[m.fonte.chave, m.fonte] as const] : []))).values()];
  if (stats.spellDc != null && !fontes.some(f => f.chave === "classe")) {
    const atributo = ATRIBUTOS_CONJ.find(a => 8 + stats.prof + Math.floor((sheet.abilities[a] - 10) / 2) === stats.spellDc) ?? "int";
    fontes.unshift({ chave: "classe", rotulo: "Classe", atributo, cd: stats.spellDc, ataque: stats.spellAttack ?? 0 });
  }
  const usos = (id: string) => { const r = sheet.resources[id]; return <Marcadores rotulo={resourceLabel2014(id)} maximo={r.maximum} disponiveis={r.remaining}
    onUsar={d => onChange(usarRecurso(draft, sheet, id, d))}/>; };
  const remover = (id: string) => onChange(comEstado(draft, { concedidos: estado.concedidos.filter(c => c.id !== id) }));

  // ------------------------------------------------------------ linhas: a MESMA função desenha na categoria e nos favoritos
  const favorito = (chave: string, nome: string) => { const marcado = estado.favoritos.includes(chave); return <button type="button" className={"ficha-favorito" + (marcado ? " marcado" : "")} aria-pressed={marcado} aria-label={`Favoritar ${nome}`} title={marcado ? "Retirar dos favoritos" : "Marcar como favorito"}
    onClick={() => onChange(comEstado(draft, { favoritos: marcado ? estado.favoritos.filter(x => x !== chave) : [...estado.favoritos, chave] }))}><Star size={15} aria-hidden="true" fill={marcado ? "currentColor" : "none"}/></button>; };
  type Entrada = { chave: string; nome: string; acao: TipoAcao | null; cartao: ReactNode };
  const ataques: Entrada[] = [
    ...stats.attacks.map((a, i): Entrada => { const arma = dadosDaArma(a.id), dano = `${formulaDano(a.damage, a.damageBonus)}${arma?.tipo ? ` ${arma.tipo}` : ""}`; return { chave: `ataque:${a.id}`, nome: a.name, acao: "acao", cartao: <Linha key={a.id + i} rotulo={`Ataque: ${a.name}`} titulo={a.name} resumo={`${sinal(a.bonus + ataqueTemp)} para atingir · ${dano}`} acao="acao" favorito={favorito(`ataque:${a.id}`, a.name)}>
      <ul className="ficha-valores"><li>Ataque {sinal(a.bonus + ataqueTemp)}</li><li>Dano {dano}</li>{arma?.duasMaos && <li>{formulaDano(arma.duasMaos, a.damageBonus)} com duas mãos</li>}{arma?.alcance && <li>Alcance {arma.alcance}</li>}</ul>
      {arma && arma.propriedades.length > 0 && <p className="muted">{arma.propriedades.join(", ")}</p>}
      {!a.proficient && <p className="muted">Sem proficiência com esta arma.</p>}
      {a.heavyDisadvantage && <p className="muted">Arma pesada: desvantagem para tamanho Pequeno.</p>}
    </Linha> }; }),
    ...estado.ataques.map((a): Entrada => ({ chave: `ataque:${a.id}`, nome: a.nome, acao: "acao", cartao: <Linha key={a.id} rotulo={`Ataque: ${a.nome}`} titulo={a.nome} resumo={[a.bonus && `${a.bonus} para atingir`, a.dano].filter(Boolean).join(" · ") || "Ataque personalizado"} acao="acao" favorito={favorito(`ataque:${a.id}`, a.nome)}
      rodape={<button type="button" className="ficha-link ficha-abrir" aria-label={`Remover ataque ${a.nome}`} onClick={() => onChange(comEstado(draft, { ataques: estado.ataques.filter(x => x.id !== a.id) }))}>Remover ataque</button>}>
      <ul className="ficha-valores">{a.bonus && <li>Ataque {a.bonus}</li>}{a.dano && <li>Dano {a.dano}</li>}</ul>
      {a.notas && <p className="muted">{a.notas}</p>}
    </Linha> })),
  ];
  const magia = (m: MagiaDaFicha): Entrada => ({ chave: `magia:${m.chave}`, nome: m.magia.name, acao: acaoDaMagia(dadosDaMagia(m.magia).tempo), cartao: <LinhaMagia key={m.chave} item={m} ataqueTemp={ataqueTemp} favorito={favorito(`magia:${m.chave}`, m.magia.name)} onAbrir={() => onOpenContent({ kind: "magia", ref: m.magia.id, title: m.magia.name })} onRemover={podeConceder && m.concedida ? () => remover(m.chave) : undefined}/> });
  const caracteristica = (c: Caracteristica): Entrada => ({ chave: `carac:${c.chave}`, nome: c.nome, acao: c.acao, cartao: <LinhaCaracteristica key={c.chave} item={c} usos={usos} favorito={favorito(`carac:${c.chave}`, c.nome)} onRemover={podeConceder && estado.concedidos.some(x => x.id === c.chave) ? () => remover(c.chave) : undefined}/> });

  const magiasProprias = todasAsMagias.filter(m => !m.concedida), magiasConcedidas = todasAsMagias.filter(m => m.concedida);
  const cartoesDe = (origens: OrigemCaracteristica[]) => todas.filter(c => origens.includes(c.origem)).map(caracteristica);
  const concedidas = [...cartoesDe(["Concedida"]), ...magiasConcedidas.map(magia)];
  const favoritos = [...ataques, ...todasAsMagias.map(magia), ...todas.map(caracteristica)].filter(e => estado.favoritos.includes(e.chave));
  const visiveis = (l: Entrada[]) => l.filter(e => (filtro === "todas" || e.acao === filtro) && (!termo || e.nome.toLocaleLowerCase("pt-BR").includes(termo)));
  const linhas = (l: Entrada[]) => <ul className="hab-lista">{l.map(e => e.cartao)}</ul>;

  const ataquesVisiveis = visiveis(ataques), magiasVisiveis = visiveis(magiasProprias.map(magia));
  const circulos = [...new Set(magiasProprias.map(m => m.magia.level))];
  const doCirculo = (n: number) => visiveis(magiasProprias.filter(m => m.magia.level === n).map(magia));
  const categorias = CATEGORIAS.map(c => ({ ...c, cartoes: visiveis(cartoesDe(c.origens)) }));
  const concedidasVisiveis = visiveis(concedidas);
  const temConjuracao = semFiltro && (fontes.length > 0 || espacos.length > 0);
  const nada = !semFiltro && ataquesVisiveis.length + magiasVisiveis.length + concedidasVisiveis.length + categorias.reduce((s, c) => s + c.cartoes.length, 0) === 0;
  const secao = (id: string, titulo: string, l: Entrada[]) => l.length > 0 && <section key={id} className="ficha-bloco" aria-label={titulo}><h2>{titulo}</h2>{linhas(l)}</section>;

  return <div className="ficha-pilha">
    <div className="hab-topo-aba"><h2>Habilidades</h2>
      <button type="button" className="ficha-acao-discreta" aria-label="Pesquisar habilidades" aria-expanded={buscando} onClick={() => { setBuscando(b => !b); setBusca(""); }}><Search size={15} aria-hidden="true"/></button></div>
    {buscando && <input type="search" className="ficha-busca" autoFocus aria-label="Pesquisar nas habilidades" placeholder="Nome da habilidade ou magia" value={busca} onChange={e => setBusca(e.target.value)}/>}
    <div className="ficha-filtro-acao" role="group" aria-label="Filtrar por tipo de ação">{FILTROS_HAB.map(([v, r]) => <button key={v} type="button" className={filtro === v ? "ativo" : ""} aria-pressed={filtro === v} onClick={() => escolherFiltro(v)}>{r}</button>)}</div>
    {nada && <p className="muted" role="status">Nada deste tipo nas regras cadastradas para este personagem.</p>}

    {favoritos.length > 0 && !termo && <section className="ficha-bloco ficha-favoritos" aria-label="Favoritos"><h2><Star size={14} aria-hidden="true"/> Favoritos</h2>{linhas(favoritos)}</section>}
    {ataquesVisiveis.length > 0 ? <section className="ficha-bloco" aria-label="Ataques">
      <h2>Ataques {ataqueTemp !== 0 && <small className="ficha-temp">{sinal(ataqueTemp)} temporário no ataque</small>}</h2>
      {linhas(ataquesVisiveis)}
      {semFiltro && <NovoAtaque draft={draft} estado={estado} onChange={onChange}/>}
    </section> : semFiltro && <NovoAtaque draft={draft} estado={estado} onChange={onChange}/>}

    {semFiltro && recursos.length > 0 && <section className="ficha-bloco" aria-label="Recursos de classe">
      <h2>Recursos de classe</h2>
      <ul className="hab-recursos">{recursos.map(id => <li key={id}><span><strong>{resourceLabel2014(id)}</strong><small>Volta no descanso {recargaDe(id, draft.classId, draft.level)}</small></span>{usos(id)}</li>)}</ul>
    </section>}

    {temConjuracao && <section className="ficha-bloco" aria-label="Conjuração">
      <h2>Conjuração</h2>
      {fontes.length > 0 && <ul className="ficha-fontes" aria-label="Atributo, CD e ataque">{fontes.map(f => <li key={f.chave}>{fontes.length > 1 && <span className="ficha-fonte-nome">{f.rotulo}</span>}
        <span><small>Atributo</small><strong title={rotuloAtributo(f.atributo)}>{rotuloAtributo(f.atributo).slice(0, 3).toLocaleUpperCase("pt-BR")}</strong></span><span><small>CD</small><strong>{f.cd}</strong></span><span><small>Ataque</small><strong>{sinal(f.ataque + ataqueTemp)}</strong></span></li>)}</ul>}
      {espacos.length > 0 && <ul className="hab-recursos" aria-label="Espaços de magia">{espacos.map(([id]) => <li key={id}><span><strong>{resourceLabel2014(id)}</strong></span>{usos(id)}</li>)}</ul>}
    </section>}

    {circulos.map(n => secao(`circulo-${n}`, n === 0 ? "Truques" : `Magias de ${n}º círculo`, doCirculo(n)))}
    {semFiltro && fontes.length > 0 && magiasProprias.length === 0 && <p className="muted">Nenhuma magia escolhida. Use Editar personagem para escolher.</p>}

    {categorias.map(c => secao(c.id, c.titulo, c.cartoes))}

    {(concedidasVisiveis.length > 0 || (semFiltro && podeConceder)) && <section className="ficha-bloco" aria-label="Habilidades e magias concedidas">
      <h2>Concedidas pelo mestre ou por equipamentos</h2>
      {concedidasVisiveis.length > 0 && linhas(concedidasVisiveis)}
      {semFiltro && podeConceder && <Conceder draft={draft} estado={estado} onChange={onChange}/>}
    </section>}
  </div>;
}

/** Linha compacta: estrela, nome e resumo do efeito, tipo de ação e expansão com os detalhes. */
function Linha({ rotulo, titulo, resumo, acao, favorito, selos = [], rodape, children }: { rotulo: string; titulo: string; resumo?: string; acao: TipoAcao | null; favorito: ReactNode; selos?: (string | null | undefined)[]; rodape?: ReactNode; children?: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return <li className="hab-linha" aria-label={rotulo}>
    <div className="hab-cabeca">{favorito}
      <button type="button" className="hab-abrir" aria-expanded={aberto} onClick={() => setAberto(a => !a)}>
        <span className="hab-texto"><span className="hab-nome">{titulo}</span>{resumo && <small>{resumo}</small>}</span>
        <span className="hab-acao">{acao ? ROTULO_ACAO[acao] : ""}</span><ChevronDown size={15} aria-hidden="true" className={aberto ? "virado" : ""}/>
      </button></div>
    <div className="hab-detalhe" hidden={!aberto}>
      {selos.some(Boolean) && <p className="ficha-cartao-selos">{selos.filter(Boolean).map(x => <span key={x} className="ficha-selo">{x}</span>)}</p>}
      {children}
      {rodape && <div className="ficha-cartao-rodape">{rodape}</div>}
    </div>
  </li>;
}

function LinhaCaracteristica({ item, usos, favorito, onRemover }: { item: Caracteristica; usos: (id: string) => ReactNode; favorito: ReactNode; onRemover?: () => void }) {
  return <Linha rotulo={item.nome} titulo={item.nome} favorito={favorito} acao={item.acao} resumo={item.valores[0] ?? item.resumo}
    selos={[`${item.origem}${item.detalheOrigem && item.origem !== "Raça" ? ` · ${item.detalheOrigem}` : ""}`]}
    rodape={onRemover && <button type="button" className="ficha-link ficha-abrir" aria-label={`Retirar ${item.nome}`} onClick={onRemover}>Retirar concessão</button>}>
    {item.recursos.map(id => <div key={id} className="ficha-recurso"><span>{resourceLabel2014(id)}</span>{usos(id)}</div>)}
    {item.valores.length > 0 && <ul className="ficha-valores">{item.valores.map(v => <li key={v}>{v}</li>)}</ul>}
    {(item.descricao || item.resumo) && <p className="ficha-texto">{item.descricao || item.resumo}</p>}
  </Linha>;
}

function LinhaMagia({ item, ataqueTemp, favorito, onAbrir, onRemover }: { item: MagiaDaFicha; ataqueTemp: number; favorito: ReactNode; onAbrir: () => void; onRemover?: () => void }) {
  const { magia, fonte, origem } = item, d = dadosDaMagia(magia), acao = acaoDaMagia(d.tempo);
  const cd = item.cdFixa ?? fonte?.cd, ataque = item.ataqueFixo ?? fonte?.ataque;
  const linha = [d.ataque && ataque != null && `${sinal(ataque + ataqueTemp)} para atingir`, d.salvaguarda && `Teste de resistência de ${d.salvaguarda}${cd != null ? ` · CD ${cd}` : ""}`, d.dano, d.cura].filter((x): x is string => !!x);
  return <Linha rotulo={magia.name} titulo={magia.name} favorito={favorito} acao={acao} resumo={linha.join(" · ") || [d.alcance && `Alcance: ${d.alcance}`, d.duracao && `Duração: ${d.duracao}`].filter(Boolean).join(" · ")}
    selos={[magia.level === 0 ? "Truque" : `${magia.level}º círculo`, `${origem}${magia.ritual ? " · ritual" : ""}`]}
    rodape={<><button type="button" className="ficha-link ficha-abrir" aria-label={`Abrir no Compêndio: ${magia.name}`} onClick={onAbrir}>Abrir no Compêndio</button>
      {onRemover && <button type="button" className="ficha-link ficha-abrir" aria-label={`Retirar ${magia.name}`} onClick={onRemover}>Retirar concessão</button>}</>}>
    <p className="muted">{[d.tempo, d.alcance && `Alcance: ${d.alcance}`, d.duracao && `Duração: ${d.duracao}`, d.consumo].filter(Boolean).join(" · ")}</p>
    <p className="ficha-texto">{magia.description.replace(/(\d)O\b/g, "$10")}</p>
  </Linha>;
}

function NovoAtaque({ draft, estado, onChange }: Pick<PropsAba, "draft" | "estado" | "onChange">) {
  const [aberto, setAberto] = useState(false), [nome, setNome] = useState(""), [bonus, setBonus] = useState(""), [dano, setDano] = useState(""), [notas, setNotas] = useState("");
  if (!aberto) return <button type="button" className="btn-secondary ficha-discreto" onClick={() => setAberto(true)} disabled={estado.ataques.length >= 20}><Plus size={14} aria-hidden="true"/> Ataque personalizado</button>;
  return <form className="ficha-campos" onSubmit={e => { e.preventDefault(); if (!nome.trim()) return; onChange(comEstado(draft, { ataques: [...estado.ataques, { id: novoId(), nome: nome.trim(), bonus: bonus.trim(), dano: dano.trim(), ...(notas.trim() ? { notas: notas.trim() } : {}) }] })); setNome(""); setBonus(""); setDano(""); setNotas(""); setAberto(false); }}>
    <label>Nome<input aria-label="Nome do ataque" maxLength={60} value={nome} onChange={e => setNome(e.target.value)}/></label>
    <label>Bônus<input aria-label="Bônus de ataque" placeholder="+5" maxLength={20} value={bonus} onChange={e => setBonus(e.target.value)}/></label>
    <label>Dano<input aria-label="Dano do ataque" placeholder="1d8+3 cortante" maxLength={60} value={dano} onChange={e => setDano(e.target.value)}/></label>
    <label>Observações<input aria-label="Observações do ataque" maxLength={200} value={notas} onChange={e => setNotas(e.target.value)}/></label>
    <div className="ficha-campo-largo row"><button type="submit" className="btn-primary" disabled={!nome.trim()}>Adicionar</button><button type="button" className="btn-secondary" onClick={() => setAberto(false)}>Cancelar</button></div>
  </form>;
}

/** Entrega do mestre: talento, magia do catálogo ou habilidade, opcionalmente presa a um item do inventário. */
function Conceder({ draft, estado, onChange }: Pick<PropsAba, "draft" | "estado" | "onChange">) {
  const vazio = { tipo: "habilidade" as TipoConcedido, nome: "", magia: "", origem: "", descricao: "", atributo: "", cd: "", salvaguarda: "", efeito: "", item: "" };
  const [aberto, setAberto] = useState(false), [f, setF] = useState(vazio);
  const muda = (p: Partial<typeof vazio>) => setF(a => ({ ...a, ...p }));
  const magia = f.tipo === "magia" ? spells2014.find(s => s.name.toLocaleLowerCase("pt-BR") === f.magia.trim().toLocaleLowerCase("pt-BR")) : undefined;
  const nome = magia?.name ?? f.nome.trim(), valido = f.tipo === "magia" ? !!magia : !!nome;
  const cheio = estado.concedidos.length >= MAX_CONCEDIDOS;
  if (!aberto) return <button type="button" className="btn-secondary ficha-discreto" disabled={cheio} onClick={() => setAberto(true)}><Gift size={14} aria-hidden="true"/> Conceder talento, magia ou habilidade</button>;
  const enviar = () => {
    if (!valido) return;
    const cd = Number(f.cd);
    const novo: Concedido = { id: novoId(), tipo: f.tipo, nome, origem: f.origem.trim() || "Mestre", ...(magia ? { ref: magia.id } : {}), ...(f.descricao.trim() ? { descricao: f.descricao.trim() } : {}),
      ...(f.atributo ? { atributo: f.atributo as Concedido["atributo"] } : {}), ...(f.cd && Number.isInteger(cd) && cd >= 1 && cd <= 40 ? { cd } : {}), ...(f.salvaguarda ? { salvaguarda: f.salvaguarda } : {}), ...(f.efeito.trim() ? { efeito: f.efeito.trim() } : {}), ...(f.item ? { itemInstancia: f.item } : {}) };
    onChange(comEstado(draft, { concedidos: [...estado.concedidos, novo] })); setF(vazio); setAberto(false);
  };
  return <section className="ficha-bloco" aria-label="Conceder ao personagem">
    <h2>Conceder ao personagem</h2>
    <form className="ficha-campos" onSubmit={e => { e.preventDefault(); enviar(); }}>
      <label>Tipo<select aria-label="Tipo do que será concedido" value={f.tipo} onChange={e => muda({ tipo: e.target.value as TipoConcedido })}><option value="habilidade">Habilidade</option><option value="talento">Talento</option><option value="magia">Magia</option></select></label>
      {f.tipo === "magia" ? <label>Magia do catálogo<input aria-label="Magia concedida" list="ficha-magias" value={f.magia} onChange={e => muda({ magia: e.target.value })}/><datalist id="ficha-magias">{spells2014.map(s => <option key={s.id} value={s.name}/>)}</datalist></label>
        : <label>Nome<input aria-label="Nome do que será concedido" maxLength={80} value={f.nome} onChange={e => muda({ nome: e.target.value })}/></label>}
      <label>Origem<input aria-label="Origem da concessão" placeholder="Mestre, item, bênção..." maxLength={80} value={f.origem} onChange={e => muda({ origem: e.target.value })}/></label>
      <label>Vinculada ao item<select aria-label="Item vinculado" value={f.item} onChange={e => muda({ item: e.target.value })}><option value="">Nenhum (permanente)</option>{draft.inventory.map(i => <option key={i.id} value={i.id}>{i.customName?.toString() || nomeDoItem(i.itemId)}</option>)}</select></label>
      {f.tipo === "magia" && <label>Atributo<select aria-label="Atributo da magia concedida" value={f.atributo} onChange={e => muda({ atributo: e.target.value })}><option value="">O da classe do personagem</option>{ATRIBUTOS_CONJ.map(a => <option key={a} value={a}>{rotuloAtributo(a)}</option>)}</select></label>}
      <label>CD própria (opcional)<input aria-label="CD própria" type="number" min={1} max={40} value={f.cd} onChange={e => muda({ cd: e.target.value })}/></label>
      {f.tipo !== "magia" && <><label>Teste de resistência exigido<select aria-label="Teste de resistência exigido" value={f.salvaguarda} onChange={e => muda({ salvaguarda: e.target.value })}><option value="">Nenhuma</option>{ATRIBUTOS_CONJ.map(a => <option key={a} value={rotuloAtributo(a)}>{rotuloAtributo(a)}</option>)}</select></label>
        <label>Dano, cura ou valor<input aria-label="Efeito numérico" maxLength={200} value={f.efeito} onChange={e => muda({ efeito: e.target.value })}/></label>
        <label className="ficha-campo-largo">Descrição<textarea aria-label="Descrição do que será concedido" maxLength={2000} rows={3} value={f.descricao} onChange={e => muda({ descricao: e.target.value })}/></label></>}
      <div className="ficha-campo-largo row"><button type="submit" className="btn-primary" disabled={!valido}>Conceder</button><button type="button" className="btn-secondary" onClick={() => setAberto(false)}>Cancelar</button></div>
    </form>
  </section>;
}
const nomeDoItem = (id: string) => srdItem(id)?.nome ?? id;
