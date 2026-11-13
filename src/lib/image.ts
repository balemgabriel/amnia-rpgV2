/**
 * Converte um arquivo de imagem em data URL redimensionada, para guardar a foto
 * do personagem dentro da própria ficha (IndexedDB), sem servidor.
 */
export async function fileToPortrait(file: File, maxSize = 640): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  const image = await loadImage(dataUrl)

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return dataUrl

  context.drawImage(image, 0, 0, width, height)
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  return canvas.toDataURL(type, 0.86)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível abrir a imagem.'))
    image.src = src
  })
}
