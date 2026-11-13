import { useState } from 'react'
import { Button, Card, Field, SectionTitle, TextArea, TextInput } from '@/components/ui'
import { attributes, circles } from '@/rules/amnia'
import { useDraft } from '@/store/draft'

export function StepFinal({ onSaved }: { onSaved: (id: string) => void }) {
  const character = useDraft((state) => state.character)
  const patch = useDraft((state) => state.patch)
  const save = useDraft((state) => state.save)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const id = await save()
      onSaved(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a ficha.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle hint="Os últimos detalhes — e a ficha está pronta.">
        8 · Detalhes Finais
      </SectionTitle>

      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Idade" htmlFor="idade">
            <TextInput
              id="idade"
              value={character.age}
              onChange={(event) => patch({ age: event.target.value })}
              placeholder="27"
            />
          </Field>
          <Field label="Zigs" htmlFor="zigs" hint="30 se não pegou a vantagem de recursos.">
            <TextInput
              id="zigs"
              type="number"
              min={0}
              value={character.zigs}
              onChange={(event) => patch({ zigs: Number(event.target.value) || 0 })}
            />
          </Field>
        </div>

        <Field label="Aparência" htmlFor="aparencia">
          <TextArea
            id="aparencia"
            rows={2}
            value={character.appearance}
            onChange={(event) => patch({ appearance: event.target.value })}
            placeholder="Cicatriz sobre o olho esquerdo, casaco de couro gasto…"
          />
        </Field>

        <Field
          label="Histórico"
          htmlFor="historico"
          hint="2 ou 3 frases ligando Pilar, Ambição e Desejo à sua Ancestralidade e Classe."
        >
          <TextArea
            id="historico"
            rows={4}
            value={character.history}
            onChange={(event) => patch({ history: event.target.value })}
          />
        </Field>

        <Field label="Anotações" htmlFor="notas">
          <TextArea
            id="notas"
            rows={3}
            value={character.notes}
            onChange={(event) => patch({ notes: event.target.value })}
            placeholder="Equipamento, contatos, ideias…"
          />
        </Field>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-lg tracking-wide">Resumo</h3>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row label="Nome" value={character.name || '—'} />
          <Row label="Conceito" value={character.concept || '—'} />
          <Row
            label="Atributos"
            value={attributes
              .map((attribute) => `${attribute.short} ${character.attributes[attribute.id]}`)
              .join(' · ')}
          />
          <Row
            label="Atributo Chave"
            value={
              character.keyAttribute
                ? attributes.find((attribute) => attribute.id === character.keyAttribute)?.name ??
                  '—'
                : '—'
            }
          />
          <Row
            label="Círculo Inato"
            value={
              character.innateCircle
                ? (circles.find((circle) => circle.id === character.innateCircle)?.name ?? '—')
                : '—'
            }
          />
          <Row label="Runas" value={String(character.runes.length)} />
          <Row label="Perícias com pontos" value={String(countSkilled(character.skills))} />
          <Row
            label="Vantagens / Desvantagens"
            value={`${character.advantages.filter((a) => a.kind === 'vantagem').length} / ${
              character.advantages.filter((a) => a.kind === 'desvantagem').length
            }`}
          />
        </dl>
      </Card>

      {error ? <p className="text-sm text-accent">{error}</p> : null}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar ficha'}
        </Button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink/8 pb-1.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

function countSkilled(skills: Record<string, number>): number {
  return Object.values(skills).filter((value) => value > 0).length
}
