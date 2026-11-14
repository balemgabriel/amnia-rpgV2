import { useMemo, useState } from 'react'
import { Modal } from '@/components/Modal'
import { Badge, Button, TextInput } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  categoryLabels,
  categoryOrder,
  equipment,
  formatZg,
  modByKey,
  type ItemCategory,
  type ItemDef,
} from '@/rules/equipment'
import { ItemConfigurator, type ConfiguredOrder } from './ItemConfigurator'

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function priceText(item: ItemDef): string {
  return `${item.priceFrom ? 'a partir de ' : ''}${formatZg(item.price)}${item.perDay ? '/dia' : ''}`
}

/**
 * Loja de equipamentos (opcional). Abre num modal, lista todo o catálogo do
 * Notion por categoria e cobra em Zg do saldo da ficha. `onPurchase` devolve
 * uma mensagem de erro, ou null quando a compra deu certo.
 */
export function EquipmentShop({
  open,
  onClose,
  zigs,
  onPurchase,
}: {
  open: boolean
  onClose: () => void
  zigs: number
  onPurchase: (itemId: string, order: ConfiguredOrder) => Promise<string | null>
}) {
  const [category, setCategory] = useState<ItemCategory | 'todas'>('arma-corpo')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ItemDef | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  const items = useMemo(() => {
    const term = normalize(query.trim())
    return equipment.items.filter((item) => {
      if (category !== 'todas' && item.category !== category) return false
      if (!term) return true
      return normalize(`${item.name} ${item.description}`).includes(term)
    })
  }, [category, query])

  function close() {
    setSelected(null)
    setMessage(null)
    onClose()
  }

  async function submit(order: ConfiguredOrder) {
    if (!selected) return
    const error = await onPurchase(selected.id, order)
    if (error) {
      setMessage({ tone: 'warn', text: error })
      return
    }
    setMessage({ tone: 'ok', text: `${selected.name} adicionado ao seu equipamento.` })
    setSelected(null)
  }

  return (
    <Modal open={open} onClose={close} label="Loja de equipamentos" className="max-w-4xl">
      <div className="rounded-xl border border-ink/15 bg-parchment p-5 shadow-xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl tracking-wide">Loja de Equipamentos</h2>
            <p className="text-xs text-ink-soft">
              Todo equipamento é comprado com Zg. Melhorar um item é mais barato do que comprar um
              novo do zero.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="gold">Saldo: {formatZg(zigs)}</Badge>
            <Button variant="ghost" onClick={close} className="px-3 py-1.5 text-xs">
              Fechar
            </Button>
          </div>
        </div>

        {message ? (
          <p
            role="status"
            className={cn(
              'mb-3 rounded-md px-3 py-2 text-sm',
              message.tone === 'ok'
                ? 'bg-emerald-700/10 text-emerald-900'
                : 'bg-amber-600/10 text-amber-900',
            )}
          >
            {message.text}
          </p>
        ) : null}

        {selected ? (
          <ItemConfigurator
            key={selected.id}
            item={selected}
            mode="buy"
            zigs={zigs}
            onCancel={() => setSelected(null)}
            onSubmit={(order) => void submit(order)}
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(['todas', ...categoryOrder] as const).map((id) => {
                const count =
                  id === 'todas'
                    ? equipment.items.length
                    : equipment.items.filter((item) => item.category === id).length
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(id)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs transition',
                      category === id
                        ? 'border-accent bg-accent/[0.08] text-ink'
                        : 'border-ink/12 text-ink-soft hover:border-ink/30 hover:text-ink',
                    )}
                  >
                    {id === 'todas' ? 'Todas' : categoryLabels[id]}{' '}
                    <span className="tabular-nums text-ink-soft">{count}</span>
                  </button>
                )
              })}
            </div>

            <div className="mb-3">
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar item pelo nome ou efeito…"
              />
            </div>

            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">Nenhum item encontrado.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {items.map((item) => {
                  const afford = item.price <= zigs
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col justify-between rounded-lg border border-ink/10 bg-white/45 p-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold leading-tight">{item.name}</h3>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">
                            {priceText(item)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-ink-soft">{item.description}</p>
                        {item.stats ? (
                          <p className="mt-1 text-[11px] text-ink-soft">{item.stats}</p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(item.builtinMods ?? []).map((key) => (
                            <Badge key={key} tone="gold">
                              Contém Mod {modByKey(key)?.def.name ?? key}
                            </Badge>
                          ))}
                          {item.rdMax === 0 ? <Badge tone="warn">RD Máx 0</Badge> : null}
                          {item.qualityable ? <Badge>Qualidade</Badge> : null}
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="ghost"
                          className="px-3 py-1.5 text-xs"
                          onClick={() => {
                            setMessage(null)
                            setSelected(item)
                          }}
                          title={afford ? undefined : 'Saldo insuficiente para o preço base.'}
                        >
                          {item.qualityable ? 'Configurar e comprar' : 'Comprar'}
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
