import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { WIZARD_STEPS, useDraft } from '@/store/draft'
import { StepAdvantages } from './steps/StepAdvantages'
import { StepAttributes } from './steps/StepAttributes'
import { StepClass } from './steps/StepClass'
import { StepConcept } from './steps/StepConcept'
import { StepDerived } from './steps/StepDerived'
import { StepFinal } from './steps/StepFinal'
import { StepMagic } from './steps/StepMagic'
import { StepSkills } from './steps/StepSkills'

const STEP_COMPONENTS = [
  StepConcept,
  StepAttributes,
  StepMagic,
  StepClass,
  StepSkills,
  StepAdvantages,
  StepDerived,
] as const

export function CreateWizard({
  onExit,
  onSaved,
  editing = false,
}: {
  onExit: () => void
  onSaved: (id: string) => void
  /** Edição de uma ficha pronta: muda só os rótulos da navegação. */
  editing?: boolean
}) {
  const step = useDraft((state) => state.step)
  const goTo = useDraft((state) => state.goTo)
  const next = useDraft((state) => state.next)
  const back = useDraft((state) => state.back)
  const name = useDraft((state) => state.character.name)

  const StepComponent = STEP_COMPONENTS[step] ?? StepConcept
  const isLast = step === WIZARD_STEPS.length - 1

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-parchment/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="quiet" onClick={onExit} className="px-2">
              {editing ? '← Fichas Prontas' : '← Fichas'}
            </Button>
            <span className="h-5 w-px bg-ink/15" />
            <div>
              <p className="font-display text-lg leading-none">
                {editing ? 'Alterar ficha' : 'Nova ficha'}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-ink-soft">
                {name.trim() || 'Sem nome'}
              </p>
            </div>
          </div>
          <p className="hidden text-xs text-ink-soft sm:block">
            Etapa {step + 1} de {WIZARD_STEPS.length}
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Etapas da criação" className="lg:sticky lg:top-24 lg:self-start">
          <ol className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
            {WIZARD_STEPS.map((item, index) => {
              const active = index === step
              return (
                <li key={item.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => goTo(index)}
                    aria-current={active ? 'step' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition',
                      active ? 'bg-ink/8 text-ink' : 'text-ink-soft hover:bg-ink/5 hover:text-ink',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums',
                        active
                          ? 'border-accent bg-accent text-parchment'
                          : 'border-ink/20 text-ink-soft',
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="whitespace-nowrap">{item.title}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <main className="min-w-0">
          {step === WIZARD_STEPS.length - 1 ? <StepFinal onSaved={onSaved} /> : <StepComponent />}

          <div className="mt-10 flex items-center justify-between gap-3 border-t border-ink/10 pt-5">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              Voltar
            </Button>
            {isLast ? null : (
              <Button onClick={next}>
                Continuar <span aria-hidden>→</span>
              </Button>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
