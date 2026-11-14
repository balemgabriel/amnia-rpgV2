import type {
  AttributeDef,
  ChannelingMethodDef,
  CircleDef,
  CircleRelation,
  CircleRelationRule,
  CreationBudget,
  DerivedStatDef,
  ImpulseDef,
  SkillDef,
  SkillDistributionDef,
  XpCostDef,
} from './types'

/** Versão das regras. Sobe sempre que os dados abaixo mudarem de forma relevante. */
export const AMNIA_RULES_VERSION = '2.0.0-draft'

export const attributes: AttributeDef[] = [
  {
    id: 'forca',
    name: 'Força',
    short: 'FOR',
    description:
      'Força e condicionamento físico. Somada aos Pontos de Vida; alguns equipamentos exigem um mínimo.',
  },
  {
    id: 'destreza',
    name: 'Destreza',
    short: 'DES',
    description:
      'Agilidade, equilíbrio e velocidade. Somada à Defesa Física e ao Deslocamento.',
  },
  {
    id: 'carisma',
    name: 'Carisma',
    short: 'CAR',
    description:
      'Charme, presença e habilidade social. Afeta interações e a recuperação de Ímpeto em descanso.',
  },
  {
    id: 'inteligencia',
    name: 'Inteligência',
    short: 'INT',
    description:
      'Capacidade cognitiva e conhecimento geral. Saves de INT resistem a efeitos mentais.',
  },
  {
    id: 'vontade',
    name: 'Vontade',
    short: 'VON',
    description:
      'Autocontrole, determinação e fé. Dita Vida, Limiar, SAVE DC e resistência a efeitos.',
  },
]

export const ATTRIBUTE_MIN = 1
export const ATTRIBUTE_MAX = 5

/** Distribuição fixa da criação: um atributo em 3, dois em 2, dois em 1. */
export const CREATION_ATTRIBUTE_VALUES = [3, 2, 2, 1, 1] as const

/** Atributos que podem ser escolhidos como Atributo Chave (conjuração). */
export const KEY_ATTRIBUTES = ['inteligencia', 'carisma', 'vontade'] as const

