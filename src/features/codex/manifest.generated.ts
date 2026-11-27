/**
 * GERADO por scripts/build-codex-content.mjs — não editar à mão.
 * Fonte: export do Notion em docs/amnia-export (fora do git).
 */
export const CODEX_SECTIONS = [
  {
    "id": "mundo",
    "title": "Mundo e lore",
    "icon": "🌒"
  },
  {
    "id": "regras",
    "title": "Regras e mecânicas",
    "icon": "⚔️"
  },
  {
    "id": "racas",
    "title": "Raças e culturas",
    "icon": "🏛️"
  },
  {
    "id": "itens",
    "title": "Itens e equipamentos",
    "icon": "🧰"
  },
  {
    "id": "magias",
    "title": "Magias e runas",
    "icon": "✦"
  }
] as const

export type CodexSectionId = (typeof CODEX_SECTIONS)[number]['id']

export interface CodexArticle {
  id: string
  title: string
  section: CodexSectionId
  group: string
  /** Caminho dentro de src/features/codex/content. */
  file: string
  words: number
  stub: boolean
}

export const CODEX_ARTICLES: CodexArticle[] = [
  {
    "id": "itens-equipamento",
    "title": "Equipamento",
    "section": "itens",
    "group": "Geral",
    "file": "itens/equipamento.md",
    "words": 3628,
    "stub": false
  },
  {
    "id": "mundo-indice-do-compendio",
    "title": "Índice do Compêndio",
    "section": "mundo",
    "group": "Geral",
    "file": "mundo/indice-do-compendio.md",
    "words": 29,
    "stub": false
  },
  {
    "id": "regras-acoes-manobras",
    "title": "Ações & Manobras",
    "section": "regras",
    "group": "Geral",
    "file": "regras/acoes-manobras.md",
    "words": 1629,
    "stub": false
  },
  {
    "id": "regras-classes",
    "title": "Classes",
    "section": "regras",
    "group": "Classes",
    "file": "regras/classes.md",
    "words": 21,
    "stub": false
  },
  {
    "id": "regras-alquimista",
    "title": "Alquimista",
    "section": "regras",
    "group": "Classes",
    "file": "regras/alquimista.md",
    "words": 2,
    "stub": true
  },
  {
    "id": "regras-artesao",
    "title": "Artesão",
    "section": "regras",
    "group": "Classes",
    "file": "regras/artesao.md",
    "words": 710,
    "stub": false
  },
  {
    "id": "regras-artista",
    "title": "Artista",
    "section": "regras",
    "group": "Classes",
    "file": "regras/artista.md",
    "words": 2,
    "stub": true
  },
  {
    "id": "regras-barbaro",
    "title": "Bárbaro",
    "section": "regras",
    "group": "Classes",
    "file": "regras/barbaro.md",
    "words": 973,
    "stub": false
  },
  {
    "id": "regras-bardo",
    "title": "Bardo",
    "section": "regras",
    "group": "Classes",
    "file": "regras/bardo.md",
    "words": 695,
    "stub": false
  },
  {
    "id": "regras-cacador",
    "title": "Caçador",
    "section": "regras",
    "group": "Classes",
    "file": "regras/cacador.md",
    "words": 902,
    "stub": false
  },
  {
    "id": "regras-clerigo",
    "title": "Clérigo",
    "section": "regras",
    "group": "Classes",
    "file": "regras/clerigo.md",
    "words": 2,
    "stub": true
  },
  {
    "id": "regras-druida",
    "title": "Druida",
    "section": "regras",
    "group": "Classes",
    "file": "regras/druida.md",
    "words": 784,
    "stub": false
  },
  {
    "id": "regras-feiticeiro",
    "title": "Feiticeiro",
    "section": "regras",
    "group": "Classes",
    "file": "regras/feiticeiro.md",
    "words": 787,
    "stub": false
  },
  {
    "id": "regras-ginete",
    "title": "Ginete",
    "section": "regras",
    "group": "Classes",
    "file": "regras/ginete.md",
    "words": 744,
    "stub": false
  },
  {
    "id": "regras-guerreiro",
    "title": "Guerreiro",
    "section": "regras",
    "group": "Classes",
    "file": "regras/guerreiro.md",
    "words": 739,
    "stub": false
  },
  {
    "id": "regras-ladino",
    "title": "Ladino",
    "section": "regras",
    "group": "Classes",
    "file": "regras/ladino.md",
    "words": 684,
    "stub": false
  },
  {
    "id": "regras-lutador",
    "title": "Lutador",
    "section": "regras",
    "group": "Classes",
    "file": "regras/lutador.md",
    "words": 840,
    "stub": false
  },
  {
    "id": "regras-mago",
    "title": "Mago",
    "section": "regras",
    "group": "Classes",
    "file": "regras/mago.md",
    "words": 743,
    "stub": false
  },
  {
    "id": "regras-ocultista",
    "title": "Ocultista",
    "section": "regras",
    "group": "Classes",
    "file": "regras/ocultista.md",
    "words": 2,
    "stub": true
  },
  {
    "id": "regras-criacao-de-personagem",
    "title": "Criação de Personagem",
    "section": "regras",
    "group": "Criação",
    "file": "regras/criacao-de-personagem.md",
    "words": 531,
    "stub": false
  },
  {
    "id": "regras-ficha",
    "title": "Ficha",
    "section": "regras",
    "group": "Criação",
    "file": "regras/ficha.md",
    "words": 232,
    "stub": false
  },
  {
    "id": "itens-equipamento-22",
    "title": "Equipamento",
    "section": "itens",
    "group": "Geral",
    "file": "itens/equipamento-2.md",
    "words": 751,
    "stub": false
  },
  {
    "id": "mundo-fichas",
    "title": "Fichas",
    "section": "mundo",
    "group": "Geral",
    "file": "mundo/fichas.md",
    "words": 47,
    "stub": false
  },
  {
    "id": "mundo-fichas-de-conhecimento-cultura",
    "title": "Fichas de Conhecimento & Cultura",
    "section": "mundo",
    "group": "Cultura & conhecimento",
    "file": "mundo/fichas-de-conhecimento-cultura.md",
    "words": 70,
    "stub": false
  },
  {
    "id": "mundo-fichas-de-conhecimento",
    "title": "Fichas de Conhecimento",
    "section": "mundo",
    "group": "Cultura & conhecimento",
    "file": "mundo/fichas-de-conhecimento.md",
    "words": 4,
    "stub": true
  },
  {
    "id": "mundo-fichas-de-cultura",
    "title": "Fichas de Cultura",
    "section": "mundo",
    "group": "Cultura & conhecimento",
    "file": "mundo/fichas-de-cultura.md",
    "words": 2470,
    "stub": false
  },
  {
    "id": "mundo-balatrino-balatreno-mago",
    "title": "Balatrino Balatreno - Mago",
    "section": "mundo",
    "group": "Personagens da campanha",
    "file": "mundo/balatrino-balatreno-mago.md",
    "words": 854,
    "stub": false
  },
  {
    "id": "mundo-bell-toph-rah-druida",
    "title": "Bell Toph’Rah (Druída)",
    "section": "mundo",
    "group": "Personagens da campanha",
    "file": "mundo/bell-toph-rah-druida.md",
    "words": 824,
    "stub": false
  },
  {
    "id": "mundo-fiapon-kabelin-guerreiro",
    "title": "Fiapon Kabelin (Guerreiro)",
    "section": "mundo",
    "group": "Personagens da campanha",
    "file": "mundo/fiapon-kabelin-guerreiro.md",
    "words": 970,
    "stub": false
  },
  {
    "id": "mundo-modelo-de-ficha-10",
    "title": "Modelo de ficha 10",
    "section": "mundo",
    "group": "Personagens da campanha",
    "file": "mundo/modelo-de-ficha-10.md",
    "words": 232,
    "stub": false
  },
  {
    "id": "mundo-modelo-de-ficha-8",
    "title": "Modelo de ficha 8",
    "section": "mundo",
    "group": "Personagens da campanha",
    "file": "mundo/modelo-de-ficha-8.md",
    "words": 232,
    "stub": false
  },
  {
    "id": "mundo-modelo-de-ficha-9",
    "title": "Modelo de ficha 9",
    "section": "mundo",
    "group": "Personagens da campanha",
    "file": "mundo/modelo-de-ficha-9.md",
    "words": 232,
    "stub": false
  },
  {
    "id": "mundo-kalango-lukipher-ladino",
    "title": "Kalango Lukipher (Ladino)",
    "section": "mundo",
    "group": "Personagens da campanha",
    "file": "mundo/kalango-lukipher-ladino.md",
    "words": 1143,
    "stub": false
  },
  {
    "id": "mundo-lokh-godh-barbaro",
    "title": "Lokh Godh ( Bárbaro )",
    "section": "mundo",
    "group": "Personagens da campanha",
    "file": "mundo/lokh-godh-barbaro.md",
    "words": 868,
    "stub": false
  },
  {
    "id": "mundo-o-pulga-lutador",
    "title": "O Pulga (Lutador)",
    "section": "mundo",
    "group": "Personagens da campanha",
    "file": "mundo/o-pulga-lutador.md",
    "words": 1127,
    "stub": false
  },
  {
    "id": "mundo-soka-e-hi-cacador",
    "title": "Soka E’Hi (Caçador)",
    "section": "mundo",
    "group": "Personagens da campanha",
    "file": "mundo/soka-e-hi-cacador.md",
    "words": 834,
    "stub": false
  },
  {
    "id": "mundo-guia-do-mestre",
    "title": "Guia do Mestre",
    "section": "mundo",
    "group": "Geral",
    "file": "mundo/guia-do-mestre.md",
    "words": 4,
    "stub": true
  },
  {
    "id": "racas-linhagens-racas",
    "title": "Linhagens & Raças",
    "section": "racas",
    "group": "Geral",
    "file": "racas/linhagens-racas.md",
    "words": 273,
    "stub": false
  },
  {
    "id": "racas-berglavi",
    "title": "Berglavi",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/berglavi.md",
    "words": 283,
    "stub": false
  },
  {
    "id": "racas-corvianos",
    "title": "Corvianos",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/corvianos.md",
    "words": 475,
    "stub": false
  },
  {
    "id": "racas-dongwu-wip",
    "title": "Dongwu WIP",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/dongwu-wip.md",
    "words": 3,
    "stub": true
  },
  {
    "id": "racas-goblin",
    "title": "Goblin",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/goblin.md",
    "words": 482,
    "stub": false
  },
  {
    "id": "racas-golshoy",
    "title": "Golshoy",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/golshoy.md",
    "words": 412,
    "stub": false
  },
  {
    "id": "racas-humanos",
    "title": "Humanos",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/humanos.md",
    "words": 883,
    "stub": false
  },
  {
    "id": "racas-khefaret-wip",
    "title": "Khefaret WIP",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/khefaret-wip.md",
    "words": 3,
    "stub": true
  },
  {
    "id": "racas-lirizatl",
    "title": "Lirizatl",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/lirizatl.md",
    "words": 921,
    "stub": false
  },
  {
    "id": "racas-orcs",
    "title": "Orcs",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/orcs.md",
    "words": 420,
    "stub": false
  },
  {
    "id": "racas-rediano",
    "title": "Rediano",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/rediano.md",
    "words": 226,
    "stub": false
  },
  {
    "id": "racas-saifoni",
    "title": "Saifoni",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/saifoni.md",
    "words": 451,
    "stub": false
  },
  {
    "id": "racas-shrumakara-wip",
    "title": "Shrumakara WIP",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/shrumakara-wip.md",
    "words": 3,
    "stub": true
  },
  {
    "id": "racas-skaraeb",
    "title": "Skaraeb",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/skaraeb.md",
    "words": 1049,
    "stub": false
  },
  {
    "id": "racas-troll",
    "title": "Troll",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/troll.md",
    "words": 676,
    "stub": false
  },
  {
    "id": "racas-wyad",
    "title": "Wyad",
    "section": "racas",
    "group": "Ancestralidades",
    "file": "racas/wyad.md",
    "words": 644,
    "stub": false
  },
  {
    "id": "mundo-lore",
    "title": "Lore",
    "section": "mundo",
    "group": "Geral",
    "file": "mundo/lore.md",
    "words": 2,
    "stub": true
  },
  {
    "id": "magias-magia",
    "title": "Magia",
    "section": "magias",
    "group": "Geral",
    "file": "magias/magia.md",
    "words": 2124,
    "stub": false
  },
  {
    "id": "magias-familiares",
    "title": "Familiares",
    "section": "magias",
    "group": "Arcanae",
    "file": "magias/familiares.md",
    "words": 167,
    "stub": false
  },
  {
    "id": "magias-lista-de-runas",
    "title": "Lista de Runas",
    "section": "magias",
    "group": "Arcanae",
    "file": "magias/lista-de-runas.md",
    "words": 20,
    "stub": false
  },
  {
    "id": "magias-runas-de-alteracao",
    "title": "Runas de Alteração",
    "section": "magias",
    "group": "Runas",
    "file": "magias/runas-de-alteracao.md",
    "words": 1083,
    "stub": false
  },
  {
    "id": "magias-runas-de-elemento",
    "title": "Runas de Elemento",
    "section": "magias",
    "group": "Runas",
    "file": "magias/runas-de-elemento.md",
    "words": 1108,
    "stub": false
  },
  {
    "id": "magias-runas-de-ilusao",
    "title": "Runas de Ilusão",
    "section": "magias",
    "group": "Runas",
    "file": "magias/runas-de-ilusao.md",
    "words": 970,
    "stub": false
  },
  {
    "id": "magias-runas-de-multiplicacao",
    "title": "Runas de Multiplicação",
    "section": "magias",
    "group": "Runas",
    "file": "magias/runas-de-multiplicacao.md",
    "words": 604,
    "stub": false
  },
  {
    "id": "magias-runas-de-projecao",
    "title": "Runas de Projeção",
    "section": "magias",
    "group": "Runas",
    "file": "magias/runas-de-projecao.md",
    "words": 736,
    "stub": false
  },
  {
    "id": "magias-runas-de-reforco",
    "title": "Runas de Reforço",
    "section": "magias",
    "group": "Runas",
    "file": "magias/runas-de-reforco.md",
    "words": 1111,
    "stub": false
  },
  {
    "id": "magias-runas-miscelaneas",
    "title": "Runas Miscelâneas",
    "section": "magias",
    "group": "Runas",
    "file": "magias/runas-miscelaneas.md",
    "words": 758,
    "stub": false
  },
  {
    "id": "regras-regras-pericias",
    "title": "Regras & Pericias",
    "section": "regras",
    "group": "Geral",
    "file": "regras/regras-pericias.md",
    "words": 2388,
    "stub": false
  },
  {
    "id": "regras-vantagens-desvantagens-antecedentes",
    "title": "Vantagens & Desvantagens, Antecedentes",
    "section": "regras",
    "group": "Geral",
    "file": "regras/vantagens-desvantagens-antecedentes.md",
    "words": 2785,
    "stub": false
  }
]
