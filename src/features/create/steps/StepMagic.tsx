import { useMemo, useState } from 'react'
import { ArcanaeHexagon } from '@/components/ArcanaeHexagon'
import { Badge, Callout, Card, SectionTitle } from '@/components/ui'
import { cn } from '@/lib/cn'
import { RuneHand } from './RuneHand'
import {
  channelingMethods,
  circleOrder,
  circleRelation,
  circleRelationLabels,
  circleRelationRules,
  circles,
  runeCircleLabels,
} from '@/rules/amnia'
import { circleColor } from '@/rules/circleColors'
import { runeAllowance } from '@/rules/character'
import { withAlpha } from '@/rules/lineageColors'
import { findLineage, findLineageTrait } from '@/rules/lineages'
import { runes, type RuneCircleId } from '@/rules/data'
import { checkRequirement, type RequirementCheck } from '@/rules/requirements'
import {
  runeGrantLabel,
  runeGrants,
  traitGrantedRuneIds,
  traitRuneSlots,
} from '@/rules/traitGrants'
import { useDraft } from '@/store/draft'

const RUNE_CIRCLES: RuneCircleId[] = [...circleOrder, 'miscelanea']
const RUNE_CIRCLE_LABELS = runeCircleLabels

/** Formata o modificador de custo com o sinal tipográfico (−) em vez do hífen. */
function formatModifier(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `−${Math.abs(value)}`
  return '0'
}