export const skills: SkillDef[] = [
  // Físicas
  {
    id: 'armas-brancas',
    name: 'Armas Brancas',
    group: 'fisica',
    description: 'Espadas, machados, lâminas, lanças e afins.',
    specializations: [
      'Espadas',
      'Adagas',
      'Machados',
      'Clavas',
      'Armas Pesadas',
      'Lanças',
      'Armas conjuradas',
    ],
  },
  {
    id: 'briga',
    name: 'Briga',
    group: 'fisica',
    description: 'Combate desarmado, agarrões e imobilizações.',
    specializations: [
      'Combate desarmado',
      'Agarrões',
      'Animais',
      'Garras',
      'Briga com Metamorfose',
    ],
  },
  {
    id: 'precisao',
    name: 'Precisão',
    group: 'fisica',
    description: 'Armas de distância: arcos, bestas e armas de fogo.',
    specializations: ['Arcos', 'Bestas', 'Armas de fogo', 'Arremesso', 'Zarabatanas'],
  },
  {
    id: 'fortitude',
    name: 'Fortitude',
    group: 'fisica',
    description: 'Resistir a efeitos físicos, venenos e dor.',
    specializations: ['Venenos', 'Poções', 'Combate', 'Proteger'],
  },
  {
    id: 'furtividade',
    name: 'Furtividade',
    group: 'fisica',
    description: 'Mover-se em silêncio, esconder-se, emboscar.',
    specializations: [
      'Emboscadas',
      'Multidões',
      'Disfarces',
      'Seguir',
      'Urbana',
      'Regiões selvagens',
    ],
  },
  {
    id: 'ladroagem',
    name: 'Ladroagem',
    group: 'fisica',
    description: 'Furtar bolsos, abrir fechaduras, desarmar armadilhas manuais.',
    specializations: [
      'Falsificação',
      'Roubo de carros',
      'Invasão domiciliar',
      'Castelos',
      'Prisões',
      'Arrombamento',
      'Bater carteira',
      'Abrir cofres',
    ],
  },
  {
    id: 'atletismo',
    name: 'Atletismo',
    group: 'fisica',
    description: 'Correr, nadar, escalar, saltar, resistir à fadiga.',
    specializations: ['Acrobacias', 'Escalada', 'Salto', 'Parkour', 'Natação'],
  },
  {
    id: 'oficios',
    name: 'Ofícios',
    group: 'fisica',
    description: 'Criar, consertar ou modificar equipamentos, forjar, engenharia.',
    specializations: [
      'Carpintaria',
      'Entalhe',
      'Design',
      'Pintura',
      'Escultura',
      'Costura',
      'Fabricação de armas',
      'Engenharia',
    ],
  },
  {
    id: 'sobrevivencia',
    name: 'Sobrevivência',
    group: 'fisica',
    description: 'Rastrear, caçar, identificar plantas e venenos, acampar.',
    specializations: [
      'Deserto',
      'Caça',
      'Floresta',
      'Seguir trilhas',
      'Armadilhas',
      'Abrigos',
      'Tundra',
      'Selva',
      'Urbana',
    ],
  },
  {
    id: 'conducao',
    name: 'Condução',
    group: 'fisica',
    description: 'Pilotar montarias, dirigir carruagens ou veículos simples.',
    specializations: [
      'Aeromóveis',
      'Animais voadores',
      'Cavalos',
      'Carroagens',
      'Animais selvagens',
      'Constructos',
      'Familiares',
    ],
  },

  // Sociais
  {
    id: 'persuasao',
    name: 'Persuasão',
    group: 'social',
    description: 'Convencer, negociar, argumentar com lógica ou emoção.',
    specializations: ['Barganha', 'Interrogatório', 'Argumentos legais', 'Negociação', 'Retórica'],
  },
  {
    id: 'intimidacao',
    name: 'Intimidação',
    group: 'social',
    description: 'Coagir, ameaçar, impor medo através da presença.',
    specializations: [
      'Extorsão',
      'Insulto',
      'Interrogatório',
      'Coerção física',
      'Encarar',
      'Ameaça velada',
    ],
  },
  {
    id: 'empatia-animal',
    name: 'Empatia Animal',
    group: 'social',
    description: 'Pacificar, interagir e treinar animais.',
    specializations: ['Animal específico', 'Treino de ataque', 'Treino de acrobacia', 'Pacificação'],
  },
  {
    id: 'subterfugio',
    name: 'Subterfúgio',
    group: 'social',
    description: 'Mentir, dissimular, criar álibis e falsas identidades.',
    specializations: ['Blefe', 'Falsa identidade', 'Mentiras', 'Inocência', 'Golpe', 'Sedução'],
  },
  {
    id: 'manipulacao',
    name: 'Manipulação',
    group: 'social',
    description: 'Distorcer fatos, convencer por omissão, explorar vulnerabilidades.',
    specializations: ['—'],
  },
  {
    id: 'manha',
    name: 'Manha',
    group: 'social',
    description: 'Submundo, gírias, contatos ilegais, regras da rua.',
    specializations: [
      'Negociação de armas',
      'Mercado ilegal',
      'Suborno',
      'Drogas',
      'Itens roubados',
      'Gangues',
      'Esgotos',
      'Prostituição',
      'Sobrevivência urbana',
    ],
  },
  {
    id: 'etiqueta',
    name: 'Etiqueta',
    group: 'social',
    description: 'Protocolo da nobreza, jantares formais, não cometer gafes.',
    specializations: ['Nobreza', 'Diplomatas', 'Sociedades secretas', 'Tribos', 'Magos'],
  },
  {
    id: 'introspeccao',
    name: 'Introspecção',
    group: 'social',
    description: 'Ler intenções, perceber desconforto, entender motivações ocultas.',
    specializations: [
      'Ler intenções',
      'Perceber desconforto',
      'Entender motivações ocultas',
    ],
  },
  {
    id: 'lideranca',
    name: 'Liderança',
    group: 'social',
    description: 'Inspirar aliados, organizar grupos, dar ordens efetivas.',
    specializations: [
      'Comando',
      'Inspiração',
      'Oratória',
      'Dinâmica de grupo',
      'Exércitos',
      'Multidões',
    ],
  },
  {
    id: 'performance',
    name: 'Performance',
    group: 'social',
    description: 'Cantar, tocar instrumentos, dançar, entreter multidões.',
    specializations: [
      'Comédia',
      'Dança',
      'Drama',
      'Instrumento musical específico',
      'Poesia',
      'Canto',
    ],
  },

  // Mentais
  {
    id: 'arcanismo',
    name: 'Arcanismo',
    group: 'mental',
    description: 'Teoria mágica, identificação de feitiços, runas e entidades.',
    specializations: ['Alquimia', 'Maldições', 'Criatura sobrenatural específica', 'Necromancia', 'Rituais'],
  },
  {
    id: 'erudicao',
    name: 'Erudição',
    group: 'mental',
    description: 'História, nobreza, geografia, leis e línguas.',
    specializations: [
      'Arcanae',
      'Arquitetura',
      'Literatura',
      'História da arte',
      'História (campo ou período)',
      'Cultura específica',
      'Filosofia',
      'Pesquisa',
      'Ensino',
      'Teologia',
    ],
  },
  {
    id: 'investigacao',
    name: 'Investigação',
    group: 'mental',
    description: 'Deduzir pistas, conectar fatos, examinar cenas.',
    specializations: [
      'Criminologia',
      'Dedução',
      'Forense',
      'Pessoas desaparecidas',
      'Assassinatos',
      'Mistérios paranormais',
    ],
  },
  {
    id: 'medicina',
    name: 'Medicina',
    group: 'mental',
    description: 'Tratar ferimentos, identificar doenças, cirurgia de campo.',
    specializations: ['Tratar ferimentos', 'Identificar doenças', 'Cirurgia de campo'],
  },
  {
    id: 'navegacao',
    name: 'Navegação',
    group: 'mental',
    description: 'Orientar-se por estrelas, mapas, mar ou florestas densas.',
    specializations: ['Aérea', 'Mares', 'Rios', 'Litorais', 'Tempestades'],
  },
  {
    id: 'percepcao',
    name: 'Percepção',
    group: 'mental',
    description: 'Notar detalhes, ouvir passos, vigiar um local.',
    specializations: [
      'Emboscada',
      'Camuflagem',
      'Objetos ocultos',
      'Escuta',
      'Instintos',
      'Cheiros',
      'Visão',
      'Armadilhas',
    ],
  },
  {
    id: 'politica',
    name: 'Política',
    group: 'mental',
    description: 'Conhecer as cortes, leis, burocracia e jogos de poder.',
    specializations: [
      'Cortes',
      'Tribunais',
      'Diplomacia',
      'Mídia',
      'Política municipal, estadual ou nacional',
    ],
  },
  {
    id: 'religiao',
    name: 'Religião',
    group: 'mental',
    description: 'Dogmas, rituais sagrados, hierarquias divinas.',
    specializations: ['Dogmas', 'Rituais sagrados', 'Deus específico'],
  },
  {
    id: 'tatica',
    name: 'Tática',
    group: 'mental',
    description: 'Leitura de campo de batalha, planejamento de emboscadas, moral de tropas.',
    specializations: [
      'Campo de batalha',
      'Emboscada',
      'Moral de tropas',
      'Logística',
      'Planejamento',
      'Lutar em desvantagem',
    ],
  },
  {
    id: 'tecnologia',
    name: 'Tecnologia',
    group: 'mental',
    description: 'Mecanismos complexos, relógios, engenharia avançada.',
    specializations: [
      'Artilharia',
      'Engenharia',
      'Constructos',
      'Refinamento de materiais',
      'Mecanismos complexos',
    ],
  },
]

