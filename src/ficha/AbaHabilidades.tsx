// Aba "Habilidades": ataques, conjuração (com a CD de cada origem), características em cartões e recursos. Seções sem conteúdo não
// aparecem. Os valores vêm de `regrasFicha` (motor 2014 + catálogo); os usos são o mesmo estado em qualquer lugar em que aparecem.
import { BookOpen, Dna, Flame, Gift, Plus, Shield, Sparkles, Star, Swords } from "lucide-react";
import { useState, type ReactNode } from "react";
import { srdItem } from "../catalogue/srd-2014-items";
import { resourceLabel2014, spells2014 } from "../criador/regras-2014";
import { rotuloAtributo } from "../criador/rotulos";
import { ATRIBUTOS_CONJ, comEstado, concedidosAtivos, MAX_CONCEDIDOS, recargaDe, somaTemporaria, usarRecurso, type Concedido, type TipoConcedido } from "./estadoJogo";
import { Marcadores } from "./Marcadores";
import { caracteristicasDaFicha, dadosDaArma, dadosDaMagia, formulaDano, magiasDaFicha, acaoDaMagia, ROTULO_ACAO, type Caracteristica, type MagiaDaFicha, type OrigemCaracteristica, type TipoAcao } from "./regrasFicha";
import { novoId, sinal, type PropsAba } from "./tipos";

const ICONE: Record<OrigemCaracteristica, typeof Star> = { Classe: Swords, Subclasse: Shield, "Raça": Dna, Origem: BookOpen, Talento: Star, Concedida: Gift };

export type FiltroHab = "todas" | TipoAcao;
const FILTROS_HAB: [FiltroHab, string][] = [["todas", "Todas"], ["acao", ROTULO_ACAO.acao], ["bonus", ROTULO_ACAO.bonus], ["reacao", ROTULO_ACAO.reacao], ["passiva", ROTULO_ACAO.passiva]];
/** Categorias das características, na ordem em que aparecem. */
const CATEGORIAS: { id: string; titulo: string; origens: OrigemCaracteristica[] }[] = [
  { id: "classe", titulo: "Habilidades de classe e subclasse", origens: ["Classe", "Subclasse"] },
  { id: "raca", titulo: "Características raciais", origens: ["Raça"] },
  { id: "origem", titulo: "Características de origem", origens: ["Origem"] },
  { id: "talentos", titulo: "Talentos", origens: ["Talento"] },
];

export type PropsHabilidades = PropsAba & { /** Só o mestre entrega talentos, magias e habilidades. */ podeConceder?: boolean; filtro?: FiltroHab; onFiltro?: (f: FiltroHab) => void };

