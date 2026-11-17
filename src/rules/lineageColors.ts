/**
 * Cores das linhagens e ancestralidades.
 *
 * Duas camadas:
 *
 * 1. **Ancestralidade (raça)** — usada para demarcar o grupo no seletor:
 *    - Troll, Goblin e Orc ......... verde
 *    - Lirizatl, Skaraeb, Shrumakara,
 *      Khefaret e Dongwu ........... laranja
 *    - Todas as demais ............ azul
 *
 * 2. **Linhagem (sub-ramificação)** — as sete cores-base vieram das linhagens
 *    humanas e são reaproveitadas nas demais para diferenciar cada linhagem:
 *
 *    - Soltianos ......... laranja forte
 *    - Asdaw ............. vermelho
 *    - Romani ............ roxo nobre
 *    - Knowlin ........... azul esverdeado
 *    - Redawlin .......... ciano
 *    - Tsuniano .......... verde
 *    - Hjalvar ........... azul escuro
 */
export const lineagePalette = {
  laranja: '#C2410C',
  vermelho: '#B91C1C',
  roxo: '#5B21B6',
  azulEsverdeado: '#0F766E',
  ciano: '#0891B2',
  verde: '#15803D',
  azulEscuro: '#1E3A8A',
} as const

export type LineageColorName = keyof typeof lineagePalette

/** Cores por ancestralidade (raça). */
export const ancestryPalette = {
  verde: lineagePalette.verde,
  laranja: lineagePalette.laranja,
  azul: lineagePalette.azulEscuro,
} as const

const GREEN_ANCESTRIES = new Set(['troll', 'goblin', 'orcs'])
const ORANGE_ANCESTRIES = new Set([
  'lirizatl',
  'skaraeb',
  'shrumakara',
  'khefaret',
  'dongwu',
])

/** Cor de uma ancestralidade (raça); azul para as demais. */
export function ancestryColor(id?: string | null): string | null {
  if (!id) return null
  if (GREEN_ANCESTRIES.has(id)) return ancestryPalette.verde
  if (ORANGE_ANCESTRIES.has(id)) return ancestryPalette.laranja
  return ancestryPalette.azul
}

/**
 * Mapa id → cor das linhagens (sub-ramificações).
 * Não inclui as ancestralidades: essas usam `ancestryColor`.
 */
export const lineageColors: Record<string, string> = {
  // Humanos
  soltianos: lineagePalette.laranja,
  asdaw: lineagePalette.vermelho,
  romani: lineagePalette.roxo,
  knowlin: lineagePalette.azulEsverdeado,
  redawlin: lineagePalette.ciano,
  tsuniano: lineagePalette.verde,
  hjalvar: lineagePalette.azulEscuro,

  // Saifoni
  tserof: lineagePalette.laranja,
  senialp: lineagePalette.vermelho,
  snegatnom: lineagePalette.roxo,

  // Berglavi
  deisenbart: lineagePalette.azulEsverdeado,
  gorvnon: lineagePalette.ciano,

  // Wyad
  ulfhednar: lineagePalette.laranja,
  vargsold: lineagePalette.vermelho,
  managard: lineagePalette.roxo,
  nattvandr: lineagePalette.azulEsverdeado,
  sylvrath: lineagePalette.ciano,

  // Corvianos
  kalik: lineagePalette.verde,
  kadin: lineagePalette.azulEscuro,

  // Skaraeb — grupos
  qatae: lineagePalette.azulEsverdeado,
  khayat: lineagePalette.ciano,
  rasasa: lineagePalette.verde,
  // Skaraeb — linhagens por casta (herdam a cor do grupo)
  qamil: lineagePalette.azulEsverdeado,
  qahame: lineagePalette.azulEsverdeado,
  qasayad: lineagePalette.azulEsverdeado,
  khaymil: lineagePalette.ciano,
  khayame: lineagePalette.ciano,
  khayad: lineagePalette.ciano,
  rasamil: lineagePalette.verde,
  rasame: lineagePalette.verde,
  rasayad: lineagePalette.verde,

  // Lirizatl — grupos
  kuetz: lineagePalette.azulEsverdeado,
  tlahkoa: lineagePalette.roxo,

  // Lirizatl
  kameyotl: lineagePalette.azulEscuro,
  kaispalin: lineagePalette.laranja,
  siskoatl: lineagePalette.vermelho,
  toroyotl: lineagePalette.roxo,
  ketsapuek: lineagePalette.azulEsverdeado,
  krepetl: lineagePalette.ciano,
  kolotl: lineagePalette.verde,
  xalimikol: lineagePalette.azulEscuro,
  kamaxa: lineagePalette.laranja,
  axokatol: lineagePalette.vermelho,

  // Orcs
  ghullen: lineagePalette.roxo,
  suhcrin: lineagePalette.azulEsverdeado,
  'aldar-suu': lineagePalette.ciano,

  // Goblin
  gabul: lineagePalette.verde,
  gobbo: lineagePalette.azulEscuro,

  // Troll
  forghum: lineagePalette.laranja,
  laanghum: lineagePalette.vermelho,
  barimachuul: lineagePalette.roxo,
  tagooch: lineagePalette.azulEsverdeado,
  nairamdal: lineagePalette.ciano,
}

/** Cor de uma linhagem (sub-ramificação); `null` se o id não estiver mapeado. */
export function lineageColor(id?: string | null): string | null {
  if (!id) return null
  return lineageColors[id] ?? null
}

/**
 * Cor para demarcar os traços de uma ficha: a linhagem manda; sem linhagem,
 * usa a cor da ancestralidade.
 */
export function traitColor(
  ancestryId?: string | null,
  sublineageId?: string | null,
): string | null {
  return lineageColor(sublineageId) ?? ancestryColor(ancestryId)
}

/** Converte #RRGGBB + alpha (0–1) em #RRGGBBAA para fundos suaves. */
export function withAlpha(hex: string, alpha: number): string {
  const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${channel}`
}