export const SKILL_MIN = 0
export const SKILL_MAX = 5

export const skillGroups: Record<SkillDef['group'], string> = {
  fisica: 'Físicas',
  social: 'Sociais',
  mental: 'Mentais',
}

export const skillDistributions: SkillDistributionDef[] = [
  {
    id: 'especialista',
    name: 'Especialista',
    description: 'Poucas perícias, muito profundas.',
    levels: { 4: 1, 3: 3, 2: 3, 1: 3 },
  },
  {
    id: 'pau-pra-toda-obra',
    name: 'Pau pra Toda Obra',
    description: 'Muitas perícias, pouca profundidade.',
    levels: { 3: 1, 2: 8, 1: 10 },
  },
  {
    id: 'generalista',
    name: 'Generalista',
    description: 'Equilíbrio entre alcance e profundidade.',
    levels: { 3: 3, 2: 5, 1: 7 },
  },
]

/**
 * As seis Esferas na ordem do hexágono (sentido horário).
 * A distância entre posições define a relação de custo.
 */
export const circleOrder: CircleDef['id'][] = [
  'reforco',
  'elemento',
  'alteracao',
  'projecao',
  'ilusao',
  'multiplicacao',
]

export const circles: CircleDef[] = [
  {
    id: 'reforco',
    name: 'Reforço',
    description: 'Aprimora os atributos interiores.',
    examples: 'Força, Velocidade, Potência.',
  },
  {
    id: 'elemento',
    name: 'Elemento',
    description: 'Manipulação de elementos.',
    examples: 'Fogo, Água, Natureza, Clima.',
  },
  {
    id: 'multiplicacao',
    name: 'Multiplicação',
    description: 'Repetir, replicar e multiplicar algo existente.',
    examples: 'Multiplicação Falsa, Repetição de Ação.',
  },
  {
    id: 'ilusao',
    name: 'Ilusão',
    description: 'Enganar os sentidos e a percepção.',
    examples: 'Som, Visual, Físico, Espiritual.',
  },
  {
    id: 'projecao',
    name: 'Projeção',
    description: 'Externalizar, expandir e projetar a mana ou a vontade.',
    examples: 'Presença, Alma, Externalização.',
  },
  {
    id: 'alteracao',
    name: 'Alteração',
    description: 'Moldar e transformar características de algo com a mana.',
    examples: 'Peso, Tamanho, Cura, Propriedade, Inversão.',
  },
]