export function AbaHabilidades({ draft, sheet, stats, estado, onChange, onOpenContent, podeConceder = false, filtro: filtroDeFora, onFiltro }: PropsHabilidades) {
  const [filtroLocal, setFiltroLocal] = useState<FiltroHab>("todas");
  const escolhido = filtroDeFora ?? filtroLocal, filtro: FiltroHab = FILTROS_HAB.some(([v]) => v === escolhido) ? escolhido : "todas", escolherFiltro = onFiltro ?? setFiltroLocal;
  const passa = (acao: TipoAcao | null) => filtro === "todas" || acao === filtro;
  const semFiltro = filtro === "todas";
  const concedidos = concedidosAtivos(draft, estado);
  const todasAsMagias = magiasDaFicha(draft, sheet, concedidos);
  const todas = caracteristicasDaFicha(draft, sheet, concedidos);
  const espacos = Object.entries(sheet.resources).filter(([id]) => id.startsWith("spell-slot-")).sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const ligados = new Set(todas.flatMap(c => c.recursos));
  const soltos = Object.keys(sheet.resources).filter(id => id !== "hit-dice" && !id.startsWith("spell-slot-") && !ligados.has(id));
  const ataqueTemp = somaTemporaria(estado, "attacks");
  const fontes = [...new Map(todasAsMagias.flatMap(m => (m.fonte && m.cdFixa == null && !m.concedida ? [[m.fonte.chave, m.fonte] as const] : []))).values()];
  if (stats.spellDc != null && !fontes.some(f => f.chave === "classe")) {
    const atributo = ATRIBUTOS_CONJ.find(a => 8 + stats.prof + Math.floor((sheet.abilities[a] - 10) / 2) === stats.spellDc) ?? "int";
    fontes.unshift({ chave: "classe", rotulo: "Classe", atributo, cd: stats.spellDc, ataque: stats.spellAttack ?? 0 });
  }
  const usos = (id: string) => { const r = sheet.resources[id]; return <Marcadores rotulo={resourceLabel2014(id)} maximo={r.maximum} disponiveis={r.remaining}
    recarga={`descanso ${recargaDe(id, draft.classId, draft.level)}`} onUsar={d => onChange(usarRecurso(draft, sheet, id, d))}/>; };
  const remover = (id: string) => onChange(comEstado(draft, { concedidos: estado.concedidos.filter(c => c.id !== id) }));

  // ------------------------------------------------------------ cartões: a MESMA função desenha na categoria e nos favoritos
  const favorito = (chave: string, nome: string) => { const marcado = estado.favoritos.includes(chave); return <button type="button" className={"ficha-favorito" + (marcado ? " marcado" : "")} aria-pressed={marcado} aria-label={`Favoritar ${nome}`} title={marcado ? "Retirar dos favoritos" : "Marcar como favorito"}
    onClick={() => onChange(comEstado(draft, { favoritos: marcado ? estado.favoritos.filter(x => x !== chave) : [...estado.favoritos, chave] }))}><Star size={15} aria-hidden="true" fill={marcado ? "currentColor" : "none"}/></button>; };
  type Entrada = { chave: string; acao: TipoAcao | null; cartao: ReactNode };
  const ataques: Entrada[] = [
    ...stats.attacks.map((a, i): Entrada => { const arma = dadosDaArma(a.id); return { chave: `ataque:${a.id}`, acao: "acao", cartao: <Cartao key={a.id + i} rotulo={`Ataque: ${a.name}`} icone={Swords} titulo={a.name} selos={["Ataque com arma", ROTULO_ACAO.acao]} favorito={favorito(`ataque:${a.id}`, a.name)}>
      <ul className="ficha-valores"><li>Ataque {sinal(a.bonus + ataqueTemp)}</li><li>Dano {formulaDano(a.damage, a.damageBonus)}{arma?.tipo ? ` ${arma.tipo}` : ""}</li>{arma?.duasMaos && <li>{formulaDano(arma.duasMaos, a.damageBonus)} com duas mãos</li>}{arma?.alcance && <li>Alcance {arma.alcance}</li>}</ul>
      {arma && arma.propriedades.length > 0 && <p className="muted">{arma.propriedades.join(", ")}</p>}
      {!a.proficient && <p className="muted">Sem proficiência com esta arma.</p>}
      {a.heavyDisadvantage && <p className="muted">Arma pesada: desvantagem para tamanho Pequeno.</p>}
    </Cartao> }; }),
    ...estado.ataques.map((a): Entrada => ({ chave: `ataque:${a.id}`, acao: "acao", cartao: <Cartao key={a.id} rotulo={`Ataque: ${a.nome}`} icone={Swords} titulo={a.nome} selos={["Ataque personalizado"]} favorito={favorito(`ataque:${a.id}`, a.nome)}
      rodape={<button type="button" className="ficha-link ficha-abrir" aria-label={`Remover ataque ${a.nome}`} onClick={() => onChange(comEstado(draft, { ataques: estado.ataques.filter(x => x.id !== a.id) }))}>Remover ataque</button>}>
      <ul className="ficha-valores">{a.bonus && <li>Ataque {a.bonus}</li>}{a.dano && <li>Dano {a.dano}</li>}</ul>
      {a.notas && <p className="muted">{a.notas}</p>}
    </Cartao> })),
  ];
  const magia = (m: MagiaDaFicha): Entrada => ({ chave: `magia:${m.chave}`, acao: acaoDaMagia(dadosDaMagia(m.magia).tempo), cartao: <CartaoMagia key={m.chave} item={m} ataqueTemp={ataqueTemp} favorito={favorito(`magia:${m.chave}`, m.magia.name)} onAbrir={() => onOpenContent({ kind: "magia", ref: m.magia.id, title: m.magia.name })} onRemover={podeConceder && m.concedida ? () => remover(m.chave) : undefined}/> });
  const caracteristica = (c: Caracteristica): Entrada => ({ chave: `carac:${c.chave}`, acao: c.acao, cartao: <CartaoCaracteristica key={c.chave} item={c} usos={usos} favorito={favorito(`carac:${c.chave}`, c.nome)} onRemover={podeConceder && estado.concedidos.some(x => x.id === c.chave) ? () => remover(c.chave) : undefined}/> });

  const magiasProprias = todasAsMagias.filter(m => !m.concedida), magiasConcedidas = todasAsMagias.filter(m => m.concedida);
  const cartoesDe = (origens: OrigemCaracteristica[]) => todas.filter(c => origens.includes(c.origem)).map(caracteristica);
  const concedidas = [...cartoesDe(["Concedida"]), ...magiasConcedidas.map(magia)];
  const favoritos = [...ataques, ...todasAsMagias.map(magia), ...todas.map(caracteristica)].filter(e => estado.favoritos.includes(e.chave));
  const visiveis = (l: Entrada[]) => l.filter(e => passa(e.acao));
  const grade = (l: Entrada[]) => <ul className="ficha-cartoes">{l.map(e => e.cartao)}</ul>;

  const ataquesVisiveis = visiveis(ataques), proprias = magiasProprias.filter(m => passa(acaoDaMagia(dadosDaMagia(m.magia).tempo)));
  const circulos = [...new Set(proprias.map(m => m.magia.level))];
  const temMagia = semFiltro ? magiasProprias.length > 0 || espacos.length > 0 || stats.spellDc != null : proprias.length > 0;
  const categorias = CATEGORIAS.map(c => ({ ...c, cartoes: visiveis(cartoesDe(c.origens)) }));
  const concedidasVisiveis = visiveis(concedidas);
  const nada = !semFiltro && !temMagia && ataquesVisiveis.length + concedidasVisiveis.length + categorias.reduce((s, c) => s + c.cartoes.length, 0) === 0;

  return <div className="ficha-pilha">
    {favoritos.length > 0 && <section className="ficha-bloco ficha-favoritos" aria-label="Favoritos"><h2>Favoritos</h2>{grade(favoritos)}</section>}
    <div className="ficha-filtro-acao" role="group" aria-label="Filtrar por tipo de ação">{FILTROS_HAB.map(([v, r]) => <button key={v} type="button" className={filtro === v ? "ativo" : ""} aria-pressed={filtro === v} onClick={() => escolherFiltro(v)}>{r}</button>)}</div>
    {nada && <p className="muted" role="status">Nada deste tipo nas regras cadastradas para este personagem.</p>}

    {(semFiltro || ataquesVisiveis.length > 0) && <section className="ficha-bloco" aria-label="Ataques">
      <h2>Ataques {ataqueTemp !== 0 && <small className="ficha-temp">{sinal(ataqueTemp)} temporário no ataque</small>}</h2>
      {ataquesVisiveis.length > 0 ? grade(ataquesVisiveis) : <p className="muted">Equipe uma arma no Inventário ou crie um ataque personalizado.</p>}
      {semFiltro && <NovoAtaque draft={draft} estado={estado} onChange={onChange}/>}
    </section>}

    {temMagia && <section className="ficha-bloco" aria-label="Magias">
      <h2>Magias e espaços de magia</h2>
      {fontes.length > 0 && <ul className="ficha-fontes" aria-label="Conjuração">{fontes.map(f => <li key={f.chave}><strong>{f.rotulo}</strong><span>Atributo: {rotuloAtributo(f.atributo)}</span><span>CD de magia <strong>{f.cd}</strong></span><span>Ataque mágico <strong>{sinal(f.ataque + ataqueTemp)}</strong></span></li>)}</ul>}
      {espacos.length > 0 && <ul className="ficha-linhas" aria-label="Espaços de magia">{espacos.map(([id]) => <li key={id} className="ficha-recurso"><strong>{resourceLabel2014(id)}</strong>{usos(id)}</li>)}</ul>}
      {circulos.map(n => <div key={n} className="ficha-circulo"><h3>{n === 0 ? "Truques" : `${n}º círculo`}</h3>{grade(proprias.filter(m => m.magia.level === n).map(magia))}</div>)}
      {magiasProprias.length === 0 && <p className="muted">Nenhuma magia escolhida. Use Editar personagem para escolher.</p>}
    </section>}

    {categorias.map(c => (c.cartoes.length > 0 || (semFiltro && c.id === "classe" && soltos.length > 0)) && <section key={c.id} className="ficha-bloco" aria-label={c.titulo}>
      <h2>{c.titulo}</h2>
      {c.id === "classe" && semFiltro && soltos.length > 0 && <ul className="ficha-linhas" aria-label="Outros recursos">{soltos.map(id => <li key={id} className="ficha-recurso"><strong>{resourceLabel2014(id)}</strong>{usos(id)}</li>)}</ul>}
      {c.cartoes.length > 0 && grade(c.cartoes)}
    </section>)}

    {(concedidasVisiveis.length > 0 || (semFiltro && podeConceder)) && <section className="ficha-bloco" aria-label="Habilidades e magias concedidas">
      <h2>Habilidades e magias concedidas</h2>
      {concedidasVisiveis.length > 0 && grade(concedidasVisiveis)}
      {semFiltro && podeConceder && <Conceder draft={draft} estado={estado} onChange={onChange}/>}
    </section>}
  </div>;
}

