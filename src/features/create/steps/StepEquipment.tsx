import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button, Callout, Card, SectionTitle } from '@/components/ui'
import { attributes, derivedStats, skills } from '@/rules/amnia'
import {
  activeBonuses,
  categoryLabels,
  categoryOrder,
  configFromInventory,
  consumeOne,
  describeBonus,
  formatZg,
  itemById,
  purchaseItem,
  refundItem,
  setChoice,
  toggleEquipped,
  upgradeItem,
  type ItemCategory,
} from '@/rules/equipment'
import { InventoryCard } from '@/features/sheet/InventoryCard'
import { EquipmentShop } from '@/features/sheet/EquipmentShop'
import { ItemConfigurator, type ConfiguredOrder } from '@/features/sheet/ItemConfigurator'
import { useDraft } from '@/store/draft'

const names = {
  skill: (id: string) => skills.find((skill) => skill.id === id)?.name ?? id,
  attribute: (id: string) => attributes.find((attribute) => attribute.id === id)?.short ?? id,
  derived: (id: string) => derivedStats.find((stat) => stat.id === id)?.name ?? id,
}

/**
 * Página 8 do assistente de criação: Equipamento. Reaproveita a loja, o
 * configurador e os cartões de inventário da ficha; tudo é gravado no rascunho
 * (zigs + inventory) e salvo junto com a ficha em "Finalizar". Itens equipados
 * já aparecem nos derivados da etapa anterior porque computeDerived lê o
 * inventário do personagem.
 */
export function StepEquipment() {
  const character = useDraft((state) => state.character)
  const patch = useDraft((state) => state.patch)

  const [shopOpen, setShopOpen] = useState(false)
  const [upgradeId, setUpgradeId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const inventory = character.inventory
  const active = activeBonuses(inventory)
  const upgradeEntry = inventory.find((entry) => entry.id === upgradeId)
  const upgradeItemDef = upgradeEntry ? itemById(upgradeEntry.itemId) : undefined

  function commit(next: Partial<Pick<typeof character, 'zigs' | 'inventory'>>) {
    patch(next)
  }

  function buy(itemId: string, order: ConfiguredOrder): string | null {
    const result = purchaseItem(character.zigs, inventory, {
      id: crypto.randomUUID(),
      itemId,
      config: order.config,
      quantity: order.quantity,
      days: order.days,
    })
    if (!result.ok) return result.reason
    commit({ zigs: result.zigs, inventory: result.inventory })
    return null
  }

  function upgrade(order: ConfiguredOrder) {
    if (!upgradeEntry) return
    const result = upgradeItem(character.zigs, inventory, upgradeEntry.id, order.config)
    if (!result.ok) {
      setNotice(result.reason)
      return
    }
    commit({ zigs: result.zigs, inventory: result.inventory })
    setNotice(null)
    setUpgradeId(null)
  }

  function giveBack(entryId: string) {
    const entry = inventory.find((item) => item.id === entryId)
    if (!entry) return
    const item = itemById(entry.itemId)
    if (!item) return
    const ally = item.perDay === true
    const message = ally
      ? `Dispensar "${item.name}"? Os dias já pagos não são reembolsados.`
      : `Devolver "${item.name}" e receber ${formatZg(entry.paid)} de volta?`
    if (!window.confirm(message)) return
    const result = refundItem(character.zigs, inventory, entry.id)
    commit({ zigs: result.zigs, inventory: result.inventory })
  }

  function adjustBalance(value: string) {
    const next = Math.max(0, Math.floor(Number(value)))
    if (!Number.isFinite(next) || next === character.zigs) return
    commit({ zigs: next })
  }

  const rd = active.rd
  const hasRd =
    rd.fisico > 0 || rd.magico > 0 || rd.geral > 0 || rd.tipos.length > 0 || rd.condicionais.length > 0
  const hasTests = active.tests.length > 0

  return (
    <div className="space-y-6">
      <SectionTitle hint="Opcional — gaste seus Zg em armas, armaduras, poções e aliados. Pode ajustar depois na ficha.">
        8 · Equipamentos
      </SectionTitle>

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                Saldo
              </p>
              <p className="font-display text-3xl leading-tight tabular-nums">
                {formatZg(character.zigs)}
              </p>
            </div>
            <label className="block text-xs text-ink-soft">
              <span className="mb-1 block font-semibold uppercase tracking-wide">
                Ajustar saldo (Zg)
              </span>
              <input
                key={character.zigs}
                type="number"
                min={0}
                defaultValue={character.zigs}
                onBlur={(event) => adjustBalance(event.target.value)}
                className="h-[34px] w-28 rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm text-ink"
              />
            </label>
          </div>
          <Button onClick={() => setShopOpen(true)} className="px-3 py-1.5 text-xs">
            Abrir loja de equipamentos
          </Button>
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
            Nenhum equipamento ainda. Abra a loja para comprar armas, armaduras, acessórios,
            poções, aliados e companheiros — ou apenas continue, dá para comprar tudo depois na
            ficha.
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
                        onToggle={() => commit({ inventory: toggleEquipped(inventory, entry.id) })}
                        onUpgrade={() => {
                          setNotice(null)
                          setUpgradeId(entry.id)
                        }}
                        onGiveBack={() => giveBack(entry.id)}
                        onUseOne={() => commit({ inventory: consumeOne(inventory, entry.id) })}
                        onChoice={(key, value) =>
                          commit({ inventory: setChoice(inventory, entry.id, key, value) })
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
      </Card>

      <EquipmentShop
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        zigs={character.zigs}
        onPurchase={(itemId, order) => Promise.resolve(buy(itemId, order))}
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
              onSubmit={(order) => upgrade(order)}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