export const circleRelationRules: Record<CircleRelation, CircleRelationRule> = {
  inata: { relation: 'inata', costModifier: -1, label: 'Inato (−1 PM)' },
  adjacente: { relation: 'adjacente', costModifier: 0, label: 'Adjacente (0)' },
  paralela: { relation: 'paralela', costModifier: 1, label: 'Paralelo (+1 PM)' },
  oposta: { relation: 'oposta', costModifier: 2, label: 'Oposto (+2 PM)' },
}

/** Rótulos das relações no hexágono, como na ficha tradicional. */
export const circleRelationLabels: Record<CircleRelation, string> = {
  inata: 'Inato',
  adjacente: 'Adjacente',
  paralela: 'Paralelo',
  oposta: 'Oposto',
}

/** Rótulos de todas as categorias de runa, incluindo as Miscelâneas. */
export const runeCircleLabels: Record<CircleDef['id'] | 'miscelanea', string> = {
  ...(Object.fromEntries(circles.map((circle) => [circle.id, circle.name])) as Record<
    CircleDef['id'],
    string
  >),
  miscelanea: 'Miscelâneas',
}

/** Distância mínima no hexágono entre duas Esferas (0 a 3). */
export function circleDistance(a: CircleDef['id'], b: CircleDef['id']): number {
  const i = circleOrder.indexOf(a)
  const j = circleOrder.indexOf(b)
  if (i < 0 || j < 0) return 0
  const diff = Math.abs(i - j)
  return Math.min(diff, circleOrder.length - diff)
}