export function StepMagic() {
  const character = useDraft((state) => state.character)
  const patch = useDraft((state) => state.patch)
  const setChannelingMethod = useDraft((state) => state.setChannelingMethod)
  const toggleKnownRune = useDraft((state) => state.toggleKnownRune)

  const [filter, setFilter] = useState<RuneCircleId | 'known'>('reforco')

  const known = character.knownRunes
  const lineage = findLineage(character.ancestryId)
  const traitIds = [...character.ancestryTraits, ...character.negativeTraits]
  const grantedRunes = runeGrants(traitIds)
  const grantedRuneIds = traitGrantedRuneIds(traitIds)
  const grantedSlots = traitRuneSlots(traitIds)
  const baseAllowance = runeAllowance(character.attributes.inteligencia)
  const allowance = baseAllowance + grantedSlots
  const remaining = allowance - known.length
  const innate = circles.find((item) => item.id === character.innateCircle) ?? null

  const catalog = useMemo(() => {
    const list =
      filter === 'known'
        ? runes.filter((rune) => known.includes(rune.id))
        : runes.filter((rune) => rune.circle === filter)
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [filter, known])

  /** Requisito de cada carta do catálogo atual (bloqueia só o que é verificável). */
  const requirementChecks = useMemo(() => {
    const checks: Record<string, RequirementCheck> = {}
    for (const rune of catalog) {
      checks[rune.id] = checkRequirement(rune.requirement, character)
    }
    return checks
  }, [catalog, character])

  const blockedCount = catalog.filter(
    (rune) =>
      !known.includes(rune.id) && requirementChecks[rune.id]?.status === 'unmet',
  ).length

  const relation =
    filter !== 'known' && filter !== 'miscelanea' && character.innateCircle
      ? circleRelationRules[circleRelation(character.innateCircle, filter)]
      : null

  return (
    <div className="space-y-6">
      <SectionTitle hint="Como a sua mana é moldada e por quais Esferas ela passa.">
        3 · Círculo & Runas
      </SectionTitle>

      <Card>
        <h3 className="font-display text-lg tracking-wide">Círculo Inato</h3>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          A Esfera com que você nasceu. Runas dela custam −1 PM; opostas custam +2 PM.
        </p>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <ArcanaeHexagon
              innate={character.innateCircle}
              onChange={(id) => patch({ innateCircle: id })}
            />
            <p className="mt-2 text-center text-xs text-ink-soft">
              Clique em uma Esfera para defini-la como o seu Círculo Inato.
            </p>
          </div>

          <div className="space-y-3">
            {innate ? (
              <div className="rounded-lg border border-ink/12 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-lg tracking-wide">{innate.name}</h4>
                  <Badge tone="accent">inata</Badge>
                </div>
                <p className="mt-1 text-sm leading-snug text-ink-soft">{innate.description}</p>
                <p className="mt-1 text-xs italic text-ink-soft/80">{innate.examples}</p>
              </div>
            ) : (
              <Callout tone="warn">Escolha o seu Círculo Inato no hexágono.</Callout>
            )}

            {character.innateCircle ? (
              <div className="overflow-hidden rounded-lg border border-ink/10">
                <table className="w-full text-sm">
                  <thead className="bg-ink/[0.04] text-left text-[11px] uppercase tracking-wide text-ink-soft">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Esfera</th>
                      <th className="px-3 py-2 font-semibold">Relação</th>
                      <th className="px-3 py-2 text-right font-semibold">Custo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/8">
                    {circleOrder.map((id) => {
                      const item = circles.find((entry) => entry.id === id)
                      const relation = circleRelation(character.innateCircle!, id)
                      const rule = circleRelationRules[relation]
                      return (
                        <tr key={id} className={relation === 'inata' ? 'bg-gold/[0.08]' : undefined}>
                          <td className="px-3 py-2">{item?.name}</td>
                          <td className="px-3 py-2 capitalize text-ink-soft">
                            {circleRelationLabels[relation]}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatModifier(rule.costModifier)} PM
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-lg tracking-wide">Método de Canalização</h3>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Recebe 1 método na criação, no Nível 1. O Nível 2 custa 8 XP.
        </p>

        <div className="grid gap-2">
          {channelingMethods.map((method) => {
            const active = character.channelingMethodId === method.id
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => setChannelingMethod(active ? null : method.id)}
                className={cn(
                  'rounded-lg border p-3 text-left transition',
                  active ? 'border-accent bg-accent/[0.07]' : 'border-ink/12 hover:border-ink/30',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-base tracking-wide">{method.name}</span>
                  {active ? <Badge tone="accent">nível 1</Badge> : null}
                </span>
                <span className="mt-0.5 block text-xs text-ink-soft">{method.description}</span>
                <span className="mt-1 block text-xs text-ink-soft">
                  <strong className="text-ink">Nível 1:</strong> {method.level1}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-lg tracking-wide">Runas Conhecidas</h3>
          <Badge tone={remaining === 0 ? 'ok' : remaining < 0 ? 'warn' : 'gold'}>
            {known.length} / {allowance}
          </Badge>
        </div>
        <p className="mb-4 text-sm text-ink-soft">
          Escolha <strong className="text-ink">quais</strong> runas o personagem conhece: 3 + INT
          (3 + {character.attributes.inteligencia} = {baseAllowance})
          {grantedSlots > 0 ? (
            <>
              {' '}
              + {grantedSlots} de traço{grantedSlots === 1 ? '' : 's'} racial
              {grantedSlots === 1 ? '' : 'is'} = {allowance}
            </>
          ) : (
            <> = {allowance}</>
          )}
          . Clique na carta para marcar ou desmarcar. Aqui só se define o acesso; o nível de cada
          runa é escolhido ao criar uma magia, e a escada abaixo mostra o que ela faz do nível 1 ao
          7. Runas compradas depois custam de 6 a 9 XP conforme a relação com o seu círculo.
        </p>

        {grantedRunes.length > 0 ? (
          <div className="mb-4 rounded-lg border border-emerald-700/20 bg-emerald-700/[0.05] p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
              Runas concedidas por traços raciais
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
              {grantedRunes.map((grant, index) => (
                <li key={`${grant.traitId}-${index}`}>
                  <strong className="text-ink">
                    {findLineageTrait(lineage, grant.traitId)?.name ?? grant.traitId}:
                  </strong>{' '}
                  {runeGrantLabel(grant)}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-ink-soft">
              Runas específicas já entram automaticamente e ficam travadas enquanto o traço
              existir. Runas de escolha devem ser marcadas na carta correspondente.
            </p>
          </div>
        ) : null}

        {remaining < 0 ? (
          <div className="mb-4">
            <Callout tone="warn">
              Você marcou {-remaining} runa(s) a mais do que o limite atual (3 + INT + traços
              raciais). Desmarque
              {-remaining === 1 ? ' uma' : ' algumas'} para continuar.
            </Callout>
          </div>
        ) : null}

        <div className="mb-3 flex flex-wrap gap-1.5">
          {RUNE_CIRCLES.map((id) => {
            const active = filter === id
            const tone = circleColor(id)
            const count = known.filter((runeId) => runes.find((rune) => rune.id === runeId)?.circle === id).length
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                style={
                  tone
                    ? {
                        borderColor: active ? tone : withAlpha(tone, 0.45),
                        backgroundColor: active ? withAlpha(tone, 0.1) : undefined,
                      }
                    : undefined
                }
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition',
                  active
                    ? 'text-ink'
                    : 'border-ink/12 text-ink-soft hover:border-ink/30 hover:text-ink',
                )}
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: tone ?? 'currentColor' }}
                />
                {RUNE_CIRCLE_LABELS[id]}
                {count > 0 ? <span className="tabular-nums text-ink-soft">{count}</span> : null}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setFilter('known')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition',
              filter === 'known'
                ? 'border-accent bg-accent/[0.08] text-ink'
                : 'border-ink/12 text-ink-soft hover:border-ink/30 hover:text-ink',
            )}
          >
            Só as conhecidas
            <span className="tabular-nums text-ink-soft">{known.length}</span>
          </button>
        </div>

        <p className="mb-3 text-xs text-ink-soft">
          {filter === 'known'
            ? 'Mostrando apenas as runas que você já marcou.'
            : filter === 'miscelanea'
              ? 'Miscelânea: não pertence ao hexágono das Esferas.'
              : relation
                ? `Custo de mana desta Esfera: ${formatModifier(relation.costModifier)} PM · ${relation.relation}`
                : 'Escolha o Círculo Inato para ver o custo de mana desta Esfera.'}
          {remaining === 0
            ? ' Limite atingido: desmarque uma runa para escolher outra.'
            : null}
        </p>

        {blockedCount > 0 ? (
          <p className="mb-3 text-xs font-semibold text-red-800">
            {blockedCount} runa{blockedCount === 1 ? '' : 's'} desta lista exige
            {blockedCount === 1 ? '' : 'm'} um requisito que a ficha ainda não cumpre.
          </p>
        ) : null}

        {catalog.length === 0 ? (
          <Callout>
            {filter === 'known' ? 'Nenhuma runa marcada ainda.' : 'Nenhuma runa nesta Esfera.'}
          </Callout>
        ) : (
          <RuneHand
            runes={catalog}
            known={known}
            remaining={remaining}
            requirementChecks={requirementChecks}
            grantedRuneIds={grantedRuneIds}
            grantedCircles={grantedRunes
              .filter((grant) => !grant.conditional)
              .flatMap((grant) => grant.circles ?? [])}
            onToggle={toggleKnownRune}
          />
        )}
      </Card>
    </div>
  )
}
