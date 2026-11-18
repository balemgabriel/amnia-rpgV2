import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Droplet,
  Flame,
  Heart,
  Minus,
  Plus,
  Scroll,
  Shield,
  Sparkles,
  User,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { impulses } from '@/rules/amnia'
import type { Character } from '@/rules/character'
import { circleColor } from '@/rules/circleColors'
import { classes } from '@/rules/data'
import { computeDerived } from '@/rules/derive'
import { findCaste, findLineage, findSublineage, selectedPathOption } from '@/rules/lineages'
import { runeById, runeCircleOf } from '@/rules/runes'
import { effectiveRuneLevel } from '@/rules/spell'

type ResourceId = 'pv' | 'pm' | 'impeto' | 'limiar'

interface RuneEntry {
  runeId: string
  level: number | null
  spells: string[]
}

/**
 * Painel resumido da ficha ativa. Lê o personagem já validado pela página e
 * calcula PV/PM/Ímpeto/Limiar com as mesmas fórmulas da ficha completa.
 */
export function CharacterSheetPanel({
  character,
  demo,
  onBackToCreator,
}: {
  character: Character
  demo: boolean
  onBackToCreator: () => void
}) {
  const derived = useMemo(
    () => Object.fromEntries(computeDerived(character).map((stat) => [stat.id, stat])),
    [character],
  )
  const maxValue = (id: string) => derived[id]?.value ?? 0

  const max = useMemo(
    () => ({
      pv: maxValue('pv'),
      pm: maxValue('pm'),
      impeto: maxValue('impeto'),
      limiar: maxValue('limiar'),
    }),
    // `derived` muda junto com a ficha; os valores abaixo são derivados dele.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [derived],
  )

  const [resources, setResources] = useState<Record<ResourceId, number>>(() => ({
    pv: max.pv,
    pm: max.pm,
    impeto: max.impeto,
    // No modo demonstração a carga começa no limite para exibir o alerta.
    limiar: demo ? max.limiar : 0,
  }))

  useEffect(() => {
    setResources({
      pv: max.pv,
      pm: max.pm,
      impeto: max.impeto,
      limiar: demo ? max.limiar : 0,
    })
  }, [character.id, demo, max])

  function adjust(id: ResourceId, delta: number) {
    setResources((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(max[id], current[id] + delta)),
    }))
  }

  const lineage = findLineage(character.ancestryId)
  const sublineage = findSublineage(lineage, character.sublineageId)
  const caste = findCaste(lineage, character.casteId)
  const pathOption = selectedPathOption(lineage, character.ancestryTraits)
  const classDef = classes.find((item) => item.id === character.classId)
  const impulse = impulses.find((item) => item.id === character.impulseId)

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
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ficha ativa
            </p>
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

        {demo ? (
          <div className="mt-3 rounded-xl border border-[#F1269C]/30 bg-[#F1269C]/10 p-3">
            <p className="text-xs leading-relaxed text-[#F9A8D4]">
              Você está vendo uma ficha de demonstração. Ela foi criada no localStorage só para
              mostrar o painel — crie ou abra uma ficha sua para jogar com ela.
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
            value={resources.pv}
            max={max.pv}
            barClassName="bg-emerald-400"
            iconClassName="border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            onDecrease={() => adjust('pv', -1)}
            onIncrease={() => adjust('pv', 1)}
          />
          <ResourceBar
            icon={<Droplet className="size-3.5" aria-hidden />}
            label="PM · Pontos de Mana"
            value={resources.pm}
            max={max.pm}
            barClassName="bg-sky-400"
            iconClassName="border-sky-400/30 bg-sky-400/10 text-sky-300"
            onDecrease={() => adjust('pm', -1)}
            onIncrease={() => adjust('pm', 1)}
          />
          <ResourceBar
            icon={<Zap className="size-3.5" aria-hidden />}
            label="SP · Pontos de Ímpeto"
            value={resources.impeto}
            max={max.impeto}
            barClassName="bg-amber-400"
            iconClassName="border-amber-400/30 bg-amber-400/10 text-amber-300"
            onDecrease={() => adjust('impeto', -1)}
            onIncrease={() => adjust('impeto', 1)}
          />
          <ResourceBar
            icon={<Flame className="size-3.5" aria-hidden />}
            label="Limiar Arcano"
            value={resources.limiar}
            max={max.limiar}
            gradient="linear-gradient(90deg, #0055FE 0%, #F1269C 100%)"
            iconClassName="border-[#0055FE]/40 bg-gradient-to-br from-[#0055FE]/20 to-[#F1269C]/20 text-[#F9A8D4]"
            caption="Carga arcana acumulada. Acima do limiar, a Mácula pode alcançar você."
            onDecrease={() => adjust('limiar', -1)}
            onIncrease={() => adjust('limiar', 1)}
          />
        </div>
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
              const tone = circleColor(runeCircleOf(entry.runeId)) ?? '#94a3b8'

              return (
                <li
                  key={entry.runeId}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/45 px-2.5 py-2"
                >
                  <span
                    className="size-2 shrink-0 rounded-full ring-2 ring-slate-950/60"
                    style={{ backgroundColor: tone, boxShadow: `0 0 10px ${tone}66` }}
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

        {character.spells.length > 0 ? (
          <p className="mt-3 flex items-center gap-1.5 border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-500">
            <Scroll className="size-3" aria-hidden />
            {character.spells.length}{' '}
            {character.spells.length === 1 ? 'magia preparada' : 'magias preparadas'}
          </p>
        ) : null}
      </section>
    </div>
  )
}

function ResourceBar({
  icon,
  label,
  value,
  max,
  barClassName,
  iconClassName,
  gradient,
  caption,
  onDecrease,
  onIncrease,
}: {
  icon: ReactNode
  label: string
  value: number
  max: number
  barClassName?: string
  iconClassName: string
  gradient?: string
  caption?: string
  onDecrease: () => void
  onIncrease: () => void
}) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const atLimit = max > 0 && value >= max
  const isLimiar = Boolean(gradient)

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-800/80 bg-slate-900/45 p-2.5 transition',
        isLimiar && atLimit && 'border-[#F1269C]/60 bg-[#F1269C]/[0.06]',
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
            <p className="text-sm font-semibold tabular-nums text-slate-100">
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
            disabled={value >= max}
          >
            <Plus className="size-3" aria-hidden />
          </StepButton>
        </div>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-950/80">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            !gradient && barClassName,
            isLimiar && atLimit && 'shadow-[0_0_14px_rgba(241,38,156,0.7)]',
          )}
          style={{
            width: `${percent}%`,
            ...(gradient
              ? {
                  backgroundImage: gradient,
                  // O degradê ocupa a barra inteira: em 30% de carga aparece
                  // só o azul; o rosa só entra perto do Limiar.
                  backgroundSize: `${percent > 0 ? (100 / percent) * 100 : 100}% 100%`,
                  backgroundRepeat: 'no-repeat',
                }
              : {}),
          }}
        />
      </div>

      {isLimiar && atLimit ? (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#F472B6]">
          <AlertTriangle className="size-3" aria-hidden />
          Limiar no máximo — risco de Mácula
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
