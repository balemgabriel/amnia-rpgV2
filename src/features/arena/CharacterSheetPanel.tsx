import { useMemo, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Droplet,
  Flame,
  Footprints,
  Heart,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Scroll,
  Shield,
  Snowflake,
  Sparkles,
  User,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  changeResource,
  limiarTone,
  startTurn,
  suppressMana,
  THREAT_LABELS,
  type LimiarTone,
  type ResourceId,
} from '@/lib/amnia/rules'
import type { ArenaGameState } from '@/lib/amnia/types'
import { impulses } from '@/rules/amnia'
import type { Character } from '@/rules/character'
import { circleColor } from '@/rules/circleColors'
import { classes } from '@/rules/data'
import { findCaste, findLineage, findSublineage, selectedPathOption } from '@/rules/lineages'
import { runeById, runeCircleOf } from '@/rules/runes'
import { effectiveRuneLevel, spellCost } from '@/rules/spell'
import { spellContext } from '@/rules/spellContext'

interface RuneEntry {
  runeId: string
  level: number | null
  spells: string[]
}

/**
 * Painel resumido da ficha ativa, ligado ao estado real da mesa.
 *
 * Os máximos vêm do motor da ficha (`buildSheetSummary` → `computeDerived`); os
 * valores atuais vêm de `ArenaGameState`, que também é enviado ao Mestre.
 */
