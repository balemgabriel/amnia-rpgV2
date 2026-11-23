import { useState } from 'react'
import { Badge, Button, Callout, Card } from '@/components/ui'
import { xpCosts } from '@/rules/amnia'
import type { Character } from '@/rules/character'
import {
  totalXpSpent,
  xpAvailable,
  xpCostItem,
  xpItemNeedsLevel,
  XP_POOL,
  type XpPurchase,
} from '@/rules/xp'
import {
  applyXpPurchase,
  revertXpPurchase,
  runeXpRelation,
  xpCostFor,
  xpPurchaseTargets,
  xpSuggestedLevel,
} from '@/rules/xpPurchase'

/**
 * Cartão de experiência da ficha.
 *
 * Diferente de um simples recibo, cada compra altera o personagem: comprar uma
 * runa adjacente adiciona a runa, comprar um atributo sobe o atributo, e assim
 * por diante. Remover a linha desfaz o efeito registrado.
 */
export function XpSection({
  character,
  onChange,
}: {
  character: Character
  onChange: (next: Character) => Promise<void> | void
}) {
  const [itemId, setItemId] = useState('pericia')
  const initialTarget = xpPurchaseTargets(itemId, character)[0]?.id ?? ''
  const [targetId, setTargetId] = useState(initialTarget)
  const [level, setLevel] = useState(() => xpSuggestedLevel(itemId, initialTarget, character))
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const spent = totalXpSpent(character.xpPurchases)
  const available = xpAvailable(character.xpPurchases, character.xpEarned)
  const preview = xpCostFor(character, { itemId, targetId, level })
  const targets = xpPurchaseTargets(itemId, character)
  const needsTarget = targets.length > 0
  const needsLevel = xpItemNeedsLevel(xpCostItem(itemId))
  const runeRelation = itemId.startsWith('runa-') ? runeXpRelation(character, targetId) : null

  function changeItem(nextItem: string) {
    const nextTarget = xpPurchaseTargets(nextItem, character)[0]?.id ?? ''
    setItemId(nextItem)
    setTargetId(nextTarget)
    setLevel(xpSuggestedLevel(nextItem, nextTarget, character))
    setLabel('')
    setMessage(null)
  }

  function changeTarget(nextTarget: string) {
    setTargetId(nextTarget)
    setLevel(xpSuggestedLevel(itemId, nextTarget, character))
    setMessage(null)
  }

  async function buy() {
    setMessage(null)
    const result = applyXpPurchase(character, { itemId, targetId, level, label })
    if (!result) {
      setMessage(
        !needsTarget
          ? 'Escolha um alvo válido para esta compra.'
          : 'Não foi possível aplicar a compra. O alvo pode estar no máximo ou já registrado.',
      )
      return
    }
    const next = {
      ...character,
      ...result.patch,
      xpPurchases: [...character.xpPurchases, result.purchase],
    }
    await onChange(next)
    setLabel('')
    setLevel(xpSuggestedLevel(itemId, targetId, next))
  }

  async function removePurchase(purchase: XpPurchase) {
    const revert = revertXpPurchase(character, purchase)
    await onChange({
      ...character,
      ...revert,
      xpPurchases: character.xpPurchases.filter((item) => item.id !== purchase.id),
    })
  }

  function adjustEarned(raw: string) {
    const value = Math.max(0, Number.parseInt(raw, 10) || 0)
    if (value !== character.xpEarned) void onChange({ ...character, xpEarned: value })
  }

  return (
    <Card id="experiencia" className="print-avoid-break scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-wide">Experiência</h2>
          <p className="mt-0.5 max-w-xl text-xs text-ink-soft">
            Pool inicial de {XP_POOL} XP mais a XP recebida em jogo. Cada compra abaixo é aplicada
            diretamente na ficha.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              XP recebida em jogo
            </span>
            <input
              key={character.xpEarned}
              type="number"
              min={0}
              defaultValue={character.xpEarned}
              onBlur={(event) => adjustEarned(event.currentTarget.value)}
              aria-label="XP recebida em jogo"
              className="h-[34px] w-24 rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm tabular-nums focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
          <div className="text-right">
            <Badge tone={available < 0 ? 'warn' : 'ok'}>{available} XP disponível(eis)</Badge>
            <p className="mt-1 text-xs tabular-nums text-ink-soft">
              recebida: {character.xpEarned} · gasta: {spent}
            </p>
          </div>
        </div>
      </div>

      {character.xpPurchases.length === 0 ? (
        <p className="text-sm text-ink-soft">Nenhum gasto de XP registrado ainda.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink/15 text-left text-[10px] uppercase tracking-[0.14em] text-ink-soft">
              <th className="py-1.5 font-semibold">Gasto</th>
              <th className="py-1.5 font-semibold">Cálculo</th>
              <th className="py-1.5 text-right font-semibold">XP</th>
              <th className="no-print w-16" />
            </tr>
          </thead>
          <tbody>
            {character.xpPurchases.map((purchase) => (
              <tr key={purchase.id} className="border-b border-ink/8">
                <td className="py-1.5">
                  {purchase.label}
                  {purchase.effect ? (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                      na ficha
                    </span>
                  ) : null}
                </td>
                <td className="py-1.5 text-xs text-ink-soft">{purchase.detail}</td>
                <td className="py-1.5 text-right tabular-nums">{purchase.cost}</td>
                <td className="no-print py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => void removePurchase(purchase)}
                    className="text-xs text-ink-soft transition hover:text-accent"
                  >
                    remover
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td
                colSpan={2}
                className="pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft"
              >
                Total gasto
              </td>
              <td className="pt-2 text-right font-semibold tabular-nums">{spent}</td>
              <td className="no-print" />
            </tr>
          </tbody>
        </table>
      )}

      <div className="no-print mt-4 rounded-lg border border-ink/10 bg-ink/[0.03] p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Comprar com XP
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.5rem_minmax(0,1fr)_auto]">
          <select
            value={itemId}
            onChange={(event) => changeItem(event.target.value)}
            aria-label="Item da tabela de experiência"
            className="h-[34px] w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm"
          >
            {xpCosts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.cost}
              </option>
            ))}
          </select>
          {needsTarget ? (
            <select
              value={targetId}
              onChange={(event) => changeTarget(event.target.value)}
              aria-label="O que está sendo comprado"
              className="h-[34px] w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm"
            >
              {targets.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                  {option.hint ? ` · ${option.hint}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="flex h-[34px] items-center text-xs text-ink-soft">Sem alvo (técnica)</p>
          )}
          <input
            type="number"
            min={1}
            value={level}
            disabled={!needsLevel}
            onChange={(event) => setLevel(Math.max(1, Number(event.target.value) || 1))}
            aria-label="Nível ou quantidade"
            title={needsLevel ? 'Nível atual / quantidade' : 'Este item tem custo fixo'}
            className="h-[34px] w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm tabular-nums disabled:opacity-40"
          />
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Detalhe (opcional)"
            className="h-[34px] w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm"
          />
          <Button type="button" onClick={() => void buy()} className="h-[34px] px-3 text-xs">
            + {preview} XP
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-soft">
          {runeRelation
            ? `Relação com seu círculo: ${runeRelation === 'inata' ? 'Inata' : runeRelation === 'adjacente' ? 'Adjacente' : runeRelation === 'paralela' ? 'Paralela' : 'Oposta'} — a runa entra em Runas Conhecidas.`
            : 'A compra é aplicada na ficha; remover a linha desfaz o efeito.'}
        </p>
        {message ? (
          <Callout tone="warn" >
            <span className="block">{message}</span>
          </Callout>
        ) : null}
      </div>

      <div className="mt-4 border-t border-ink/8 pt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Tabela de custos
        </p>
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {xpCosts.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-3 border-b border-ink/8 pb-1"
            >
              <span>{item.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-ink-soft">{item.cost}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