export function circleRelation(innate: CircleDef['id'], target: CircleDef['id']): CircleRelation {
  const distance = circleDistance(innate, target)
  if (distance === 0) return 'inata'
  if (distance === 1) return 'adjacente'
  if (distance === 2) return 'paralela'
  return 'oposta'
}

export const derivedStats: DerivedStatDef[] = [
  {
    id: 'pv',
    name: 'Pontos de Vida',
    formula: '8 + forca + vontade',
    unit: 'PV',
    note: 'Ao chegar a 0 você entra nas Portas da Morte.',
  },
  {
    id: 'pm',
    name: 'Pontos de Mana',
    formula: '3 + atributoChave',
    unit: 'PM',
    note: 'Mana disponível por rodada, distribuída entre as runas.',
  },
  {
    id: 'limiar',
    name: 'Limiar Arcano',
    formula: '8 + vontade + inteligencia',
    unit: 'PM',
    note: 'Acima do limiar você fica suscetível a Máculas.',
  },
  {
    id: 'saveDc',
    name: 'SAVE DC',
    formula: '1 + vontade',
    note: 'Dificuldade para resistir aos seus efeitos.',
  },
  {
    id: 'impeto',
    name: 'Pontos de Ímpeto',
    formula: 'vontade + carisma',
    unit: 'Ímpeto',
    note: 'Recuperado ao descansar (valor de Carisma) ou por feitos.',
  },
  {
    id: 'deslocamentoGrid',
    name: 'Deslocamento (grid)',
    formula: '1 + destreza',
    unit: 'espaços',
    note: 'Cada espaço equivale a 1,5 metro.',
  },
  {
    id: 'deslocamentoMetros',
    name: 'Deslocamento (sem grid)',
    formula: '3 + destreza',
    unit: 'metros',
  },
  {
    id: 'pa',
    name: 'Pontos de Ação',
    formula: '4',
    unit: 'PA',
    note: 'Recebidos no início de cada turno.',
  },
]

export const creationBudget: CreationBudget = {
  ancestryPoints: 3,
  startingXp: 15,
  advantagePoints: 7,
  minDisadvantagePoints: 2,
  baseRunes: 3,
  freeSpecializations: 1,
  actionPoints: 4,
}

export const xpCosts: XpCostDef[] = [
  { id: 'atributo', name: 'Atributo', cost: '5 × Nível Atual', unitCost: 5, perLevel: true },
  { id: 'pericia', name: 'Perícia', cost: '4 × Nível Atual', unitCost: 4, perLevel: true },
  { id: 'especializacao', name: 'Especialização', cost: '3', fixedCost: 3 },
  { id: 'talento-classe', name: 'Talento de Classe', cost: '6', fixedCost: 6 },
  { id: 'vantagem', name: 'Vantagem & Desvantagem', cost: '3 × Nível', unitCost: 3, perLevel: true },
  { id: 'runa-inata', name: 'Runa Inata', cost: '6', fixedCost: 6 },
  { id: 'runa-adjacente', name: 'Runa Adjacente', cost: '7', fixedCost: 7 },
  { id: 'runa-paralela', name: 'Runa Paralela', cost: '8', fixedCost: 8 },
  { id: 'runa-oposta', name: 'Runa Oposta', cost: '9', fixedCost: 9 },
  { id: 'tecnica-intermediaria', name: 'Técnica Intermediária', cost: '5', fixedCost: 5 },
  { id: 'tecnica-avancada', name: 'Técnica Avançada', cost: '7', fixedCost: 7 },
  { id: 'canalizacao-1', name: 'Método de Canalização Nível 1', cost: '5', fixedCost: 5 },
  { id: 'canalizacao-2', name: 'Método de Canalização Nível 2', cost: '8', fixedCost: 8 },
  {
    id: 'ponto-extra',
    name: '1 ponto extra de PV / PM / Ímpeto (máx. 3)',
    cost: '4',
    fixedCost: 4,
  },
  {
    id: 'ficha-conhecimento',
    name: 'Ficha de Conhecimento ou Cultura',
    cost: '3 por Nível',
    unitCost: 3,
    perLevel: true,
  },
]

