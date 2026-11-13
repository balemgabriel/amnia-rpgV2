import { DotRating } from '@/components/DotRating'
import { StarIcon } from '@/components/StarIcon'
import { Badge, Button, Callout, Card, SectionTitle } from '@/components/ui'
import { cn } from '@/lib/cn'
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, KEY_ATTRIBUTES, attributes } from '@/rules/amnia'
import { validateAttributeDistribution } from '@/rules/character'
import type { AttributeId } from '@/rules/types'
import { useDraft } from '@/store/draft'

const KEY_ATTRIBUTE_EFFECTS: Record<string, string> = {
  inteligencia: 'Reduz a Complexidade das suas magias em −1.',
  carisma: 'Permite re-rolar 2 dados em testes de magia, uma vez por rodada.',
  vontade: 'Aumenta o SAVE DC das suas magias em +1.',
}

export function StepAttributes() {
  const character = useDraft((state) => state.character)
  const setAttribute = useDraft((state) => state.setAttribute)
  const setKeyAttribute = useDraft((state) => state.setKeyAttribute)
  const patch = useDraft((state) => state.patch)

  const validation = validateAttributeDistribution(character.attributes)

  function distributeDefault() {
    patch({
      attributes: { forca: 3, destreza: 2, carisma: 2, inteligencia: 1, vontade: 1 },
    })
  }

  return (
    <div className="space-y-6">
      <SectionTitle hint="Um atributo em 3, dois em 2, dois em 1. Todos vão de 1 a 5.">
        2 · Atributos
      </SectionTitle>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Badge tone={validation.valid ? 'ok' : 'warn'}>
            {validation.valid ? 'Distribuição válida' : 'Distribuição incompleta'}
          </Badge>
          <Button variant="ghost" onClick={distributeDefault} className="text-xs">
            Usar 3 · 2 · 2 · 1 · 1
          </Button>
        </div>

        <ul className="divide-y divide-ink/8">
          {attributes.map((attribute) => (
            <li key={attribute.id} className="flex items-start justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-lg tracking-wide">{attribute.name}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                    {attribute.short}
                  </span>
                  {character.keyAttribute === attribute.id ? (
                    <StarIcon className="self-center text-gold" label="Atributo Chave" />
                  ) : null}
                </p>
                <p className="mt-0.5 text-sm leading-snug text-ink-soft">{attribute.description}</p>
              </div>
              <DotRating
                label={attribute.name}
                value={character.attributes[attribute.id as AttributeId]}
                min={ATTRIBUTE_MIN}
                max={ATTRIBUTE_MAX}
                size="lg"
                onChange={(value) => setAttribute(attribute.id as AttributeId, value)}
              />
            </li>
          ))}
        </ul>

        {!validation.valid && validation.message ? (
          <div className="mt-4">
            <Callout tone="warn">{validation.message}</Callout>
          </div>
        ) : null}
      </Card>

      <Card>
        <h3 className="font-display text-lg tracking-wide">Atributo Chave</h3>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Define como você conjura. A escolha é permanente — só INT, CAR ou VON.
        </p>

        <div className="grid gap-2 sm:grid-cols-3">
          {KEY_ATTRIBUTES.map((id) => {
            const attribute = attributes.find((item) => item.id === id)
            const active = character.keyAttribute === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setKeyAttribute(id)}
                className={cn(
                  'rounded-lg border p-3 text-left transition',
                  active
                    ? 'border-accent bg-accent/[0.07]'
                    : 'border-ink/12 hover:border-ink/30',
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="font-display text-base tracking-wide">
                    {attribute?.name ?? id}
                  </span>
                  {active ? (
                    <span className="flex items-center gap-1">
                      <StarIcon className="text-gold" label="Atributo Chave escolhido" />
                      <Badge tone="accent">chave</Badge>
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs leading-snug text-ink-soft">
                  {KEY_ATTRIBUTE_EFFECTS[id]}
                </span>
              </button>
            )
          })}
        </div>

        {character.keyAttribute ? (
          <p className="mt-4 text-sm text-ink-soft">
            Pontos de Mana:{' '}
            <strong className="text-ink">
              3 + {character.attributes[character.keyAttribute]} ={' '}
              {3 + character.attributes[character.keyAttribute]} PM
            </strong>
          </p>
        ) : (
          <div className="mt-4">
            <Callout tone="warn">Escolha um Atributo Chave para calcular a Mana.</Callout>
          </div>
        )}
      </Card>
    </div>
  )
}
