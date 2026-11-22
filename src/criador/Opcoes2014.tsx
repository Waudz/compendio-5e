import './personagens-2014.css';
import { useState } from 'react';
import type { CharacterDraft } from '../rules/character-domain';
import { srdItem, srdItemIds } from '../catalogue/srd-2014-items';
import { applyStartingEquipmentSelection } from '../rules/starting-equipment-selection';
import { rotuloAtributo, rotuloOpcao, rotuloPericia } from './rotulos';
import {
  activate2014,
  modern2014,
  classes2014,
  class2014,
  spells2014,
  hpMode2014,
  hpRoll2014,
  races2014,
  label2014,
  shortId,
  change2014,
  choices2014,
  selected2014,
  decide2014,
  featureDescription2014,
  raceTraits2014,
  proficiency2014,
  spellSlots2014,
  equipment2014,
  canonicalItem2014,
  equipmentCategory2014,
  proficiencyLabel2014,
  resourceLabel2014,
  grantBackground2014,
  equipmentRequirement2014,
  automaticSpells2014,
  statistics2014,
  sheet2014,
  type Choice2014,
  type Component,
} from './regras-2014';

function Choice({
  draft,
  choice,
  onChange,
}: {
  draft: CharacterDraft;
  choice: Choice2014;
  onChange: (d: CharacterDraft) => void;
}) {
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
  return (
    <fieldset>
      <legend>
        {choice.name} — escolha {choice.count} ({selected.length}/{choice.count}
        )
      </legend>
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
          <div
            style={{
              display: 'grid',
              gap: 6,
              maxHeight: 260,
              overflowY: 'auto',
            }}
          >
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
    </fieldset>
  );
}
export function Opcoes2014({
  draft,
  onChange,
}: {
  draft: CharacterDraft;
  onChange: (d: CharacterDraft) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [pendingClass, setPendingClass] = useState('');
  const [symbol, setSymbol] = useState('amulet');
  const [error, setError] = useState('');
  if (!modern2014(draft))
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
  const set = (patch: Partial<CharacterDraft>) => {
    try {
      onChange(change2014(draft, patch));
      setError('');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Revise a mudança de personagem.',
      );
    }
  };
  return (
    <section
      className="character-2014"
      aria-label="Opções SRD 2014"
      style={{ display: 'grid', gap: 12 }}
    >
      <label>
        Classe
        <select
          value={pendingClass || draft.classId}
          onChange={(e) => setPendingClass(e.target.value === draft.classId ? '' : e.target.value)}
        >
          {classes2014.map((c) => (
            <option key={c.id} value={shortId(c.id)}>
              {label2014(c.id)}
            </option>
          ))}
        </select>
      </label>
      {pendingClass && pendingClass !== draft.classId && (
        <section aria-label="Confirmar classe" role="region">
          <p>
            Você está mudando de <strong>{label2014(draft.classId)}</strong> para{' '}
            <strong>{label2014(pendingClass)}</strong>. A mudança só será aplicada
            ao confirmar.
          </p>
          <p>
            Trocar a classe reinicia escolhas de classe, recursos e a progressão
            de PV. Nome, atributos, raça, origem e inventário são preservados; a
            ficha salva só muda depois de Salvar.
          </p>
          <button
            type="button"
            onClick={() => {
              set({
                classId: pendingClass,
                decisions: draft.decisions.filter((c) =>
                  /^(racial-|elf-|dwarf-|dragon-|background-|equipment-)/.test(
                    c.id,
                  ),
                ),
                spentResources: {},
                hpRolls: undefined,
              });
              setPendingClass('');
            }}
          >
            Confirmar troca de classe
          </button>
          <button type="button" onClick={() => setPendingClass('')}>
            Cancelar troca de classe
          </button>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      <label>
        Raça
        <select
          value={draft.raceId}
          onChange={(e) => set({ raceId: e.target.value })}
        >
          {races2014.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Origem
        <select
          value={draft.backgroundId}
          onChange={(e) => set({ backgroundId: e.target.value })}
        >
          <option value="acolyte">Acólito (SRD 2014)</option>
          <option value="custom">Origem personalizada (SRD 2014)</option>
        </select>
      </label>
      {draft.backgroundId === 'custom' && (
        <label>
          Característica da origem combinada com o mestre
          <textarea
            maxLength={500}
            value={selected2014(draft, 'background-feature')[0] ?? ''}
            onChange={(e) =>
              onChange(
                decide2014(draft, 'background-feature', [e.target.value]),
              )
            }
          />
        </label>
      )}
      <section aria-label="Ganhos da origem">
        <h3>Ganhos da origem</h3>
        <p>
          {draft.backgroundId === 'acolyte'
            ? 'Intuição e Religião; dois idiomas; Abrigo dos Fiéis (auxílio de um templo da sua fé, conforme o mestre).'
            : 'Escolha duas perícias e duas proficiências em idiomas/ferramentas. Combine a característica e o equipamento com o mestre; o pacote abaixo usa o Acólito do SRD.'}
        </p>
        <label>
          Símbolo sagrado da origem
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {['amulet', 'emblem', 'reliquary'].map((id) => (
              <option key={id} value={id}>
                {itemName(canonicalItem2014('srd51:item/' + id))}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onChange(grantBackground2014(draft, symbol))}
        >
          Aplicar equipamento da origem e 15 po
        </button>
        <p>
          Inclui símbolo sagrado, livro de orações, cinco varetas de incenso,
          vestes sacerdotais, roupas comuns e 15 po. A aplicação é única, sem
          duplicar o inventário.
        </p>
      </section>
      <p className="notice">
        A origem concede perícias e idiomas; perícias repetidas exigem uma
        escolha diferente. Traços e condições de uso aparecem na descrição, sem
        aplicar bônus condicionais fora de contexto.
      </p>
      {choices2014(draft).map((ch) => (
        <Choice key={ch.id} draft={draft} choice={ch} onChange={onChange} />
      ))}
      <details>
        <summary>Traços raciais — {label2014(draft.raceId)}</summary>
        {raceTraits2014(draft).map((t) => (
          <details key={t.index}>
            <summary>{t.name}</summary>
            <p>{t.desc.join('\n\n')}</p>
          </details>
        ))}
      </details>
      <details>
        <summary>Proficiências de classe</summary>
        <ul>
          {proficiency2014(draft).map((p) => (
            <li key={p}>{proficiencyLabel2014(p)}</li>
          ))}
        </ul>
      </details>
      <p>
        Espaços de magia:{' '}
        {spellSlots2014(draft).some((n) => n > 0)
          ? spellSlots2014(draft)
              .map((n, i) => (n ? `${i + 1}º círculo: ${n}` : null))
              .filter(Boolean)
              .join(' · ')
          : 'Sem espaços de magia'}
      </p>
      <details>
        <summary>
          Magias concedidas por raça/subclasse (não contam no preparo)
        </summary>
        {automaticSpells2014(draft).map((spell) => (
          <details key={spell.id}>
            <summary>
              {spell.name} —{' '}
              {spell.level === 0 ? 'truque' : spell.level + 'º círculo'}
            </summary>
            <p>{spell.description}</p>
          </details>
        ))}
      </details>
      <small>
        Fonte: SRD 5.1 (2014), CC BY 4.0. Opções não SRD não são importadas
        automaticamente.
      </small>
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

export function Resumo2014({
  draft,
  onChange,
}: {
  draft: CharacterDraft;
  onChange: (d: CharacterDraft) => void;
}) {
  const sheet = sheet2014(draft),
    stats = statistics2014(draft);
  return (
    <section className="character-2014" aria-label="Resumo de jogo SRD 2014">
      <h2>Resumo de jogo</h2>
      <p>
        Proficiência +{stats.prof} · CA {stats.ac} · Percepção passiva{' '}
        {stats.passivePerception} · Deslocamento {stats.speed} m
      </p>
      {stats.ambiguousArmor && (
        <p role="alert">
          Mais de uma armadura está equipada. Desequipe a armadura extra para
          resolver a CA.
        </p>
      )}
      {stats.armorWithoutProficiency && (
        <p role="alert">
          Armadura ou escudo sem proficiência: há penalidades em testes e
          ataques que envolvem Força ou Destreza e você não pode conjurar magias
          usando esse equipamento.
        </p>
      )}
      {stats.spellDc !== null && (
        <p>
          CD de magia {stats.spellDc} · Ataque mágico +{stats.spellAttack}
        </p>
      )}
      <label>
        PV atuais
        <input
          type="number"
          min={0}
          max={sheet.maxHp}
          value={draft.currentHp}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isSafeInteger(n) && n >= 0 && n <= sheet.maxHp)
              onChange({ ...draft, currentHp: n });
          }}
        />
      </label>
      <fieldset>
        <legend>PV na progressão</legend>
        <label>
          Ganho de PV por nível
          <select
            value={draft.hpRolls ? 'rolled' : 'fixed'}
            onChange={(e) =>
              onChange(hpMode2014(draft, e.target.value === 'rolled'))
            }
          >
            <option value="fixed">Média fixa do dado de vida</option>
            <option value="rolled">Rolagens informadas</option>
          </select>
        </label>
        {draft.hpRolls && (
          <>
            <p>
              No primeiro nível, usa-se o máximo do dado. As médias abaixo são
              provisórias: informe e confirme seus resultados físicos de cada
              nível.
            </p>
            {draft.hpRolls.map((roll, i) => (
              <div key={i}>
                <label>
                  PV rolados no nível {i + 2} (d{class2014(draft).data.hitDie})
                  <input
                    type="number"
                    min={1}
                    max={class2014(draft).data.hitDie}
                    value={roll}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (
                        Number.isSafeInteger(n) &&
                        n >= 1 &&
                        n <= class2014(draft).data.hitDie
                      )
                        onChange(hpRoll2014(draft, i + 2, n));
                    }}
                  />
                </label>
                {selected2014(draft, 'hp-roll-confirmed-' + (i + 2))[0] !==
                  String(roll) && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      onChange(
                        decide2014(draft, 'hp-roll-confirmed-' + (i + 2), [
                          String(roll),
                        ]),
                      )
                    }
                  >
                    Confirmar PV do nível {i + 2}
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </fieldset>
      <details>
        <summary>Testes de resistência</summary>
        <dl>
          {Object.entries(stats.saves).map(([id, n]) => (
            <div key={id}>
              <dt>{rotuloAtributo(id)}</dt>
              <dd>
                {n >= 0 ? '+' : ''}
                {n}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      <details>
        <summary>Ataques das armas equipadas</summary>
        {stats.attacks.length ? (
          stats.attacks.map((a) => (
            <p key={a.id}>
              {a.name}: ataque {a.bonus >= 0 ? '+' : ''}
              {a.bonus}; dano {a.damage} {a.damageBonus >= 0 ? '+' : ''}
              {a.damageBonus}
              {!a.proficient ? ' · sem proficiência' : ''}
              {a.heavyDisadvantage
                ? ' · arma pesada: desvantagem para tamanho Pequeno'
                : ''}
            </p>
          ))
        ) : (
          <p>Equipe uma arma no inventário para ver os ataques.</p>
        )}
        <p>
          Condições de combate, crítico, dano com duas mãos e benefícios
          condicionais são resolvidos conforme a descrição da característica.
        </p>
      </details>
      <details>
        <summary>Perícias e bônus calculados</summary>
        <dl>
          {Object.entries(stats.skills).map(([id, n]) => (
            <div key={id}>
              <dt>{rotuloPericia(id)}</dt>
              <dd>
                {n >= 0 ? '+' : ''}
                {n}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      <fieldset>
        <legend>Moedas</legend>
        {(['cp', 'sp', 'gp'] as const).map((coin, i) => (
          <label key={coin}>
            {['Cobre', 'Prata', 'Ouro'][i]}
            <input
              type="number"
              min={0}
              value={draft.currency?.[coin] ?? 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isSafeInteger(n) && n >= 0)
                  onChange({
                    ...draft,
                    currency: {
                      cp: 0,
                      sp: 0,
                      gp: 0,
                      ...draft.currency,
                      [coin]: n,
                    },
                  });
              }}
            />
          </label>
        ))}
      </fieldset>
      <details>
        <summary>Recursos e dados de vida</summary>
        {Object.entries(sheet.resources).map(([id, r]) => (
          <div className="row" key={id}>
            <span>
              {resourceLabel2014(id)}:{' '}
              {r.maximum === null ? 'ilimitado' : r.remaining + '/' + r.maximum}
            </span>
            <button
              type="button"
              disabled={r.remaining === 0}
              aria-label={'Usar recurso ' + id}
              onClick={() =>
                onChange({
                  ...draft,
                  spentResources: {
                    ...draft.spentResources,
                    [id]: r.spent + 1,
                  },
                })
              }
            >
              Usar
            </button>
            <button
              type="button"
              disabled={!r.spent}
              aria-label={'Recuperar recurso ' + id}
              onClick={() =>
                onChange({
                  ...draft,
                  spentResources: {
                    ...draft.spentResources,
                    [id]: r.spent - 1,
                  },
                })
              }
            >
              Recuperar
            </button>
          </div>
        ))}
        <p>
          Usar um dado de vida registra o gasto. Role o dado físico e ajuste os
          PV manualmente; a cura não é duplicada.
        </p>
      </details>
      <details>
        <summary>Equipar itens do inventário</summary>
        {draft.inventory.map((i) => (
          <label className="check" key={i.id}>
            <input
              type="checkbox"
              checked={i.equipped}
              onChange={(e) =>
                onChange({
                  ...draft,
                  inventory: draft.inventory.map((x) =>
                    x.id === i.id ? { ...x, equipped: e.target.checked } : x,
                  ),
                })
              }
            />
            {i.customName ?? itemName(i.itemId)}
          </label>
        ))}
      </details>
    </section>
  );
}
