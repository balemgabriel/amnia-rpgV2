import { toSvg } from 'html-to-image'

/** Fundo do papel usado na ficha exportada. */
export const EXPORT_PAPER = '#f3ece0'

/**
 * Espera as fontes e as imagens da ficha carregarem antes de capturar.
 *
 * Não usamos `requestAnimationFrame` aqui: em abas ocultas (ou durante uma
 * impressão) o navegador pode pausar o rAF e a exportação nunca terminaria.
 */
export async function waitForExportAssets(root: HTMLElement | null): Promise<void> {
  await document.fonts?.ready
  const images = root ? Array.from(root.querySelectorAll('img')) : []
  await Promise.all(images.map((image) => image.decode().catch(() => undefined)))
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

/**
 * Converte um nó da ficha em PNG.
 *
 * O `toPng` do html-to-image espera um `requestAnimationFrame` para resolver a
 * imagem; em uma aba que não está visível isso trava e o botão fica eternamente
 * em "Gerando…". Aqui geramos o SVG (que funciona normalmente), carregamos a
 * imagem e desenhamos no canvas sem depender de rAF.
 */
export async function captureNodeAsPng(
  node: HTMLElement,
  { pixelRatio = 2, backgroundColor = EXPORT_PAPER }: { pixelRatio?: number; backgroundColor?: string } = {},
): Promise<string> {
  const rect = node.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width || node.clientWidth))
  const height = Math.max(1, Math.round(rect.height || node.clientHeight))

  const svgUrl = await toSvg(node, {
    width,
    height,
    backgroundColor,
    cacheBust: true,
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível renderizar a ficha.'))
    img.src = svgUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * pixelRatio)
  canvas.height = Math.round(height * pixelRatio)

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas indisponível neste navegador.')

  context.fillStyle = backgroundColor
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/png')
}

/** Nome de arquivo seguro a partir do nome do personagem. */
export function exportSlug(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'ficha'
  )
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}
