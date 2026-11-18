import { createEmptyCharacter, type Character } from '@/rules/character'

/**
 * Ficha fictícia usada só quando a Arena abre sem nenhuma ficha publicada.
 * Ela é escrita em `amnia_ficha_atual` com a marca de demonstração, então o
 * painel já aparece completo para avaliar o design. O botão "Voltar ao Criador
 * de Personagens" continua visível enquanto essa marca existir.
 */
export function createMockArenaCharacter(now = Date.now()): Character {
  const base = createEmptyCharacter(now)

  return {
    ...base,
    id: 'arena-demonstracao',
    name: 'Yara Vésper',
    concept: 'Caçadora de Máculas',
    age: '27',
    appearance: 'Cabelo curto cor de cinza, olhos âmbar e um casaco cheio de cicatrizes de queimadura.',
    history:
      'Sobreviveu ao colapso de uma torre arcana e desde então caça criaturas que nascem do excesso de mana.',
    desire: 'Encontrar a origem da Mácula que marcou seu braço.',
    ambition: 'Ser lembrada como a feiticeira que devolveu o equilíbrio ao Limiar.',

    ancestryId: 'humanos',
    sublineageId: 'soltianos',
    ancestryTraits: ['impeto-solar'],
    negativeTraits: [],
    convictions: ['Nunca deixar alguém queimar sozinho.', 'O conhecimento deve ser dividido.'],
    pillars: ['A verdade acima do conforto.'],

    attributes: { forca: 2, destreza: 2, carisma: 1, inteligencia: 3, vontade: 2 },
    keyAttribute: 'inteligencia',

    innateCircle: 'elemento',
    knownRunes: ['elemento-fogo', 'projecao-focal', 'miscelanea-cura', 'reforco-vontade', 'ilusao-visual'],
    channelingMethodId: 'runico',
    channelingLevel: 1,

    spells: [
      {
        id: 'arena-demo-lanca',
        name: 'Lança de Solstício',
        effect: 'Uma agulha de fogo branco atravessa o alvo e deixa um rastro de brasas.',
        runes: [
          { runeId: 'elemento-fogo', level: 3, conditions: [], targetRuneId: null },
          { runeId: 'projecao-focal', level: 2, conditions: [], targetRuneId: null },
        ],
        targets: 'single',
        duration: 'instant',
        area: 'none',
        range: '12 metros',
        targetDescription: 'Uma criatura visível.',
        personal: false,
        notes: 'Magia de abertura da Yara.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'arena-demo-pulso',
        name: 'Pulso Restaurador',
        effect: 'Fecha feridas enquanto uma luz morna percorre o corpo do alvo.',
        runes: [
          { runeId: 'miscelanea-cura', level: 2, conditions: [], targetRuneId: null },
          { runeId: 'reforco-vontade', level: 1, conditions: [], targetRuneId: null },
        ],
        targets: 'single',
        duration: 'instant',
        area: 'none',
        range: 'Toque',
        targetDescription: 'Uma criatura ferida.',
        personal: false,
        notes: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'arena-demo-veu',
        name: 'Véu de Cinzas',
        effect: 'Uma cortina de fumaça ilusória esconde o grupo por alguns instantes.',
        runes: [{ runeId: 'ilusao-visual', level: 2, conditions: [], targetRuneId: null }],
        targets: 'group',
        duration: 'short',
        area: '5',
        range: '9 metros',
        targetDescription: 'Até 10 criaturas.',
        personal: false,
        notes: '',
        createdAt: now,
        updatedAt: now,
      },
    ],

    classId: 'feiticeiro',
    classAbilityId: 'fissura-arcana',
    classTalentId: null,
    impulseId: 'erudito',

    zigs: 42,
    notes: 'Ficha de demonstração da Arena. Crie a sua para substituir.',
  }
}