/** Cartão padrão de ataque, magia, habilidade ou característica: ícone, nome e estrela sempre nas mesmas posições; tipo e origem logo
 *  abaixo; depois recursos, valores de mesa, resumo e descrição; ações no rodapé. */
function Cartao({ rotulo, icone: Icone, titulo, selos, favorito, rodape, children }: { rotulo: string; icone: typeof Star; titulo: string; selos: (string | null | undefined)[]; favorito: ReactNode; rodape?: ReactNode; children?: ReactNode }) {
  return <li className="ficha-cartao" aria-label={rotulo}>
    <div className="ficha-cartao-topo"><span className="ficha-cartao-icone"><Icone size={17} aria-hidden="true"/></span><h3>{titulo}</h3>{favorito}</div>
    <p className="ficha-cartao-selos">{selos.filter(Boolean).map(x => <span key={x} className="ficha-selo">{x}</span>)}</p>
    {children}
    {rodape && <div className="ficha-cartao-rodape">{rodape}</div>}
  </li>;
}

function CartaoCaracteristica({ item, usos, favorito, onRemover }: { item: Caracteristica; usos: (id: string) => ReactNode; favorito: ReactNode; onRemover?: () => void }) {
  return <Cartao rotulo={item.nome} icone={ICONE[item.origem]} titulo={item.nome} favorito={favorito}
    selos={[`${item.origem}${item.detalheOrigem && item.origem !== "Raça" ? ` · ${item.detalheOrigem}` : ""}`, item.acao ? ROTULO_ACAO[item.acao] : null]}
    rodape={onRemover && <button type="button" className="ficha-link ficha-abrir" aria-label={`Retirar ${item.nome}`} onClick={onRemover}>Retirar concessão</button>}>
    {item.recursos.map(id => <div key={id} className="ficha-recurso">{item.recursos.length > 1 && <span>{resourceLabel2014(id)}</span>}{usos(id)}</div>)}
    {item.valores.length > 0 && <ul className="ficha-valores">{item.valores.map(v => <li key={v}>{v}</li>)}</ul>}
    {item.resumo && <p className="muted">{item.resumo}</p>}
    {item.descricao && item.descricao.replace(/\s+/g, " ").trim() !== item.resumo && <details><summary>Descrição completa<span className="sr-only"> de {item.nome}</span></summary><p className="ficha-texto">{item.descricao}</p></details>}
  </Cartao>;
}

