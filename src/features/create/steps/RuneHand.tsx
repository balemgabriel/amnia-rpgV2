import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { RuneCard } from '@/components/RuneCard'
import { Badge } from '@/components/ui'
import { circleColor } from '@/rules/circleColors'
import type { RuneCircleId, RuneDef } from '@/rules/data'
import { withAlpha } from '@/rules/lineageColors'
import type { RequirementCheck } from '@/rules/requirements'

const CARD_WIDTH = '21rem'
const CARD_OVERLAP = '2.25rem'
/** Rotação máxima de uma carta na ponta do leque. */
const MAX_ROTATION = 5
/** Quantos pixels as cartas vizinhas abrem quando uma está em foco. */
const NEIGHBOR_SPREAD = 14

/**
 * Mão de runas em leque.
 *
 * Todas as cartas ficam numa única fileira horizontal com leve sobreposição e
 * rotação. A área rola no eixo X (arrastar com o mouse, roda do mouse ou
 * scrollbar) para não empurrar a página para baixo.
 *
 * No hover, a carta sobe, cresce e ganha um glow na cor da Esfera; as cartas
 * vizinhas se afastam um pouco para abrir espaço.
 *
 * As cartas em si continuam sendo o `RuneCard` de sempre (cores, conteúdo e
 * seleção intactos); aqui só mudamos o posicionamento delas.
 */
export function RuneHand({
  runes,
  known,
  remaining,
  requirementChecks,
  grantedRuneIds,
  grantedCircles,
  onToggle,
}: {
  runes: RuneDef[]
  known: readonly string[]
  remaining: number
  /** Resultado do requisito de cada runa, por id. */
  requirementChecks?: Record<string, RequirementCheck>
  /** Runas específicas concedidas por traços raciais. */
  grantedRuneIds?: readonly string[]
  /** Círculos com uma runa gratuita concedida por traço racial. */
  grantedCircles?: readonly RuneCircleId[]
  onToggle: (runeId: string) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef({
    pointerId: null as number | null,
    startX: 0,
    startLeft: 0,
    moved: false,
    /** Fim do último arrasto de verdade (para ignorar só o click que o segue). */
    endedAt: 0,
  })

  // Roda do mouse rola a mão na horizontal. Nas pontas, deixa a página rolar.
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    function onWheel(event: WheelEvent) {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      const el = scrollRef.current
      if (!el) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      const next = Math.max(0, Math.min(max, el.scrollLeft + event.deltaY))
      if (next === el.scrollLeft) return
      event.preventDefault()
      el.scrollLeft = next
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    const element = scrollRef.current
    if (!element) return
    drag.current.pointerId = event.pointerId
    drag.current.startX = event.clientX
    drag.current.startLeft = element.scrollLeft
    drag.current.moved = false
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const element = scrollRef.current
    const state = drag.current
    if (!element || state.pointerId !== event.pointerId) return
    const delta = event.clientX - state.startX
    if (!state.moved && Math.abs(delta) > 6) {
      state.moved = true
      try {
        element.setPointerCapture(event.pointerId)
      } catch {
        // Ponteiro sintético (testes) não tem captura; seguir sem ela.
      }
    }
    if (!state.moved) return
    event.preventDefault()
    element.scrollLeft = state.startLeft - delta
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const element = scrollRef.current
    if (element?.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId)
    }
    if (drag.current.moved) drag.current.endedAt = performance.now()
    drag.current.pointerId = null
  }

  // Setas do teclado rolam o leque quando o próprio container está em foco.
  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const element = scrollRef.current
    if (!element) return
    event.preventDefault()
    element.scrollLeft += event.key === 'ArrowLeft' ? -240 : 240
  }

  const hoveredIndex = hoveredId
    ? runes.findIndex((rune) => rune.id === hoveredId)
    : -1
  const center = (runes.length - 1) / 2

  return (
    <div>
      <div
        ref={scrollRef}
        role="group"
        aria-label="Mão de runas — arraste ou use as setas para navegar"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="rune-hand cursor-grab select-none overflow-x-auto overflow-y-hidden pb-8 pt-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold active:cursor-grabbing"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHoveredId(null)}
        onDragStart={(event) => event.preventDefault()}
      >
        <div className="flex w-max items-stretch px-20">
          {runes.map((rune, index) => {
            const offset = index - center
            const isHovered = hoveredIndex === index
            const distance = hoveredIndex >= 0 ? index - hoveredIndex : 0
            const spread =
              hoveredIndex >= 0 && !isHovered
                ? Math.sign(distance) *
                  (Math.abs(distance) === 1 ? NEIGHBOR_SPREAD : NEIGHBOR_SPREAD / 2)
                : 0
            const rotation = Math.max(
              -MAX_ROTATION,
              Math.min(MAX_ROTATION, offset * 1.2),
            )
            const tone = circleColor(rune.circle) ?? '#5c5044'
            const isKnown = known.includes(rune.id)
            const granted =
              grantedRuneIds?.includes(rune.id) || grantedCircles?.includes(rune.circle)
            // Runa específica concedida fica travada enquanto o traço existir.
            const locked = isKnown && Boolean(grantedRuneIds?.includes(rune.id))
            const requirement = requirementChecks?.[rune.id]
            const blockedByRequirement = !isKnown && requirement?.status === 'unmet'
            const disabled = !isKnown && (remaining <= 0 || blockedByRequirement)

            return (
              <div
                key={rune.id}
                className="flex shrink-0 rounded-lg transition-[transform,box-shadow] duration-300 ease-out"
                style={{
                  width: CARD_WIDTH,
                  marginLeft: index === 0 ? 0 : `-${CARD_OVERLAP}`,
                  zIndex: isHovered ? 999 : 10 + index,
                  transformOrigin: 'bottom center',
                  transform: isHovered
                    ? 'translate(0, -20px) rotate(0deg) scale(1.04)'
                    : `translate(${spread}px, ${Math.min(10, Math.abs(offset) * 1.2)}px) rotate(${rotation}deg)`,
                  boxShadow: isHovered
                    ? `0 24px 48px -16px ${withAlpha(tone, 0.55)}, 0 0 0 2px ${withAlpha(
                        tone,
                        0.5,
                      )}`
                    : '0 1px 2px rgba(32, 26, 20, 0.06)',
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setHoveredId(rune.id)
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === 'mouse') setHoveredId(null)
                }}
              >
                <RuneCard
                  rune={rune}
                  active={isKnown}
                  disabled={disabled}
                  blockedReason={blockedByRequirement ? requirement.detail : undefined}
                  onToggle={
                    locked
                      ? undefined
                      : () => {
                          // Um arrasto termina em click; só esse click é ignorado.
                          if (
                            drag.current.endedAt > 0 &&
                            performance.now() - drag.current.endedAt < 250
                          ) {
                            return
                          }
                          onToggle(rune.id)
                        }
                  }
                  badge={
                    granted ? (
                      <Badge tone={isKnown ? 'ok' : 'gold'}>
                        {isKnown ? 'Concedida' : 'Grátis'}
                      </Badge>
                    ) : isKnown ? (
                      <Badge tone="ok">Conhecida</Badge>
                    ) : null
                  }
                  className="h-full w-full"
                />
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-ink-soft">
        Arraste para os lados, use a roda do mouse ou as setas do teclado para ver todas as cartas.
        Passe o mouse sobre uma carta para lê-la por inteiro.
      </p>
    </div>
  )
}
