import { Badge, Callout, Card, SectionTitle } from '@/components/ui'
import { cn } from '@/lib/cn'
import { impulses } from '@/rules/amnia'
import { classIsWip, classTone, coreAbilityTone } from '@/rules/classColors'
import { classes } from '@/rules/data'
import { withAlpha } from '@/rules/lineageColors'
import { checkRequirement } from '@/rules/requirements'
import { useDraft } from '@/store/draft'

export function StepClass() {
  const character = useDraft((state) => state.character)
  const patch = useDraft((state) => state.patch)

  const selectedClass = classes.find((item) => item.id === character.classId) ?? null

  return (
    <div className="space-y-6">
      <SectionTitle hint="A classe dá uma habilidade central e um talento de graça. O Ímpeto é a sua energia para feitos além do normal.">
        4 · Classe & Ímpeto
      </SectionTitle>

      <Card>
        <h3 className="mb-3 font-display text-lg tracking-wide">Classe</h3>

        {classes.length === 0 ? (
          <Callout>
            Os dados das classes ainda estão sendo extraídos do material. A estrutura já está pronta.
          </Callout>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {classes.map((item) => {
                const tone = classTone(item.id)
                const active = character.classId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      patch({ classId: item.id, classAbilityId: null, classTalentId: null })
                    }
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm transition',
                      active ? 'text-ink' : 'text-ink-soft hover:text-ink',
                    )}
                    style={{
                      borderColor: tone
                        ? active
                          ? tone
                          : withAlpha(tone, 0.3)
                        : undefined,
                      backgroundColor: active && tone ? withAlpha(tone, 0.12) : undefined,
                    }}
                  >
                    {item.name}
                    {classIsWip(item.id) ? (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                        WIP
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            {selectedClass ? (
              <div className="mt-5 space-y-5">
                <p
                  className="border-l-2 pl-3 text-sm leading-relaxed text-ink-soft"
                  style={{ borderLeftColor: classTone(selectedClass.id) ?? undefined }}
                >
                  {selectedClass.description}
                </p>

                {selectedClass.coreAbilities.length > 0 ? (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                      Habilidade Central — escolha 1
                    </p>
                    <div className="space-y-2">
                      {selectedClass.coreAbilities.map((ability, index) => {
                        const active = character.classAbilityId === ability.id
                        const tone = coreAbilityTone(index)
                        return (
                          <button
                            key={ability.id}
                            type="button"
                            onClick={() => patch({ classAbilityId: ability.id })}
                            className={cn(
                              'w-full rounded-lg border p-3 text-left transition',
                              active ? 'text-ink' : 'hover:border-ink/30',
                            )}
                            style={{
                              borderColor: active ? tone : withAlpha(tone, 0.35),
                              backgroundColor: active ? withAlpha(tone, 0.08) : undefined,
                            }}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{ability.name}</span>
                              {active ? (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-parchment"
                                  style={{ backgroundColor: tone }}
                                >
                                  escolhida
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                              {ability.description}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {selectedClass.talents.length > 0 ? (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                      Talento de Classe — escolha 1 de graça
                    </p>
                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {selectedClass.talents.map((talent) => {
                        const active = character.classTalentId === talent.id
                        const requirement = checkRequirement(talent.requirement, character)
                        const blocked = requirement.status === 'unmet'
                        return (
                          <button
                            key={talent.id}
                            type="button"
                            onClick={() => patch({ classTalentId: talent.id })}
                            disabled={blocked && !active}
                            title={blocked ? requirement.detail : undefined}
                            className={cn(
                              'w-full rounded-lg border p-3 text-left transition',
                              active
                                ? 'border-gold bg-gold/[0.12]'
                                : 'border-ink/12 hover:border-ink/30',
                              blocked && 'cursor-not-allowed opacity-55 hover:border-ink/12',
                            )}
                          >
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="font-semibold">{talent.name}</span>
                              {talent.requirement ? (
                                <span
                                  className={cn(
                                    'shrink-0 text-[11px]',
                                    blocked ? 'font-semibold text-red-800' : 'text-ink-soft',
                                  )}
                                >
                                  {talent.requirement}
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                              {talent.description}
                            </span>
                            {blocked ? (
                              <span className="mt-1 block text-[11px] font-semibold text-red-800">
                                Requisito não atendido — {requirement.detail}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <h3 className="mb-1 font-display text-lg tracking-wide">Ímpeto</h3>
        <p className="mb-4 text-sm text-ink-soft">
          Escolha o que move o seu personagem. Você recupera Ímpeto ao descansar (valor de Carisma)
          ou ao cumprir o gatilho escolhido.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {impulses.map((impulse) => {
            const active = character.impulseId === impulse.id
            return (
              <button
                key={impulse.id}
                type="button"
                onClick={() => patch({ impulseId: impulse.id })}
                className={cn(
                  'rounded-lg border p-3 text-left transition',
                  active ? 'border-accent bg-accent/[0.07]' : 'border-ink/12 hover:border-ink/30',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-base tracking-wide">{impulse.name}</span>
                  {active ? <Badge tone="accent">escolhido</Badge> : null}
                </span>
                <span className="mt-0.5 block text-[11px] italic text-ink-soft">
                  {impulse.archetype}
                </span>
                <span className="mt-1 block text-xs leading-snug text-ink-soft">
                  {impulse.description}
                </span>
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
