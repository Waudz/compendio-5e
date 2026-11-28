import './personagens-2014.css';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import type { CharacterDraft } from '../rules/character-domain';
import { srdItem, srdItemIds } from '../catalogue/srd-2014-items';
import { applyStartingEquipmentSelection } from '../rules/starting-equipment-selection';
import { rotuloAtributo, rotuloOpcao, rotuloPericia } from './rotulos';
import {
  activate2014,
  classes2014,
  spells2014,
  label2014,
  shortId,
  change2014,
  choices2014,
  selected2014,
  decide2014,
  featureDescription2014,
  proficiency2014,
  equipment2014,
  canonicalItem2014,
  equipmentCategory2014,
  proficiencyLabel2014,
  equipmentRequirement2014,
  sheet2014,
  type Choice2014,
  type Component,
} from './regras-2014';

/** Escolhas de uma etapa. Os grupos de magias viram seções que se expandem, uma aberta por vez (começa na primeira incompleta);
 * as demais escolhas continuam como estão. */
export function ListaDeEscolhas({
  draft,
  escolhas,
  onChange,
}: {
  draft: CharacterDraft;
  escolhas: Choice2014[];
  onChange: (d: CharacterDraft) => void;
}) {
  const magias = escolhas.filter((c) => c.kind === 'spell');
  const [aberta, setAberta] = useState(
    () => magias.find((c) => selected2014(draft, c.id).length < c.count)?.id ?? '',
  );
  return (
    <div className="character-2014">
      {escolhas
        .filter((c) => c.kind !== 'spell')
        .map((c) => (
          <Choice key={c.id} draft={draft} choice={c} onChange={onChange} />
        ))}
      {magias.length > 0 && (
        <div className="grupos-de-magia">
          {magias.map((c) => (
            <Choice
              key={c.id}
              draft={draft}
              choice={c}
              onChange={onChange}
              secao={{
                aberta: aberta === c.id,
                alternar: () => setAberta(aberta === c.id ? '' : c.id),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Choice({
  draft,
  choice,
  onChange,
  secao,
}: {
  draft: CharacterDraft;
  choice: Choice2014;
  onChange: (d: CharacterDraft) => void;
  /** Seção expansível; a pesquisa e os detalhes abertos continuam guardados quando ela é recolhida. */
  secao?: { aberta: boolean; alternar: () => void };
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [previewSpell, setPreviewSpell] = useState('');
  const selected = selected2014(draft, choice.id);
  const calculated = sheet2014(draft);
  const taken = new Set(
    calculated.provenance
      .filter(
        (g) =>
          g.source !== choice.id &&
          ((choice.kind === 'skill' && g.type === 'skill') ||
            (choice.kind === 'language' && g.type === 'language')),
      )
      .map((g) =>
        g.type === 'skill' ? g.skill : g.type === 'language' ? g.language : '',
      ),
  );
  const others = choices2014(draft).filter((c) => c.id !== choice.id);
  const unrestrictedSpell =
    choice.id === 'spells-prepared' ||
    choice.id.includes('spell-mastery') ||
    choice.id.includes('signature-spell');
  const unavailable = (id: string) =>
    taken.has(id) ||
    (choice.kind === 'proficiency' &&
      ((id.startsWith('language:') &&
        calculated.provenance.some(
          (g) =>
            g.source !== choice.id &&
            g.type === 'language' &&
            g.language === id.slice(9),
        )) ||
        (!selected.includes(id) &&
          proficiency2014(draft)
            .map((p) => p.replace(': ', ':'))
            .includes(id)))) ||
    (choice.kind === 'expertise' &&
      ((!calculated.skills.includes(id) &&
        !(id.includes('thieves-tools') && draft.classId === 'rogue')) ||
        others.some(
          (c) =>
            c.kind === 'expertise' && selected2014(draft, c.id).includes(id),
        ))) ||
    (choice.kind === 'feature' &&
      id.startsWith('srd51:feature/') &&
      others.some(
        (c) => c.kind === 'feature' && selected2014(draft, c.id).includes(id),
      )) ||
    (choice.kind === 'spell' &&
      !unrestrictedSpell &&
      others.some(
        (c) =>
          c.kind === 'spell' &&
          c.id !== 'spells-prepared' &&
          !c.id.includes('spell-mastery') &&
          !c.id.includes('signature-spell') &&
          selected2014(draft, c.id).includes(id),
      ));
  const name = (id: string) =>
    choice.kind === 'skill' || choice.kind === 'expertise'
      ? id.includes('thieves-tools')
        ? proficiencyLabel2014('tool:thieves-tools')
        : rotuloPericia(id)
      : choice.kind === 'ability'
        ? rotuloAtributo(id)
        : choice.kind === 'feature'
          ? rotuloOpcao(label2014(id))
          : (choice.options.find((o) => o.id === id)?.name ?? id);
  const preview = spells2014.find((s) => s.id === previewSpell);
  const options = choice.options.filter(
    (o) =>
      !search ||
      name(o.id)
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
  );
  const set = (ids: string[]) => onChange(decide2014(draft, choice.id, ids));
  const corpo = (
    <>
      {choice.count === 1 && choice.kind !== 'spell' ? (
        <label>
          {choice.name}
          <select
            aria-label={choice.name}
            value={selected[0] ?? ''}
            onChange={(e) => set(e.target.value ? [e.target.value] : [])}
          >
            <option value="">Selecione</option>
            {choice.options.map((o) => (
              <option key={o.id} value={o.id} disabled={unavailable(o.id)}>
                {name(o.id)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          {choice.kind === 'spell' && (
            <label>
              Filtrar {choice.name}
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          )}
          {/* sem rolagem própria: as opções se distribuem em colunas e a etapa tem uma única rolagem */}
          {['skill', 'language', 'proficiency'].includes(choice.kind) && options.some((o) => !selected.includes(o.id) && unavailable(o.id)) && <p className="muted">Opções desativadas já vêm de outra fonte e não podem ser repetidas.</p>}
          <div className="lista-de-opcoes">
            {options.map((o) => (
              <div className="character-spell-option" key={o.id}>
                <label className="check" key={o.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    disabled={
                      !selected.includes(o.id) &&
                      (selected.length >= choice.count || unavailable(o.id))
                    }
                    onChange={(e) =>
                      set(
                        e.target.checked
                          ? [...selected, o.id]
                          : selected.filter((id) => id !== o.id),
                      )
                    }
                  />
                  {name(o.id)}
                </label>
                {choice.kind === 'spell' && (
                  <button
                    type="button"
                    className="btn-secondary"
                    aria-label={'Ver detalhes de ' + name(o.id)}
                    onClick={() => setPreviewSpell(o.id)}
                  >
                    Ver detalhes
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {preview && (
        <section aria-label="Detalhes de magia">
          <h4>{preview.name}</h4>
          <p>
            {preview.level === 0 ? 'Truque' : preview.level + 'º círculo'} ·{' '}
            {preview.details}
          </p>
          <p>{preview.description}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPreviewSpell('')}
          >
            Fechar detalhes de magia
          </button>
        </section>
      )}
      {selected.map((id) =>
        featureDescription2014(id) ? (
          <details key={id}>
            <summary>{name(id)}</summary>
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {featureDescription2014(id)}
            </p>
          </details>
        ) : null,
      )}
    </>
  );
  if (secao)
    return (
      <div className="grupo-magia" role="group" aria-labelledby={id + '-titulo'}>
        <h4>
          <button
            type="button"
            className="grupo-magia-titulo"
            aria-expanded={secao.aberta}
            aria-controls={secao.aberta ? id + '-corpo' : undefined}
            onClick={secao.alternar}
          >
            {secao.aberta ? (
              <ChevronDown size={16} aria-hidden="true" />
            ) : (
              <ChevronRight size={16} aria-hidden="true" />
            )}
            <span id={id + '-titulo'} className="grupo-magia-rotulo">
              <span>{choice.name}</span>{' '}
              <span className="grupo-magia-contador">
                {selected.length}/{choice.count}
              </span>
            </span>
          </button>
        </h4>
        {secao.aberta && (
          <div id={id + '-corpo'} className="grupo-magia-corpo">
            {corpo}
          </div>
        )}
      </div>
    );
  return (
    <fieldset>
      <legend>
        {choice.name} — escolha {choice.count} ({selected.length}/{choice.count}
        )
      </legend>
      {corpo}
    </fieldset>
  );
}
export function AtivarRegras2014({
  draft,
  onChange,
}: {
  draft: CharacterDraft;
  onChange: (d: CharacterDraft) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [pendingClass, setPendingClass] = useState('');
  return (
      <section className="character-2014" aria-label="Opções SRD 2014">
        <p>
          As escolhas desta ficha estão preservadas. Para configurar classe,
          raça e origem pelas opções SRD 2014, confirme a atualização deste
          rascunho.
        </p>
        <label>
          Classe para configurar
          <select
            value={pendingClass || 'fighter'}
            onChange={(e) => setPendingClass(e.target.value)}
          >
            {classes2014.map((c) => (
              <option key={c.id} value={shortId(c.id)}>
                {label2014(c.id)}
              </option>
            ))}
          </select>
        </label>
        {!confirm ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirm(true)}
          >
            Ativar opções SRD 2014
          </button>
        ) : (
          <div role="region" aria-label="Revisar mudança de regras">
            <p>
              Nome, atributos e inventário serão preservados. As escolhas de
              classe serão reiniciadas; uma cópia privada do rascunho anterior
              será preservada. A ficha salva só muda depois de clicar em Salvar.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                onChange(
                  change2014(activate2014(draft), {
                    classId: pendingClass || 'fighter',
                    ...(pendingClass && pendingClass !== 'fighter'
                      ? { hpRolls: undefined, decisions: [] }
                      : {}),
                  }),
                )
              }
            >
              Confirmar nova versão de regras
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirm(false)}
            >
              Cancelar mudança de regras
            </button>
          </div>
        )}
      </section>
    );
}
const itemName = (id: string) => srdItem(id)?.nome ?? id;
function expand(items: { itemId: string; quantity: number }[]) {
  const totals = new Map<string, number>();
  for (const c of items) {
    const pack = srdItem(c.itemId)?.pacote;
    for (const item of pack
      ? pack.map((p) => ({ itemId: p.id, quantity: p.qtd * c.quantity }))
      : [c])
      totals.set(item.itemId, (totals.get(item.itemId) ?? 0) + item.quantity);
  }
  return [...totals].map(([itemId, quantity]) => ({ itemId, quantity }));
}
export function Equipamento2014({
  draft,
  onChange,
}: {
  draft: CharacterDraft;
  onChange: (d: CharacterDraft) => void;
}) {
  const config = equipment2014(draft);
  const [error, setError] = useState('');
  const option = (g: number) =>
    Number(selected2014(draft, 'equipment-' + g)[0] ?? 0);
  const select = (id: string, value: string) =>
    onChange(decide2014(draft, id, [value]));
  const components = (g: number, items: Component[]) =>
    items.flatMap((c, i) =>
      c.item
        ? [
            {
              itemId: canonicalItem2014(c.item) ?? '',
              quantity: c.quantity ?? 1,
            },
          ]
        : Array.from({ length: c.count ?? 1 }, (_, n) => ({
            itemId: selected2014(draft, `equipment-${g}-${i}-${n}`)[0] ?? '',
            quantity: 1,
          })),
    );
  const apply = () => {
    try {
      if (
        draft.inventory.some(
          (i) =>
            i.origin === 'starting' &&
            !i.id.startsWith('background-acolyte:') &&
            !i.id.startsWith('starting-choice:character-2014:'),
        )
      )
        throw Error(
          'Já existe equipamento inicial nesta ficha. Revise o inventário e confirme o aproveitamento; não concederemos um segundo conjunto.',
        );
      if (
        selected2014(draft, 'equipment-accepted').length &&
        !draft.inventory.some((i) =>
          i.id.startsWith('starting-choice:character-2014:'),
        )
      )
        throw Error(
          'Equipamento inicial já concedido e consumido. Use o inventário para alterações.',
        );
      for (const [g, group] of config.startingChoices.entries())
        if (!equipmentRequirement2014(draft, group.options[option(g)].requires))
          throw Error(
            'A alternativa exige proficiência que a ficha não possui.',
          );
      const items = [
        ...components(-1, config.startingEquipment),
        ...config.startingChoices.flatMap((g, i) =>
          components(i, g.options[option(i)].items),
        ),
      ];
      if (items.some((c) => !c.itemId))
        throw Error(
          'Escolha todos os itens das categorias antes de confirmar.',
        );
      // Uma única receita estável por personagem: nunca conceder equipamento de outra classe por cima do anterior.
      const next = applyStartingEquipmentSelection(
        draft,
        {
          sourceId: 'character-2014',
          optionId: 'confirmed',
          components: expand(items),
        },
        srdItemIds(),
      );
      onChange(decide2014(next, 'equipment-accepted', ['yes']));
      setError('Equipamentos iniciais aplicados ao inventário.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível aplicar.');
    }
  };
  return (
    <section
      className="character-2014"
      aria-label="Equipamento inicial SRD 2014"
    >
      <h2>Equipamento inicial — {label2014(draft.classId)}</h2>
      <p>
        Escolha uma alternativa de cada grupo. O inventário existente é
        preservado. Depois de confirmar, alterações de equipamento são feitas no
        inventário.
      </p>
      <ul>
        {config.startingEquipment.map((c, i) => (
          <li key={i}>
            {c.item
              ? `${itemName(canonicalItem2014(c.item) ?? '')} ×${c.quantity ?? 1}`
              : c.category}
          </li>
        ))}
      </ul>
      {config.startingChoices.map((g, i) => (
        <fieldset key={i}>
          <legend>Grupo {i + 1}</legend>
          <label>
            Alternativa do grupo {i + 1}
            <select
              value={option(i)}
              onChange={(e) => select('equipment-' + i, e.target.value)}
            >
              {g.options.map((o, n) => (
                <option
                  key={n}
                  value={n}
                  disabled={!equipmentRequirement2014(draft, o.requires)}
                >
                  {o.items
                    .map((c) =>
                      c.item
                        ? `${itemName(canonicalItem2014(c.item) ?? '')} ×${c.quantity ?? 1}`
                        : `${c.count ?? 1} de ${c.category}`,
                    )
                    .join(' + ')}
                  {o.requires
                    ? ' (exige proficiência: ' + o.requires + ')'
                    : ''}
                </option>
              ))}
            </select>
          </label>
          {g.options[option(i)].items.map((c, j) =>
            c.category
              ? Array.from({ length: c.count ?? 1 }, (_, n) => (
                  <label key={j + '-' + n}>
                    Item {n + 1} — {c.category}
                    <select
                      value={
                        selected2014(draft, `equipment-${i}-${j}-${n}`)[0] ?? ''
                      }
                      onChange={(e) =>
                        select(`equipment-${i}-${j}-${n}`, e.target.value)
                      }
                    >
                      <option value="">Selecione um item</option>
                      {equipmentCategory2014(c.category!).map((id) => (
                        <option key={id} value={id}>
                          {itemName(id)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))
              : null,
          )}
        </fieldset>
      ))}
      {draft.inventory.some(
        (i) =>
          i.origin === 'starting' && !i.id.startsWith('background-acolyte:'),
      ) && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            onChange(decide2014(draft, 'equipment-accepted', ['yes']))
          }
        >
          Usar equipamento inicial já existente
        </button>
      )}
      <button type="button" className="btn-primary" onClick={apply}>
        Confirmar equipamentos SRD 2014
      </button>
      {error && <p role="status">{error}</p>}
    </section>
  );
}