export function CharacterSheetPanel({
  character,
  state,
  onStateChange,
  onReset,
  demo,
  onBackToCreator,
}: {
  character: Character
  state: ArenaGameState
  onStateChange: (state: ArenaGameState) => void
  onReset: () => void
  demo: boolean
  onBackToCreator: () => void
}) {
  const { pv, pm, limiar, impeto, pa } = state.resources
  const tone = limiarTone(limiar.current, limiar.max)

  const lineage = findLineage(character.ancestryId)
  const sublineage = findSublineage(lineage, character.sublineageId)
  const caste = findCaste(lineage, character.casteId)
  const pathOption = selectedPathOption(lineage, character.ancestryTraits)
  const classDef = classes.find((item) => item.id === character.classId)
  const impulse = impulses.find((item) => item.id === character.impulseId)

  const keyAttributeValue = character.keyAttribute
    ? character.attributes[character.keyAttribute]
    : 0

  const lineageLabel = lineage
    ? [
        lineage.name,
        ...(caste ? [caste.name] : []),
        ...(sublineage ? [sublineage.name] : []),
        ...(pathOption ? [pathOption.name] : []),
      ].join(' · ')
    : null

  const activeRunes = useMemo<RuneEntry[]>(() => {
    const map = new Map<string, RuneEntry>()

    for (const spell of character.spells) {
      for (const rune of spell.runes) {
        const entry = map.get(rune.runeId)
        const level = effectiveRuneLevel(rune, spell)
        if (entry) {
          entry.level = Math.max(entry.level ?? 0, level)
          if (spell.name && !entry.spells.includes(spell.name)) entry.spells.push(spell.name)
        } else {
          map.set(rune.runeId, {
            runeId: rune.runeId,
            level,
            spells: spell.name ? [spell.name] : [],
          })
        }
      }
    }

    if (map.size > 0) return [...map.values()]

    // Nenhuma magia preparada: mostra as runas que o personagem conhece.
    return character.knownRunes.map((runeId) => ({ runeId, level: null, spells: [] }))
  }, [character.spells, character.knownRunes])

  const spellRows = useMemo(() => {
    const context = spellContext(character)
    return character.spells.map((spell) => ({
      id: spell.id,
      name: spell.name || 'Magia sem nome',
      cost: spellCost(spell, context).total,
      effect: spell.effect,
    }))
  }, [character])

  function adjust(id: ResourceId, delta: number) {
    onStateChange(changeResource(state, id, delta))
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-3">
          {character.portrait ? (
            <img
              src={character.portrait}
              alt={`Retrato de ${character.name || 'personagem'}`}
              className="size-14 shrink-0 rounded-xl border border-slate-700/70 object-cover"
            />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-slate-700/70 bg-gradient-to-br from-slate-800 to-slate-950 text-slate-500">
              <User className="size-6" aria-hidden />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Ficha ativa
              </p>
              <span className="shrink-0 rounded-full border border-slate-700/70 bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-400">
                Turno {state.turn}
              </span>
            </div>
            <h2 className="mt-0.5 truncate font-display text-2xl leading-tight tracking-wide text-slate-50">
              {character.name || 'Sem nome'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-300">
              {classDef?.name ?? 'Sem classe'}
              {impulse ? <span className="text-slate-500"> · {impulse.name}</span> : null}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {lineageLabel ?? character.concept ?? 'Sem arquétipo'}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <StatusChip
            tone={state.overloaded ? 'danger' : 'neutral'}
            icon={<Flame className="size-3" aria-hidden />}
          >
            {state.overloaded ? 'Sobrecarga arcana' : 'Limiar estável'}
          </StatusChip>
          <StatusChip
            tone={state.suppressed ? 'warning' : 'neutral'}
            icon={<Snowflake className="size-3" aria-hidden />}
          >
            {state.suppressed ? 'Supressão ativa' : 'Mana fluindo'}
          </StatusChip>
          <StatusChip tone="neutral" icon={<Footprints className="size-3" aria-hidden />}>
            {pa.current}/{pa.max} PA
          </StatusChip>
        </div>

        {demo ? (
          <div className="mt-3 rounded-xl border border-[#F1269C]/30 bg-[#F1269C]/10 p-3">
            <p className="text-xs leading-relaxed text-[#F9A8D4]">
              Você está vendo uma ficha de exemplo criada neste navegador. Abra uma ficha sua
              para jogar com ela.
            </p>
            <button
              type="button"
              onClick={onBackToCreator}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#F1269C]/40 bg-slate-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-[#FBCFE8] transition hover:bg-[#F1269C]/15 hover:text-white"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Voltar ao Criador de Personagens
            </button>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <TableButton
            onClick={() => onStateChange(startTurn(state))}
            icon={<RefreshCw className="size-3.5" aria-hidden />}
            label="Encerrar turno"
            title="Restaura PA e PM; o Limiar não reseta"
          />
          <TableButton
            onClick={() => onStateChange(suppressMana(state, keyAttributeValue))}
            disabled={state.suppressed}
            icon={<Snowflake className="size-3.5" aria-hidden />}
            label="Supressão"
            title={`Resfria o Limiar em ${2 + keyAttributeValue} e corta a mana até o próximo turno`}
          />
          <TableButton
            onClick={onReset}
            icon={<RotateCcw className="size-3.5" aria-hidden />}
            label="Reiniciar"
            title="Volta PV, PM, Limiar, PA e relógios ao início"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="size-4 text-slate-400" aria-hidden />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Recursos vitais
          </h3>
        </div>

        <div className="space-y-2.5">
          <ResourceBar
            icon={<Heart className="size-3.5" aria-hidden />}
            label="PV · Pontos de Vida"
            value={pv.current}
            max={pv.max}
            barClassName="bg-emerald-400"
            iconClassName="border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            onDecrease={() => adjust('pv', -1)}
            onIncrease={() => adjust('pv', 1)}
          />
          <ResourceBar
            icon={<Droplet className="size-3.5" aria-hidden />}
            label="PM · Pontos de Mana"
            value={pm.current}
            max={pm.max}
            barClassName="bg-sky-400"
            iconClassName="border-sky-400/30 bg-sky-400/10 text-sky-300"
            onDecrease={() => adjust('pm', -1)}
            onIncrease={() => adjust('pm', 1)}
          />
          <ResourceBar
            icon={<Flame className="size-3.5" aria-hidden />}
            label="Limiar Arcano"
            value={limiar.current}
            max={limiar.max}
            tone={tone}
            barClassName="bg-sky-400"
            iconClassName="border-sky-400/30 bg-sky-400/10 text-sky-300"
            caption="Carga arcana acumulada. Acima do máximo, a Mácula pode alcançar você."
            onDecrease={() => adjust('limiar', -1)}
            onIncrease={() => adjust('limiar', 1)}
          />
          <ResourceBar
            icon={<Zap className="size-3.5" aria-hidden />}
            label="Ímpeto · Rerrolagens"
            value={impeto.current}
            max={impeto.max}
            barClassName="bg-amber-400"
            iconClassName="border-amber-400/30 bg-amber-400/10 text-amber-300"
            onDecrease={() => adjust('impeto', -1)}
            onIncrease={() => adjust('impeto', 1)}
          />
          <ResourceBar
            icon={<Footprints className="size-3.5" aria-hidden />}
            label="PA · Pontos de Ação"
            value={pa.current}
            max={pa.max}
            barClassName="bg-violet-400"
            iconClassName="border-violet-400/30 bg-violet-400/10 text-violet-300"
            caption="Resetam no início do turno. Reações usam o PA restante."
            onDecrease={() => adjust('pa', -1)}
            onIncrease={() => adjust('pa', 1)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-slate-400" aria-hidden />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Relógios de ameaça
            </h3>
          </div>
          <span className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-400">
            {state.clocks.length}
          </span>
        </div>

        {state.clocks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/70 px-3 py-4 text-center">
            <Clock3 className="mx-auto size-5 text-slate-600" aria-hidden />
            <p className="mt-2 text-xs text-slate-500">
              Nenhum relógio ativo. Inimigos significativos entram aqui quando o Mestre os
              apresenta.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {state.clocks.map((clock) => {
              const completed = clock.current >= clock.max
              return (
                <li
                  key={clock.id}
                  className={cn(
                    'rounded-xl border px-2.5 py-2',
                    completed
                      ? 'border-amber-500/40 bg-amber-500/[0.06]'
                      : 'border-slate-800/80 bg-slate-900/45',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-slate-100">
                      {clock.name}
                    </p>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-400">
                      {clock.current}/{clock.max}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-950/80">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        completed ? 'bg-amber-400' : 'bg-[#F1269C]',
                      )}
                      style={{ width: `${Math.min(100, Math.round((clock.current / clock.max) * 100))}%` }}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                    <span>{THREAT_LABELS[clock.kind]}</span>
                    {clock.resilient ? (
                      <span className="rounded border border-slate-700/70 px-1 py-0.5 font-semibold uppercase tracking-wide text-slate-400">
                        resiliente
                      </span>
                    ) : null}
                    {completed ? (
                      <span className="font-semibold uppercase tracking-wide text-amber-300">
                        completo
                      </span>
                    ) : null}
                  </div>
                  {clock.notes ? (
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-600">{clock.notes}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-slate-400" aria-hidden />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Runas equipadas
            </h3>
          </div>
          <span className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-400">
            {activeRunes.length}
          </span>
        </div>

        {activeRunes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/70 px-3 py-5 text-center">
            <Scroll className="mx-auto size-5 text-slate-600" aria-hidden />
            <p className="mt-2 text-xs text-slate-500">
              Nenhuma runa equipada. Crie uma magia na ficha para vê-la aqui.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {activeRunes.map((entry) => {
              const rune = runeById(entry.runeId)
              const toneColor = circleColor(runeCircleOf(entry.runeId)) ?? '#94a3b8'

              return (
                <li
                  key={entry.runeId}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/45 px-2.5 py-2"
                >
                  <span
                    className="size-2 shrink-0 rounded-full ring-2 ring-slate-950/60"
                    style={{ backgroundColor: toneColor, boxShadow: `0 0 10px ${toneColor}66` }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {rune?.name ?? entry.runeId}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {entry.spells.length > 0 ? entry.spells.join(' · ') : 'Conhecida'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-slate-700/70 bg-slate-950/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-300">
                    {entry.level !== null ? `Nv ${entry.level}` : 'Runa'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {spellRows.length > 0 ? (
        <section className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="mb-3 flex items-center gap-2">
            <Scroll className="size-4 text-slate-400" aria-hidden />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Magias preparadas
            </h3>
          </div>
          <ul className="space-y-1.5">
            {spellRows.map((spell) => (
              <li
                key={spell.id}
                className="rounded-xl border border-slate-800/80 bg-slate-900/45 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-slate-100">
                    {spell.name}
                  </p>
                  <span className="shrink-0 rounded-md border border-[#0055FE]/40 bg-[#0055FE]/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#93B4FF]">
                    {spell.cost} PM
                  </span>
                </div>
                {spell.effect ? (
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                    {spell.effect}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function StatusChip({
  tone,
  icon,
  children,
}: {
  tone: 'neutral' | 'warning' | 'danger'
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        tone === 'danger'
          ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
          : tone === 'warning'
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            : 'border-slate-700/70 bg-slate-900/60 text-slate-400',
      )}
    >
      {icon}
      {children}
    </span>
  )
}

function TableButton({
  onClick,
  icon,
  label,
  title,
  disabled,
}: {
  onClick: () => void
  icon: ReactNode
  label: string
  title: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700/70 bg-slate-900/70 px-2 py-1.5 text-[10px] font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-700/70 disabled:hover:bg-slate-900/70"
    >
      {icon}
      {label}
    </button>
  )
}

const TONE_BAR: Record<LimiarTone, string> = {
  safe: 'bg-sky-400',
  warn: 'bg-amber-400',
  overload: 'bg-rose-500',
}

function ResourceBar({
  icon,
  label,
  value,
  max,
  tone = 'safe',
  barClassName,
  iconClassName,
  caption,
  onDecrease,
  onIncrease,
}: {
  icon: ReactNode
  label: string
  value: number
  max: number
  tone?: LimiarTone
  barClassName?: string
  iconClassName: string
  caption?: string
  onDecrease: () => void
  onIncrease: () => void
}) {
  const isLimiar = label.startsWith('Limiar')
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const overloaded = isLimiar && tone === 'overload'
  const nearLimit = isLimiar && tone === 'warn'

  return (
    <div
      className={cn(
        'rounded-xl border p-2.5 transition',
        overloaded
          ? 'animate-pulse border-rose-500/60 bg-rose-500/[0.07]'
          : nearLimit
            ? 'border-amber-500/50 bg-amber-500/[0.05]'
            : 'border-slate-800/80 bg-slate-900/45',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-lg border',
              iconClassName,
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {label}
            </p>
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                overloaded ? 'text-rose-200' : 'text-slate-100',
              )}
            >
              {value}
              <span className="text-slate-600"> / {max}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <StepButton label={`Diminuir ${label}`} onClick={onDecrease} disabled={value <= 0}>
            <Minus className="size-3" aria-hidden />
          </StepButton>
          <StepButton
            label={`Aumentar ${label}`}
            onClick={onIncrease}
            disabled={value >= (isLimiar ? max + 99 : max)}
          >
            <Plus className="size-3" aria-hidden />
          </StepButton>
        </div>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-950/80">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isLimiar ? TONE_BAR[tone] : barClassName,
            overloaded && 'shadow-[0_0_14px_rgba(244,63,94,0.75)]',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {overloaded ? (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
          <AlertTriangle className="size-3" aria-hidden />
          Sobrecarga — magia exige SAVE contra Mácula
        </p>
      ) : nearLimit ? (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
          <AlertTriangle className="size-3" aria-hidden />
          Limiar perto do limite
        </p>
      ) : caption ? (
        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">{caption}</p>
      ) : null}
    </div>
  )
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-6 place-items-center rounded-md border border-slate-700/70 bg-slate-950/50 text-slate-400 transition hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-slate-700/70 disabled:hover:text-slate-400"
    >
      {children}
    </button>
  )
}
