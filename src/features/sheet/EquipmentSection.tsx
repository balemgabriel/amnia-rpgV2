import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Badge, Button, Callout, Card } from '@/components/ui'
import { cn } from '@/lib/cn'
import { attributes, derivedStats, skills } from '@/rules/amnia'
import type { Character } from '@/rules/character'
import {
  activeBonuses,
  categoryLabels,
  categoryOrder,
  choiceSpecs,
  configFromInventory,
  consumeOne,
  describeBonus,
  equipment,
  formatZg,
  itemBonuses,
  itemById,
  modByKey,
  purchaseItem,
  qualityById,
  refundItem,
  setChoice,
  toggleEquipped,
  upgradeItem,
  type ItemCategory,
} from '@/rules/equipment'
import type { InventoryItem } from '@/rules/inventory'
import { EquipmentShop, priceText } from './EquipmentShop'
import { ItemConfigurator, type ConfiguredOrder } from './ItemConfigurator'

const names = {
  skill: (id: string) => skills.find((skill) => skill.id === id)?.name ?? id,
  attribute: (id: string) => attributes.find((attribute) => attribute.id === id)?.short ?? id,
  derived: (id: string) => derivedStats.find((stat) => stat.id === id)?.name ?? id,
}

/**
 * Seção opcional "Equipamento" no fim da ficha: saldo em Zg, inventário com
 * Equipar/Desequipar e a loja de equipamentos. Itens equipados mostram seus
 * bônus ao lado dos atributos, perícias e stats (ver SheetView).
 */
