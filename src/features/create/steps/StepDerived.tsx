import { Badge, Callout, Card, SectionTitle } from '@/components/ui'
import { computeDerived } from '@/rules/derive'
import { useDraft } from '@/store/draft'

export function StepDerived() {
  const character = useDraft((state) => state.character)
  const derived = computeDerived(character)

  return (
    <div className="space-y-6">
      <SectionTitle hint="Calculado automaticamente a partir dos atributos, do Atributo Chave e dos modificadores.">
        7 · Vida, Mana e Derivados
      </SectionTitle>

      <Card>
        <div className="overflow-hidden rounded-lg border border-ink/10">
          <table className="w-full text-sm">
            <thead className="bg-ink/[0.04] text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-semibold">Atributo derivado</th>
                <th className="px-3 py-2 font-semibold">Fórmula</th>
                <th className="px-3 py-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {derived.map((stat) => (
                <tr key={stat.id}>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold">{stat.name}</p>
                    {stat.note ? (
                      <p className="mt-0.5 text-xs text-ink-soft">{stat.note}</p>
                    ) : null}
                    {stat.sources.length > 0 ? (
                      <p className="mt-0.5 text-xs text-emerald-800">
                        {stat.sources
                          .map((source) => `${source.source} ${source.value > 0 ? '+' : ''}${source.value}`)
                          .join(' · ')}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ink-soft">{stat.formula}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-display text-xl tabular-nums">{stat.value}</span>
                    {stat.unit ? (
                      <span className="ml-1 text-xs text-ink-soft">{stat.unit}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-lg tracking-wide">Conferência da criação</h3>
        <ul className="space-y-2 text-sm">
          <Check ok={character.name.trim().length > 0} label="Nome definido" />
          <Check ok={character.ancestryId !== null} label="Ancestralidade escolhida" />
          <Check ok={character.keyAttribute !== null} label="Atributo Chave definido" />
          <Check ok={character.innateCircle !== null} label="Círculo Inato escolhido" />
          <Check ok={character.channelingMethodId !== null} label="Método de Canalização" />
          <Check ok={character.classId !== null} label="Classe escolhida" />
          <Check ok={character.impulseId !== null} label="Ímpeto escolhido" />
          <Check
            ok={character.skillDistributionId !== null}
            label="Distribuição de perícias definida"
          />
        </ul>
      </Card>

      {character.advantages.length === 0 ? (
        <Callout tone="warn">
          Você ainda não distribuiu os 7 pontos de vantagens e desvantagens.
        </Callout>
      ) : null}
    </div>
  )
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-ink-soft">{label}</span>
      <Badge tone={ok ? 'ok' : 'warn'}>{ok ? 'ok' : 'pendente'}</Badge>
    </li>
  )
}
