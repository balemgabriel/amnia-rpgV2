import { cn } from '@/lib/cn'

/**
 * Pequena estrela usada para marcar o Atributo Chave escolhido.
 * `label` vira o texto acessível; quando omitido o ícone é decorativo.
 */
export function StarIcon({
  className,
  label = 'Atributo Chave',
}: {
  className?: string
  label?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      className={cn('size-3.5', className)}
      fill="currentColor"
    >
      {label ? <title>{label}</title> : null}
      <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.32l-5.8 3.05 1.11-6.47-4.7-4.58 6.49-.94L12 2.5z" />
    </svg>
  )
}