export const impulses: ImpulseDef[] = [
  {
    id: 'sobrevivente',
    name: 'Ímpeto do Sobrevivente',
    archetype: 'O tanque, o berserker ou o mártir.',
    description:
      'Recupera 1 Ímpeto quando sofre dano de um ataque inimigo OU quando está com menos da metade dos seus Pontos de Vida.',
  },
  {
    id: 'lider',
    name: 'Ímpeto do Líder',
    archetype: 'O general, o paladino ou o bardo.',
    description:
      'Recupera 1 Ímpeto quando um aliado adjacente acerta um ataque crítico, supera uma dificuldade graças à sua ajuda, ou quando você usa uma ação para auxiliá-lo.',
  },
  {
    id: 'manipulador',
    name: 'Ímpeto do Manipulador',
    archetype: 'O diplomata, o vilão carismático ou o interrogador.',
    description:
      'Recupera 1 Ímpeto quando obtém sucesso em um teste social que altera o comportamento de um NPC, ou quando impõe uma condição mental a um inimigo em combate.',
  },
  {
    id: 'determinado',
    name: 'Ímpeto do Determinado',
    archetype: 'O monge, o inquisidor ou o herói.',
    description:
      'Recupera 1 Ímpeto quando passa em um teste de Vontade para resistir a medo, charme, tortura ou controle mental, ou quando cumpre um objetivo pessoal.',
  },
  {
    id: 'perfeccionista',
    name: 'Ímpeto do Perfeccionista',
    archetype: 'O atirador de elite, o duelista ou o assassino.',
    description:
      'Recupera 1 Ímpeto quando causa dano com Margem de Sucesso de +2 ou mais, ou quando derruba um inimigo com um único golpe.',
  },
  {
    id: 'improvisador',
    name: 'Ímpeto do Improvisador',
    archetype: 'O batedor, o ladino astuto ou o guerreiro inteligente.',
    description:
      'Recupera 1 Ímpeto quando usa o ambiente a seu favor ou executa com sucesso uma manobra de combate (Finta, Desarme, Agarrar).',
  },
  {
    id: 'erudito',
    name: 'Ímpeto do Erudito',
    archetype: 'O mago, o druida ou o caçador de monstros.',
    description:
      'Recupera 1 Ímpeto quando identifica com sucesso uma magia, fraqueza ou fenômeno sobrenatural, ou quando resiste a uma Mácula Arcana usando sua Vontade.',
  },
]

export const channelingMethods: ChannelingMethodDef[] = [
  {
    id: 'gestual',
    name: 'Gestual',
    description: 'Invoca as runas por meio de gestos no ar e movimentos corporais.',
    level1: 'Necessita de gestos amplos.',
    level2: 'Micro-gestos: +1 dado em testes de magia.',
  },
  {
    id: 'ritualistica',
    name: 'Ritualística',
    description: 'Preparação longa, contratos e condições.',
    level1: 'Lançar uma magia custa 2 PA, mas suas runas podem ser de até 2 níveis mais altos.',
    level2: 'Restrições moderadas concedem +1 dado; severas ou maiores, +1 dado adicional.',
  },
  {
    id: 'oral',
    name: 'Oral',
    description: 'Fala, canta ou recita a magia para que ela exista.',
    level1: 'Precisa falar em voz alta para refinar as runas.',
    level2: 'Permite sussurrar as runas; quanto mais alto gritar, mais dano causa.',
  },
  {
    id: 'runico',
    name: 'Rúnico',
    description: 'Escreve runas em superfícies com materiais.',
    level1: 'Reduz a complexidade das magias em −1.',
    level2: 'Quanto mais raro o material, mais dados extras no teste de magia.',
  },
  {
    id: 'gatilho',
    name: 'Gatilho',
    description: 'Suas magias só podem ser lançadas por meio de um gatilho específico.',
    level1: 'Magias exigem uma condição Moderada para ativar; +2 no Limiar.',
    level2: 'Cada condição Moderada aumenta o dano em +1; +3 no Limiar.',
  },
]
