import { useState } from 'react'
import { Button, Callout } from '@/components/ui'
import { cn } from '@/lib/cn'
import { skills as allSkills } from '@/rules/amnia'
import {
  ammoUnits,
  availableMods,
  choiceSpecs,
  craftDc,
  emptyConfig,
  enchantCost,
  equipment,
  formatZg,
  modAvailability,
  orderTotal,
  priceLines,
  qualityById,
  unitPrice,
  validateConfig,
  type ItemConfig,
  type ItemDef,
  type QualityId,
} from '@/rules/equipment'

export interface ConfiguredOrder {
  config: ItemConfig
  quantity: number
  days: number
}

/**
 * Configura um item antes de comprar (ou melhorar um que você já tem):
 * qualidade, modificadores (limitados pelos slots da qualidade), encantamentos
 * e escolhas. Mostra o preço linha a linha em Zg.
 */
export function ItemConfigurator({
  item,
  mode,
  initial,
  zigs,
  onSubmit,
  onCancel,
}: {
  item: ItemDef
  mode: 'buy' | 'upgrade'
  /** Upgrade: a configuração atual (o mínimo; não dá para rebaixar nem remover). */
  initial?: ItemConfig
  zigs: number
  onSubmit: (order: ConfiguredOrder) => void
  onCancel: () => void
}) {
  const [config, setConfig] = useState<ItemConfig>(() =>
    initial
      ? { ...initial, mods: [...initial.mods], enchants: [...initial.enchants], choices: { ...initial.choices } }
      : emptyConfig(),
  )
  const [quantity, setQuantity] = useState(1)
  const [days, setDays] = useState(1)

  const upgrade = mode === 'upgrade' && initial !== undefined
  const lockedMods = new Set(upgrade ? initial.mods : [])
  const lockedEnchants = new Set(upgrade ? initial.enchants : [])
  const minQuality = upgrade ? qualityById(initial.quality).level : 0

  const quality = qualityById(config.quality)
  const mods = availableMods(item)
  const specs = choiceSpecs(item, config)
  const errors = validateConfig(item, config)
  const weaponSkill = item.weaponSkill
    ? allSkills.find((skill) => skill.id === item.weaponSkill)?.name
    : undefined

  const total = upgrade
    ? unitPrice(item, config) - unitPrice(item, initial)
    : orderTotal(item, config, quantity, days)
  const affordable = total <= zigs
  const changed =
    !upgrade ||
    config.quality !== initial.quality ||
    config.mods.length !== initial.mods.length ||
    config.enchants.length !== initial.enchants.length ||
    config.qualityBonus !== initial.qualityBonus ||
    JSON.stringify(config.choices) !== JSON.stringify(initial.choices)

  function setQuality(id: QualityId) {
    const slots = qualityById(id).slots
    setConfig((previous) => ({
      ...previous,
      quality: id,
      // Menos slots: sobram só os primeiros modificadores.
      mods: previous.mods.length > slots ? previous.mods.slice(0, slots) : previous.mods,
    }))
  }

  function toggleMod(key: string) {
    if (lockedMods.has(key)) return
    setConfig((previous) => {
      if (previous.mods.includes(key)) {
        return { ...previous, mods: previous.mods.filter((current) => current !== key) }
      }
      if (!modAvailability(item, previous, key).ok) return previous
      return { ...previous, mods: [...previous.mods, key] }
    })
  }

  function toggleEnchant(id: string) {
    if (lockedEnchants.has(id)) return
    setConfig((previous) => ({
      ...previous,
      enchants: previous.enchants.includes(id)
        ? previous.enchants.filter((current) => current !== id)
        : [...previous.enchants, id],
    }))
  }

  function setChoice(key: string, value: string) {
    setConfig((previous) => ({ ...previous, choices: { ...previous.choices, [key]: value } }))
  }

  const lines = item.qualityable ? priceLines(item, config) : []
  const submitDisabled = errors.length > 0 || !affordable || !changed

  return (
    <div className="space-y-5">
      <div>
        <button
          type="button"
          onClick={onCancel}
          className="mb-2 text-xs text-ink-soft transition hover:text-ink"
        >
          ← Voltar
        </button>
        <h3 className="font-display text-xl tracking-wide">{item.name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.description}</p>
        {item.stats ? <p className="mt-1 text-xs text-ink-soft">{item.stats}</p> : null}
      </div>

      {item.qualityable ? (
        <>
          <section aria-label="Qualidade">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Qualidade
            </p>
            <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
              {equipment.qualities.map((option) => {
                const selected = config.quality === option.id
                const blocked = option.level < minQuality
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={blocked}
                    onClick={() => setQuality(option.id)}
                    title={blocked ? 'Não é possível rebaixar a qualidade.' : undefined}
                    className={cn(
                      'rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40',
                      selected ? 'border-accent bg-accent/[0.07]' : 'border-ink/12 hover:border-ink/30',
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{option.name}</span>
                      <span className="text-xs tabular-nums text-ink-soft">
                        {option.extraCost > 0 ? `+${formatZg(option.extraCost)}` : 'preço base'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-soft">
                      {option.slots} slot{option.slots === 1 ? '' : 's'} de modificação
                      {option.level > 0 ? ` · bônus +${option.level}` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              {item.weaponSkill
                ? 'Em armas, a qualidade dá +N dados na perícia OU +N de dano.'
                : 'A qualidade soma +N a cada bônus positivo do item (a RD respeita o RD Máximo).'}
            </p>
          </section>

          {weaponSkill ? (
            <section aria-label="Bônus de qualidade da arma">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                Bônus da qualidade
              </p>
              <div role="radiogroup" className="flex flex-wrap gap-2">
                {(
                  [
                    ['dice', quality.level > 0 ? `+${quality.level}d6 em ${weaponSkill}` : `Dados em ${weaponSkill}`],
                    ['damage', quality.level > 0 ? `+${quality.level} de Dano` : 'Dano'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={config.qualityBonus === value}
                    onClick={() => setConfig((previous) => ({ ...previous, qualityBonus: value }))}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm transition',
                      config.qualityBonus === value
                        ? 'border-accent bg-accent/10'
                        : 'border-ink/15 text-ink-soft hover:border-ink/30 hover:text-ink',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-label="Modificadores">
            <p className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              <span>Modificadores</span>
              <span className="tabular-nums">
                Slots: {config.mods.length} / {quality.slots}
              </span>
            </p>
            {(item.builtinMods ?? []).length > 0 ? (
              <p className="mb-2 text-xs text-ink-soft">
                Já contém:{' '}
                {(item.builtinMods ?? [])
                  .map((key) => {
                    const [kind, id] = key.split(':')
                    return equipment.modifiers[kind as keyof typeof equipment.modifiers]?.mods.find(
                      (mod) => mod.id === id,
                    )?.name
                  })
                  .filter(Boolean)
                  .join(', ')}{' '}
                (não gasta slot).
              </p>
            ) : null}
            {quality.slots === 0 && mods.length > 0 ? (
              <p className="mb-2 text-xs text-ink-soft">
                Qualidade Comum não tem slots. Suba a qualidade para modificar o item.
              </p>
            ) : null}

            <div className="space-y-3">
              {(item.modKinds ?? []).map((kind) => {
                const group = equipment.modifiers[kind]
                const rows = mods.filter((mod) => mod.kind === kind)
                if (rows.length === 0) return null
                return (
                  <div key={kind}>
                    <p className="mb-1 text-xs font-semibold">
                      {group.label}{' '}
                      <span className="font-normal text-ink-soft">· {formatZg(group.cost)} cada</span>
                    </p>
                    <ul className="space-y-1">
                      {rows.map((mod) => {
                        const selected = config.mods.includes(mod.key)
                        const locked = lockedMods.has(mod.key)
                        const availability = modAvailability(item, config, mod.key)
                        const disabled = locked || (!selected && !availability.ok)
                        return (
                          <li key={mod.key}>
                            <label
                              className={cn(
                                'flex items-start gap-2 rounded-md border p-2 text-sm transition',
                                selected ? 'border-accent/50 bg-accent/[0.06]' : 'border-ink/10',
                                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-ink/30',
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={selected}
                                disabled={disabled}
                                onChange={() => toggleMod(mod.key)}
                              />
                              <span className="min-w-0">
                                <span className="font-medium">{mod.def.name}</span>{' '}
                                <span className="text-xs text-ink-soft">{mod.def.description}</span>
                                {!selected && !availability.ok ? (
                                  <span className="mt-0.5 block text-[11px] text-amber-800">
                                    {availability.reason}
                                  </span>
                                ) : null}
                                {locked ? (
                                  <span className="mt-0.5 block text-[11px] text-ink-soft">
                                    Já aplicado.
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>

          <details className="rounded-lg border border-ink/10 p-3" open={config.enchants.length > 0}>
            <summary className="cursor-pointer text-sm font-semibold">
              Encantamentos{' '}
              <span className="font-normal text-ink-soft">
                · {formatZg(enchantCost(item))} cada · sem repetir
                {config.enchants.length > 0 ? ` · ${config.enchants.length} escolhido(s)` : ''}
              </span>
            </summary>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {equipment.enchantments.map((enchant) => {
                const selected = config.enchants.includes(enchant.id)
                const locked = lockedEnchants.has(enchant.id)
                return (
                  <li key={enchant.id}>
                    <label
                      className={cn(
                        'flex h-full items-start gap-2 rounded-md border p-2 text-sm transition',
                        selected ? 'border-accent/50 bg-accent/[0.06]' : 'border-ink/10',
                        locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-ink/30',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected}
                        disabled={locked}
                        onChange={() => toggleEnchant(enchant.id)}
                      />
                      <span className="min-w-0">
                        <span className="font-medium">{enchant.name}</span>{' '}
                        <span className="text-xs text-ink-soft">{enchant.description}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </details>

          {specs.length > 0 ? (
            <section aria-label="Escolhas">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                Escolhas do item
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {specs.map((spec) => {
                  const options =
                    spec.skillIds === 'all'
                      ? allSkills
                      : allSkills.filter((skill) => (spec.skillIds as string[] | undefined)?.includes(skill.id))
                  return (
                    <label key={spec.key} className="block text-xs text-ink-soft">
                      <span className="mb-1 block font-semibold uppercase tracking-wide">{spec.label}</span>
                      {spec.kind === 'skill' ? (
                        <select
                          value={config.choices[spec.key] ?? ''}
                          onChange={(event) => setChoice(spec.key, event.target.value)}
                          className="h-[34px] w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm text-ink"
                        >
                          <option value="">Escolher depois…</option>
                          {options.map((skill) => (
                            <option key={skill.id} value={skill.id}>
                              {skill.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={config.choices[spec.key] ?? ''}
                          onChange={(event) => setChoice(spec.key, event.target.value)}
                          placeholder="Ex.: Fogo"
                          className="h-[34px] w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm text-ink"
                        />
                      )}
                    </label>
                  )
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="space-y-2">
          {item.stackable ? (
            <label className="block text-xs text-ink-soft">
              <span className="mb-1 block font-semibold uppercase tracking-wide">Quantidade</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                className="h-[34px] w-28 rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm text-ink"
              />
            </label>
          ) : null}
          {item.perDay ? (
            <label className="block text-xs text-ink-soft">
              <span className="mb-1 block font-semibold uppercase tracking-wide">
                Dias de salário a pagar agora
              </span>
              <input
                type="number"
                min={1}
                value={days}
                onChange={(event) => setDays(Math.max(1, Number(event.target.value) || 1))}
                className="h-[34px] w-28 rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm text-ink"
              />
            </label>
          ) : null}
          {item.category === 'municao' ? (
            <p className="text-xs text-ink-soft">
              Se quiser contar munição: cada {equipment.ammoRule.costZg} Zg equivalem a{' '}
              {equipment.ammoRule.units} unidades. Esta compra rende cerca de{' '}
              {ammoUnits(item.price * quantity)} unidades.
            </p>
          ) : null}
          {item.priceFrom ? (
            <p className="text-xs text-ink-soft">
              Preço a partir de {formatZg(item.price)}; criaturas raras podem custar mais com o mestre.
            </p>
          ) : null}
        </section>
      )}

      {errors.length > 0 ? (
        <Callout tone="warn">
          <ul className="list-inside list-disc">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <section className="rounded-lg border border-ink/10 bg-ink/[0.03] p-3 text-sm" aria-label="Preço">
        {lines.length > 0 ? (
          <ul className="space-y-0.5">
            {lines.map((line, index) => (
              <li key={`${line.label}-${index}`} className="flex justify-between gap-3">
                <span className="text-ink-soft">{line.label}</span>
                <span className="tabular-nums">{formatZg(line.amount)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 flex items-baseline justify-between gap-3 border-t border-ink/10 pt-2">
          <span className="font-semibold">{upgrade ? 'Custo da melhoria' : 'Total'}</span>
          <span className="font-display text-xl tabular-nums">{formatZg(total)}</span>
        </p>
        <p className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-ink-soft">
          <span>Saldo: {formatZg(zigs)}</span>
          {item.qualityable ? (
            <span title={equipment.craftDc}>
              DC base para criar/modificar: {craftDc(upgrade ? unitPrice(item, config) : total)}
            </span>
          ) : null}
        </p>
        {!affordable ? (
          <p className="mt-1 text-xs text-amber-800">Faltam {formatZg(total - zigs)}.</p>
        ) : null}
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          disabled={submitDisabled}
          onClick={() => onSubmit({ config, quantity, days })}
        >
          {upgrade ? `Melhorar por ${formatZg(total)}` : `Comprar por ${formatZg(total)}`}
        </Button>
      </div>
    </div>
  )
}