export function EquipmentSection({
  character,
  onChange,
}: {
  character: Character
  onChange: (next: Character) => Promise<void>
}) {
  const [shopOpen, setShopOpen] = useState(false)
  const [upgradeId, setUpgradeId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const inventory = character.inventory
  const active = activeBonuses(inventory)
  const upgradeEntry = inventory.find((entry) => entry.id === upgradeId)
  const upgradeItemDef = upgradeEntry ? itemById(upgradeEntry.itemId) : undefined

  async function commit(patch: Partial<Pick<Character, 'zigs' | 'inventory'>>) {
    await onChange({ ...character, ...patch })
  }

  async function buy(itemId: string, order: ConfiguredOrder): Promise<string | null> {
    const result = purchaseItem(character.zigs, inventory, {
      id: crypto.randomUUID(),
      itemId,
      config: order.config,
      quantity: order.quantity,
      days: order.days,
    })
    if (!result.ok) return result.reason
    await commit({ zigs: result.zigs, inventory: result.inventory })
    return null
  }

  async function upgrade(order: ConfiguredOrder) {
    if (!upgradeEntry) return
    const result = upgradeItem(character.zigs, inventory, upgradeEntry.id, order.config)
    if (!result.ok) {
      setNotice(result.reason)
      return
    }
    await commit({ zigs: result.zigs, inventory: result.inventory })
    setNotice(null)
    setUpgradeId(null)
  }

  async function giveBack(entry: InventoryItem) {
    const item = itemById(entry.itemId)
    if (!item) return
    const ally = item.perDay === true
    const message = ally
      ? `Dispensar "${item.name}"? Os dias já pagos não são reembolsados.`
      : `Devolver "${item.name}" e receber ${formatZg(entry.paid)} de volta?`
    if (!window.confirm(message)) return
    const result = refundItem(character.zigs, inventory, entry.id)
    await commit({ zigs: result.zigs, inventory: result.inventory })
  }

  async function adjustBalance(value: string) {
    const next = Math.max(0, Math.floor(Number(value)))
    if (!Number.isFinite(next) || next === character.zigs) return
    await commit({ zigs: next })
  }

  const rd = active.rd
  const hasRd =
    rd.fisico > 0 || rd.magico > 0 || rd.geral > 0 || rd.tipos.length > 0 || rd.condicionais.length > 0
  const hasTests = active.tests.length > 0

  return (
    <Card id="equipamento" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-wide">Equipamento</h2>
          <p className="text-xs text-ink-soft">
            Seção opcional. Compre itens na loja com Zg e marque o que está equipado.
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <Button onClick={() => setShopOpen(true)} className="px-3 py-1.5 text-xs">
            Abrir loja de equipamentos
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Saldo</p>
          <p className="font-display text-3xl leading-tight tabular-nums">{formatZg(character.zigs)}</p>
        </div>
        <label className="no-print block text-xs text-ink-soft">
          <span className="mb-1 block font-semibold uppercase tracking-wide">Ajustar saldo (Zg)</span>
          <input
            key={character.zigs}
            type="number"
            min={0}
            defaultValue={character.zigs}
            onBlur={(event) => void adjustBalance(event.target.value)}
            className="h-[34px] w-28 rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm text-ink"
          />
        </label>
      </div>

      {hasRd || hasTests || active.pending.length > 0 ? (
        <div className="mb-4 space-y-2 rounded-lg border border-ink/10 bg-ink/[0.03] p-3 text-sm">
          {hasRd ? (
            <p>
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                Redução de dano
              </span>
              <span className="tabular-nums">
                RD {rd.geral} · RDF {rd.fisico} · RDM {rd.magico}
              </span>
              {rd.tipos.map((tipo) => (
                <span key={`${tipo.label}-${tipo.source}`} className="ml-2 tabular-nums">
                  · RD ({tipo.label}) {tipo.amount}
                </span>
              ))}
              {rd.condicionais.length > 0 ? (
                <span className="block text-xs text-ink-soft">
                  Condicionais:{' '}
                  {rd.condicionais
                    .map((item) => `${item.label} +${item.amount} ${item.condition} (${item.source})`)
                    .join(' · ')}
                </span>
              ) : null}
            </p>
          ) : null}
          {hasTests ? (
            <p className="text-xs text-ink-soft">
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
                Outros bônus ativos
              </span>
              {active.tests
                .map((bonus) => `${describeBonus(bonus, names)} (${bonus.source})`)
                .join(' · ')}
            </p>
          ) : null}
          {active.pending.map((pending) => (
            <p key={pending.message} className="text-xs text-amber-800">
              {pending.message}
            </p>
          ))}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-3">
          <Callout tone="warn">{notice}</Callout>
        </div>
      ) : null}

      {inventory.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Nenhum equipamento ainda. Abra a loja para comprar armas, armaduras, acessórios, poções,
          aliados e companheiros.
        </p>
      ) : (
        <div className="space-y-5">
          {categoryOrder.map((category: ItemCategory) => {
            const entries = inventory.filter((entry) => itemById(entry.itemId)?.category === category)
            if (entries.length === 0) return null
            return (
              <section key={category}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  {categoryLabels[category]}
                </p>
                <ul className="grid gap-2 md:grid-cols-2">
                  {entries.map((entry) => (
                    <InventoryCard
                      key={entry.id}
                      entry={entry}
                      onToggle={() =>
                        void commit({ inventory: toggleEquipped(inventory, entry.id) })
                      }
                      onUpgrade={() => {
                        setNotice(null)
                        setUpgradeId(entry.id)
                      }}
                      onGiveBack={() => void giveBack(entry)}
                      onUseOne={() => void commit({ inventory: consumeOne(inventory, entry.id) })}
                      onChoice={(key, value) =>
                        void commit({ inventory: setChoice(inventory, entry.id, key, value) })
                      }
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {active.notes.length > 0 ? (
        <ul className="mt-3 list-inside list-disc text-xs text-ink-soft">
          {active.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <EquipmentShop
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        zigs={character.zigs}
        onPurchase={buy}
      />

      <Modal
        open={Boolean(upgradeEntry && upgradeItemDef)}
        onClose={() => setUpgradeId(null)}
        label="Melhorar item"
        className="max-w-3xl"
      >
        {upgradeEntry && upgradeItemDef ? (
          <div className="rounded-xl border border-ink/15 bg-parchment p-5 shadow-xl">
            <h2 className="mb-3 font-display text-2xl tracking-wide">Melhorar item</h2>
            <ItemConfigurator
              key={upgradeEntry.id}
              item={upgradeItemDef}
              mode="upgrade"
              initial={configFromInventory(upgradeEntry)}
              zigs={character.zigs}
              onCancel={() => setUpgradeId(null)}
              onSubmit={(order) => void upgrade(order)}
            />
          </div>
        ) : null}
      </Modal>
    </Card>
  )
}

function InventoryCard({
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
