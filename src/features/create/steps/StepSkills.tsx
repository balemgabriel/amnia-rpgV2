import { useState } from 'react'
import { DotRating } from '@/components/DotRating'
import { Badge, Button, Callout, Card, SectionTitle, TextInput } from '@/components/ui'
import { cn } from '@/lib/cn'
import { SKILL_MAX, skillDistributions, skillGroups, skills } from '@/rules/amnia'
import { countSkillLevels, creationSpecializations } from '@/rules/character'
import { withAlpha } from '@/rules/lineageColors'
import { skillGroupColor } from '@/rules/skillColors'
import { useDraft } from '@/store/draft'

const GROUP_ORDER = ['fisica', 'social', 'mental'] as const

export function StepSkills() {
  const character = useDraft((state) => state.character)
  const setDistribution = useDraft((state) => state.setDistribution)
  const setSkill = useDraft((state) => state.setSkill)
  const addSpecialization = useDraft((state) => state.addSpecialization)
  const removeSpecialization = useDraft((state) => state.removeSpecialization)

  const [specSkill, setSpecSkill] = useState('armas-brancas')
  const [specName, setSpecName] = useState('')

  const distribution = skillDistributions.find(
    (item) => item.id === character.skillDistributionId,
  )
  const levels = distribution?.levels ?? {}
  const counts = countSkillLevels(character.skills)

  const freeSpecializations = creationSpecializations(character.skills)
  const usedSpecializations = character.specializations.length

  function maxLevelFor(skillId: string): number {
    const current = character.skills[skillId] ?? 0
    let best = current
    for (const levelRaw of Object.keys(levels)) {
      const level = Number(levelRaw)
      if (level <= current) continue
      const used = (counts[level] ?? 0) - (current === level ? 1 : 0)
      if (used < (levels[level] ?? 0)) best = Math.max(best, level)
    }
    return Math.min(SKILL_MAX, best)
  }

  function submitSpecialization() {
    const name = specName.trim()
    if (!name || usedSpecializations >= freeSpecializations) return
    addSpecialization(specSkill, name)
    setSpecName('')
  }

  return (
    <div className="space-y-6">
      <SectionTitle hint="Perícias vão de 0 a 5. A distribuição escolhida define quantas você pode ter em cada nível.">
        5 · Perícias
      </SectionTitle>

      <Card>
        <div className="grid gap-2 sm:grid-cols-3">
          {skillDistributions.map((option) => {
            const active = character.skillDistributionId === option.id
            const summary = Object.entries(option.levels)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([level, count]) => `${count} em ${level}`)
              .join(', ')
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setDistribution(option.id)}
                className={cn(
                  'rounded-lg border p-3 text-left transition',
                  active ? 'border-accent bg-accent/[0.07]' : 'border-ink/12 hover:border-ink/30',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-base tracking-wide">{option.name}</span>
                  {active ? <Badge tone="accent">ativa</Badge> : null}
                </span>
                <span className="mt-1 block text-xs text-ink-soft">{option.description}</span>
                <span className="mt-1 block text-[11px] tabular-nums text-ink-soft">{summary}</span>
              </button>
            )
          })}
        </div>

        {distribution ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(levels)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([levelRaw, allowed]) => {
                const level = Number(levelRaw)
                const used = counts[level] ?? 0
                const done = used === allowed
                return (
                  <Badge key={levelRaw} tone={done ? 'ok' : 'gold'}>
                    nível {level}: {used}/{allowed}
                  </Badge>
                )
              })}
          </div>
        ) : (
          <div className="mt-4">
            <Callout tone="warn">Escolha uma distribuição para começar a gastar perícias.</Callout>
          </div>
        )}
      </Card>

      {GROUP_ORDER.map((group) => {
        const tone = skillGroupColor(group)
        return (
          <Card
            key={group}
            className="border-l-4"
            style={{
              borderColor: withAlpha(tone, 0.35),
              borderLeftColor: tone,
            }}
          >
            <h3
              className="mb-3 flex items-center gap-2 font-display text-lg tracking-wide"
              style={{ color: tone }}
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: tone }}
              />
              {skillGroups[group]}
            </h3>
            <ul className="divide-y divide-ink/8">
              {skills
                .filter((skill) => skill.group === group)
                .map((skill) => {
                  const value = character.skills[skill.id] ?? 0
                  return (
                    <li
                      key={skill.id}
                      className="flex items-center justify-between gap-3 border-l-2 py-2.5 pl-3"
                      style={{ borderLeftColor: withAlpha(tone, 0.55) }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{skill.name}</p>
                        <p className="truncate text-xs text-ink-soft">{skill.description}</p>
                      </div>
                      <DotRating
                        label={skill.name}
                        value={value}
                        min={0}
                        max={SKILL_MAX}
                        limit={maxLevelFor(skill.id)}
                        onChange={(next) => setSkill(skill.id, next)}
                      />
                    </li>
                  )
                })}
            </ul>
          </Card>
        )
      })}

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-lg tracking-wide">Especializações</h3>
          <Badge tone={usedSpecializations >= freeSpecializations ? 'ok' : 'gold'}>
            {usedSpecializations} / {freeSpecializations} grátis
          </Badge>
        </div>
        <p className="mb-3 text-sm text-ink-soft">
          Uma de graça na criação, mais uma em Ofícios, Erudição ou Arcanismo se você tiver pontos
          nelas. Cada especialização dá +1 dado quando o assunto se aplica.
        </p>

        {character.specializations.length > 0 ? (
          <ul className="mb-3 space-y-1.5">
            {character.specializations.map((spec) => (
              <li
                key={spec.id}
                className="flex items-center justify-between gap-3 rounded-md bg-ink/[0.04] px-3 py-2 text-sm"
              >
                <span>
                  <strong>{spec.name}</strong>{' '}
                  <span className="text-ink-soft">
                    · {skills.find((skill) => skill.id === spec.skillId)?.name}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeSpecialization(spec.id)}
                  className="text-xs text-ink-soft hover:text-accent"
                >
                  remover
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Perícia
        </div>
        <div className="mb-2 max-h-56 space-y-2 overflow-auto rounded-lg border border-ink/10 p-2.5">
          {GROUP_ORDER.map((group) => {
            const tone = skillGroupColor(group)
            return (
              <div key={group}>
                <p
                  className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: tone }}
                >
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: tone }}
                  />
                  {skillGroups[group]}
                </p>
                <div className="flex flex-wrap gap-1">
                  {skills
                    .filter((skill) => skill.group === group)
                    .map((skill) => {
                      const active = specSkill === skill.id
                      return (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => setSpecSkill(skill.id)}
                          aria-pressed={active}
                          className="rounded-md border px-2 py-1 text-xs transition"
                          style={{
                            borderColor: active ? tone : withAlpha(tone, 0.4),
                            backgroundColor: active ? withAlpha(tone, 0.12) : undefined,
                            color: active ? tone : undefined,
                          }}
                        >
                          {skill.name}
                        </button>
                      )
                    })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <TextInput
            value={specName}
            onChange={(event) => setSpecName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submitSpecialization()
              }
            }}
            placeholder="Ex.: Espadas, Venenos, Cortes…"
            list="specialization-suggestions"
          />
          <datalist id="specialization-suggestions">
            {(skills.find((skill) => skill.id === specSkill)?.specializations ?? []).map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <Button
            onClick={submitSpecialization}
            disabled={!specName.trim() || usedSpecializations >= freeSpecializations}
          >
            Adicionar
          </Button>
        </div>
      </Card>
    </div>
  )
}
