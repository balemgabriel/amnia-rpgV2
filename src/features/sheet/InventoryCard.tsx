import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { attributes, derivedStats, skills } from '@/rules/amnia'
import {
  choiceSpecs,
  describeBonus,
  equipment,
  formatZg,
  itemBonuses,
  itemById,
  modByKey,
  qualityById,
} from '@/rules/equipment'
import type { InventoryItem } from '@/rules/inventory'
import { priceText } from './EquipmentShop'

const names = {
  skill: (id: string) => skills.find((skill) => skill.id === id)?.name ?? id,
  attribute: (id: string) => attributes.find((attribute) => attribute.id === id)?.short ?? id,
  derived: (id: string) => derivedStats.find((stat) => stat.id === id)?.name ?? id,
}

/**
 * Cartão de um item do inventário (Equipar/Desequipar, Melhorar, Usar 1,
 * Devolver e escolhas). Compartilhado entre a ficha (EquipmentSection) e o
 * assistente de criação (StepEquipment).
 */
export function InventoryCard({
  entry,
  onToggle,
  onUpgrade,
  onGiveBack,
  onUseOne,
  onChoice,
}: {
  entry: InventoryItem
  onToggle: () => void
  onUpgrade: () => void
  onGiveBack: () => void
  onUseOne: () => void
  onChoice: (key: string, value: string) => void
}) {
  const item = itemById(entry.itemId)
  if (!item) return null

  const quality = qualityById(entry.quality)
  const { bonuses, pending } = itemBonuses(entry)
  const specs = choiceSpecs(item, entry)
  const builtin = (item.builtinMods ?? []).map((key) => modByKey(key)?.def.name ?? key)
  const mods = entry.mods.map((key) => modByKey(key)?.def.name ?? key)
  const enchants = entry.enchants.map(
    (id) => equipment.enchantments.find((enchant) => enchant.id === id)?.name ?? id,
  )
  const ally = item.perDay === true

  return (
    <li
      className={cn(
        'rounded-lg border p-3',
        entry.equipped ? 'border-accent/50 bg-accent/[0.05]' : 'border-ink/10 bg-white/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">
            {item.name}
            {item.stackable && entry.quantity > 1 ? (
              <span className="ml-1 text-ink-soft tabular-nums">×{entry.quantity}</span>
            ) : null}
          </h3>
          <p className="text-xs text-ink-soft">
            {ally && entry.days
              ? `${priceText(item)} · ${entry.days} dia(s) pago(s)`
              : `Pago: ${formatZg(entry.paid)}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {item.qualityable && quality.level > 0 ? <Badge tone="gold">{quality.name}</Badge> : null}
          {entry.equipped ? <Badge tone="ok">Equipado</Badge> : null}
        </div>
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{item.description}</p>
      {item.stats ? <p className="mt-1 text-[11px] text-ink-soft">{item.stats}</p> : null}

      {builtin.length + mods.length + enchants.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {builtin.map((name) => (
            <Badge key={`b-${name}`}>Contém Mod {name}</Badge>
          ))}
          {mods.map((name) => (
            <Badge key={`m-${name}`} tone="accent">
              Mod {name}
            </Badge>
          ))}
          {enchants.map((name) => (
            <Badge key={`e-${name}`} tone="gold">
              {name}
            </Badge>
          ))}
        </div>
      ) : null}

      {bonuses.length > 0 ? (
        <p className="mt-2 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
            {entry.equipped ? 'Efeitos ativos' : 'Efeitos ao equipar'}
          </span>
          <br />
          {bonuses.map((bonus) => describeBonus(bonus, names)).join(' · ')}
        </p>
      ) : null}
      {pending.length > 0 ? <p className="mt-1 text-xs text-amber-800">{pending[0]}</p> : null}

      {specs.length > 0 ? (
        <div className="no-print mt-2 grid gap-2 sm:grid-cols-2">
          {specs.map((spec) => {
            const options =
              spec.skillIds === 'all'
                ? skills
                : skills.filter((skill) => (spec.skillIds as string[] | undefined)?.includes(skill.id))
            return (
              <label key={spec.key} className="block text-[11px] text-ink-soft">
                <span className="mb-0.5 block font-semibold uppercase tracking-wide">{spec.label}</span>
                {spec.kind === 'skill' ? (
                  <select
                    value={entry.choices[spec.key] ?? ''}
                    onChange={(event) => onChoice(spec.key, event.target.value)}
                    className="h-8 w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm text-ink"
                  >
                    <option value="">Escolher…</option>
                    {options.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    key={entry.choices[spec.key] ?? ''}
                    defaultValue={entry.choices[spec.key] ?? ''}
                    onBlur={(event) => {
                      if (event.target.value !== (entry.choices[spec.key] ?? '')) {
                        onChoice(spec.key, event.target.value)
                      }
                    }}
                    placeholder="Ex.: Fogo"
                    className="h-8 w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm text-ink"
                  />
                )}
              </label>
            )
          })}
        </div>
      ) : null}

      <div className="no-print mt-3 flex flex-wrap gap-1.5">
        {item.equippable ? (
          <Button
            variant={entry.equipped ? 'primary' : 'ghost'}
            className="px-3 py-1 text-xs"
            aria-pressed={entry.equipped}
            onClick={onToggle}
          >
            {entry.equipped ? 'Desequipar' : 'Equipar'}
          </Button>
        ) : null}
        {item.qualityable ? (
          <Button variant="ghost" className="px-3 py-1 text-xs" onClick={onUpgrade}>
            Melhorar
          </Button>
        ) : null}
        {item.stackable ? (
          <Button variant="ghost" className="px-3 py-1 text-xs" onClick={onUseOne}>
            Usar 1
          </Button>
        ) : null}
        <Button variant="quiet" className="px-3 py-1 text-xs" onClick={onGiveBack}>
          {ally ? 'Dispensar' : `Devolver (+${formatZg(entry.paid)})`}
        </Button>
      </div>
    </li>
  )
}