function CartaoMagia({ item, ataqueTemp, favorito, onAbrir, onRemover }: { item: MagiaDaFicha; ataqueTemp: number; favorito: ReactNode; onAbrir: () => void; onRemover?: () => void }) {
  const { magia, fonte, origem } = item, d = dadosDaMagia(magia), acao = acaoDaMagia(d.tempo);
  const cd = item.cdFixa ?? fonte?.cd, ataque = item.ataqueFixo ?? fonte?.ataque;
  const linha = [d.salvaguarda && `Salvaguarda de ${d.salvaguarda}${cd != null ? ` · CD ${cd}` : ""}`, d.ataque && ataque != null && `Ataque mágico ${sinal(ataque + ataqueTemp)}`, d.dano, d.cura].filter((x): x is string => !!x);
  return <Cartao rotulo={magia.name} icone={d.dano ? Flame : Sparkles} titulo={magia.name} favorito={favorito}
    selos={[magia.level === 0 ? "Truque" : `${magia.level}º círculo`, `${origem}${magia.ritual ? " · ritual" : ""}`, acao ? ROTULO_ACAO[acao] : null]}
    rodape={<><button type="button" className="ficha-link ficha-abrir" aria-label={`Abrir no Compêndio: ${magia.name}`} onClick={onAbrir}>Abrir no Compêndio</button>
      {onRemover && <button type="button" className="ficha-link ficha-abrir" aria-label={`Retirar ${magia.name}`} onClick={onRemover}>Retirar concessão</button>}</>}>
    {linha.length > 0 && <ul className="ficha-valores">{linha.map(v => <li key={v}>{v}</li>)}</ul>}
    <p className="muted">{[d.tempo, d.alcance && `Alcance: ${d.alcance}`, d.duracao && `Duração: ${d.duracao}`, d.consumo].filter(Boolean).join(" · ")}</p>
    <details><summary>Descrição completa<span className="sr-only"> de {magia.name}</span></summary><p className="ficha-texto">{magia.description.replace(/(\d)O\b/g, "$10")}</p></details>
  </Cartao>;
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
      {f.tipo !== "magia" && <><label>Salvaguarda exigida<select aria-label="Salvaguarda exigida" value={f.salvaguarda} onChange={e => muda({ salvaguarda: e.target.value })}><option value="">Nenhuma</option>{ATRIBUTOS_CONJ.map(a => <option key={a} value={rotuloAtributo(a)}>{rotuloAtributo(a)}</option>)}</select></label>
        <label>Dano, cura ou valor<input aria-label="Efeito numérico" maxLength={200} value={f.efeito} onChange={e => muda({ efeito: e.target.value })}/></label>
        <label className="ficha-campo-largo">Descrição<textarea aria-label="Descrição do que será concedido" maxLength={2000} rows={3} value={f.descricao} onChange={e => muda({ descricao: e.target.value })}/></label></>}
      <div className="ficha-campo-largo row"><button type="submit" className="btn-primary" disabled={!valido}>Conceder</button><button type="button" className="btn-secondary" onClick={() => setAberto(false)}>Cancelar</button></div>
    </form>
  </section>;
}
const nomeDoItem = (id: string) => srdItem(id)?.nome ?? id;
