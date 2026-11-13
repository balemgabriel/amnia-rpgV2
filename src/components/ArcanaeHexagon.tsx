import { cn } from '@/lib/cn'
import {
  circleOrder,
  circleRelation,
  circleRelationLabels,
  circleRelationRules,
  circles,
} from '@/rules/amnia'
import { circleColor } from '@/rules/circleColors'
import type { CircleDef } from '@/rules/types'

const VIEWBOX = 360
const CENTER = VIEWBOX / 2
const RADIUS = 118
const NODE_RADIUS = 40

const NODES = circleOrder.map((id, index) => {
  const angle = ((-90 + index * 60) * Math.PI) / 180
  return {
    id,
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  }
})

const INK = '#201a14'
const INK_SOFT = '#5c5044'
const PARCHMENT = '#f3ece0'
const GOLD = '#b08d57'

/** Luminância relativa aproximada para escolher texto legível sobre a cor. */
function relativeLuminance(hex: string): number {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function readableOn(hex: string): string {
  return relativeLuminance(hex) > 0.3 ? INK : PARCHMENT
}

interface ArcanaeHexagonProps {
  /** Esfera inata; `null` deixa o hexágono neutro. */
  innate: CircleDef['id'] | null
  onChange?: (id: CircleDef['id']) => void
  className?: string
  /** Mostra o custo de mana de cada Esfera (padrão: true). */
  showCosts?: boolean
}

/**
 * Hexágono das Esferas como na ficha tradicional: seis círculos nos vértices,
 * rotulados pela relação com a Esfera Inata (Inato, Adjacente, Paralelo, Oposto).
 *
 * Com `onChange`, clicar em um vértice escolhe a Esfera Inata.
 */
export function ArcanaeHexagon({
  innate,
  onChange,
  className,
  showCosts = true,
}: ArcanaeHexagonProps) {
  const interactive = Boolean(onChange)
  const polygon = NODES.map((node) => `${node.x},${node.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      role={interactive ? 'group' : 'img'}
      aria-label={
        innate
          ? `Hexágono das Esferas. Círculo inato: ${circles.find((circle) => circle.id === innate)?.name ?? innate}.`
          : 'Hexágono das Esferas. Nenhum Círculo Inato escolhido.'
      }
      className={cn('h-auto w-full select-none', className)}
    >
      <polygon
        points={polygon}
        fill="rgba(176, 141, 87, 0.07)"
        stroke={GOLD}
        strokeOpacity={0.45}
        strokeWidth={1.5}
      />

      <text
        x={CENTER}
        y={CENTER + 6}
        textAnchor="middle"
        fontFamily="Vinque, ui-serif, Georgia, serif"
        fontSize={15}
        fill={GOLD}
        opacity={0.55}
        letterSpacing="0.12em"
      >
        ARCANAE
      </text>

      {NODES.map((node) => {
        const circle = circles.find((item) => item.id === node.id)
        if (!circle) return null

        const relation = innate ? circleRelation(innate, node.id) : null
        const active = relation === 'inata'
        const tone = circleColor(node.id) ?? GOLD
        const onTone = readableOn(tone)
        const rule = relation ? circleRelationRules[relation] : null
        const relationLabel = relation ? circleRelationLabels[relation] : 'Esfera'
        const costLabel = rule
          ? `${rule.costModifier > 0 ? '+' : ''}${rule.costModifier === -1 ? '−1' : rule.costModifier} PM`
          : null
        const costColor =
          rule == null
            ? INK_SOFT
            : rule.costModifier < 0
              ? '#15803D'
              : rule.costModifier > 0
                ? '#B45309'
                : INK_SOFT

        return (
          <g
            key={node.id}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={`${circle.name}${relation ? `, ${relationLabel}` : ''}`}
            aria-pressed={interactive ? active : undefined}
            onClick={() => onChange?.(node.id)}
            onKeyDown={(event) => {
              if (!interactive) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onChange?.(node.id)
              }
            }}
            className={cn(
              'transition',
              interactive && 'cursor-pointer hover:opacity-85 focus-visible:outline-none',
            )}
          >
            <title>{circle.name}</title>

            {active ? (
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS + 6}
                fill="none"
                stroke={tone}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            ) : null}

            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              fill={active ? tone : 'rgba(255, 253, 248, 0.82)'}
              stroke={tone}
              strokeWidth={active ? 2.5 : 1.75}
              strokeOpacity={active ? 1 : 0.8}
            />

            <text
              x={node.x}
              y={node.y - 13}
              textAnchor="middle"
              fontFamily="'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif"
              fontSize={7}
              fontWeight={600}
              letterSpacing="0.08em"
              fill={active ? onTone : INK_SOFT}
              opacity={active ? 0.85 : 1}
            >
              {relationLabel.toUpperCase()}
            </text>

            <text
              x={node.x}
              y={node.y + 1}
              textAnchor="middle"
              fontFamily="'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif"
              fontSize={10}
              fontWeight={600}
              fill={active ? onTone : INK}
            >
              {circle.name}
            </text>

            {showCosts && costLabel ? (
              <text
                x={node.x}
                y={node.y + 14}
                textAnchor="middle"
                fontFamily="'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif"
                fontSize={7.5}
                fontWeight={600}
                fill={active ? onTone : costColor}
                opacity={active ? 0.9 : 1}
              >
                {costLabel}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
