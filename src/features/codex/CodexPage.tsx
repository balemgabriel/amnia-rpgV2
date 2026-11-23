import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock3,
  Home,
  Search,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge, Button, Callout, Card, TextInput } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  CODEX_ARTICLES,
  CODEX_SECTIONS,
  type CodexArticle,
  type CodexSectionId,
} from './manifest.generated'

/** Markdown do export do Notion, copiado para `content/` pelo script de build. */
const rawContent = import.meta.glob<string>('./content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const HOME_ID = 'mundo-indice-do-compendio'
const SECTION_BLURBS: Record<CodexSectionId, string> = {
  mundo: 'História, deuses, culturas e o cenário onde as histórias acontecem.',
  regras: 'Mecânicas, perícias, combate e progressão de personagem.',
  racas: 'Linhagens, castas, traços e os povos de Amnia.',
  itens: 'Armas, armaduras, equipamentos e recursos.',
  magias: 'Círculos, runas, magias e formas de canalização.',
}

interface TocEntry {
  id: string
  text: string
  level: number
}

function contentFor(article: CodexArticle): string {
  const value = rawContent[`./content/${article.file}`]
  return typeof value === 'string' ? value : '*(Conteúdo indisponível nesta versão.)*'
}

function fold(value: string) {
  return value.toLocaleLowerCase('pt-BR')
}

function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'secao'
  )
}

/**
 * ID estável do heading, derivado só do texto. O React pode invocar um
 * componente mais de uma vez em desenvolvimento, então um contador compartilhado
 * trocaria os âncoras do índice; assim o TOC e o título sempre concordam.
 */
function headingId(text: string): string {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + (text.charCodeAt(index) | 0)) | 0
  }
  return `${slugify(text)}-${Math.abs(hash).toString(36)}`
}

/** Títulos do artigo, usados pelo índice "Nesta página" e pelos IDs dos headings. */
function tocFrom(markdown: string): TocEntry[] {
  const entries: TocEntry[] = []
  for (const line of markdown.split('\n')) {
    const match = /^\s{0,3}(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue
    const text = (match[2] ?? '')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .trim()
    entries.push({ id: headingId(text), text, level: match[1]?.length ?? 1 })
  }
  return entries
}

/** Texto puro de um título renderizado pelo react-markdown (pode ter negrito/link). */
function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    return nodeText((node as { props?: { children?: ReactNode } }).props?.children)
  }
  return ''
}

function preferredArticle(): CodexArticle | undefined {
  return CODEX_ARTICLES.find((article) => article.id === HOME_ID) ?? CODEX_ARTICLES[0]
}

function articleFromHash(): CodexArticle | undefined {
  if (typeof window === 'undefined') return undefined
  const id = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''))
  return CODEX_ARTICLES.find((article) => article.id === id)
}

function sectionTitle(id: CodexSectionId) {
  return CODEX_SECTIONS.find((section) => section.id === id)?.title ?? ''
}

type MarkdownProps = {
  markdown: string
  onSelect: (id: string) => void
}

/** Renderizador compartilhado pelo artigo e pelo índice da home. */
function MarkdownContent({ markdown, onSelect }: MarkdownProps) {
  const heading = (level: 1 | 2 | 3 | 4) =>
    function Heading({ children }: { children?: ReactNode }) {
      const Tag = `h${level}` as 'h1'
      return <Tag id={headingId(nodeText(children))}>{children}</Tag>
    }

  return (
    <div className="codex-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: heading(1),
          h2: heading(2),
          h3: heading(3),
          h4: heading(4),
          a({ href, children }) {
            if (href?.startsWith('#/')) {
              const target = href.slice(2)
              return (
                <a
                  href={href}
                  onClick={(event) => {
                    event.preventDefault()
                    onSelect(target)
                  }}
                >
                  {children}
                </a>
              )
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            )
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

/**
 * Codex Amnia: o material do Notion publicado como um site de consulta.
 *
 * O índice vem do manifesto gerado e cada artigo é um arquivo markdown
 * importado como texto. A seleção fica no hash (`#/id-do-artigo`) para que os
 * links internos do próprio material funcionem e a página possa ser compartilhada.
 */
export function CodexPage({ onBack }: { onBack: () => void }) {
  const [selectedId, setSelectedId] = useState(
    () => (articleFromHash() ?? preferredArticle())?.id ?? '',
  )
  const [query, setQuery] = useState('')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CODEX_SECTIONS.map((section) => [section.id, true])),
  )
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activeHeading, setActiveHeading] = useState<string | null>(null)
  const articleRef = useRef<HTMLElement | null>(null)

  // Índice de busca montado uma vez: título, seção, grupo e texto do artigo.
  const searchIndex = useMemo(
    () =>
      new Map(
        CODEX_ARTICLES.map((article) => [
          article.id,
          fold(`${article.title} ${article.group} ${sectionTitle(article.section)} ${contentFor(article)}`),
        ]),
      ),
    [],
  )

  const normalizedQuery = fold(query.trim())
  const matches = useMemo(() => {
    if (!normalizedQuery) return CODEX_ARTICLES
    return CODEX_ARTICLES.filter((article) => searchIndex.get(article.id)?.includes(normalizedQuery))
  }, [normalizedQuery, searchIndex])

  const grouped = useMemo(
    () =>
      CODEX_SECTIONS.map((section) => ({
        section,
        articles: matches
          .filter((article) => article.section === section.id)
          .sort(
            (a, b) =>
              a.group.localeCompare(b.group, 'pt-BR') || a.title.localeCompare(b.title, 'pt-BR'),
          ),
      })).filter((group) => group.articles.length > 0),
    [matches],
  )

  const sectionCards = useMemo(
    () =>
      CODEX_SECTIONS.map((section) => ({
        ...section,
        pages: CODEX_ARTICLES.filter((article) => article.section === section.id).length,
        featured: CODEX_ARTICLES.find(
          (article) => article.section === section.id && !article.stub,
        ),
      })),
    [],
  )

  const current = CODEX_ARTICLES.find((article) => article.id === selectedId)
  const currentIndex = CODEX_ARTICLES.findIndex((article) => article.id === selectedId)
  const previous = currentIndex > 0 ? CODEX_ARTICLES[currentIndex - 1] : undefined
  const next = currentIndex >= 0 ? CODEX_ARTICLES[currentIndex + 1] : undefined
  const currentSection = CODEX_SECTIONS.find((section) => section.id === current?.section)
  const isHome = current?.id === HOME_ID
  const markdown = current ? contentFor(current) : ''
  const toc = useMemo(() => tocFrom(markdown), [markdown])
  const readingMinutes = Math.max(1, Math.round((current?.words ?? 0) / 200))

  useEffect(() => {
    function syncFromUrl() {
      const fromHash = articleFromHash()
      if (fromHash) setSelectedId(fromHash.id)
    }
    window.addEventListener('hashchange', syncFromUrl)
    window.addEventListener('popstate', syncFromUrl)
    return () => {
      window.removeEventListener('hashchange', syncFromUrl)
      window.removeEventListener('popstate', syncFromUrl)
    }
  }, [])

  useEffect(() => {
    setActiveHeading(null)
    if (isHome || typeof IntersectionObserver === 'undefined') return
    const nodes = toc
      .map((entry) => document.getElementById(entry.id))
      .filter((node): node is HTMLElement => node !== null)
    if (nodes.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveHeading(visible[0].target.id)
      },
      { rootMargin: '-96px 0px -70% 0px' },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [toc, isHome, selectedId])

  function selectArticle(id: string) {
    if (!CODEX_ARTICLES.some((article) => article.id === id)) return
    setSelectedId(id)
    setMobileNavOpen(false)
    const hash = `#/${id}`
    if (window.location.hash !== hash) window.history.pushState(null, '', hash)
    window.scrollTo({ top: 0 })
    articleRef.current?.scrollTo({ top: 0 })
  }

  function toggleSection(id: CodexSectionId) {
    setOpenSections((state) => ({ ...state, [id]: state[id] === false }))
  }

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveHeading(id)
  }

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-ink/10 bg-parchment/95 backdrop-blur">
        <div className="mx-auto flex max-w-[92rem] items-center gap-3 px-4 py-2.5 sm:px-6">
          <Button variant="quiet" onClick={onBack} className="shrink-0 px-2 text-xs">
            <Home className="size-3.5" aria-hidden />
            Início
          </Button>
          <div className="mx-auto flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full border border-gold/50 bg-gold/10 font-display text-lg text-gold shadow-[0_0_0_3px_rgba(176,141,87,0.08)]"
            >
              ✦
            </span>
            <div className="min-w-0 text-center sm:text-left">
              <h1 className="truncate font-display text-xl leading-none tracking-[0.16em] sm:text-2xl">
                CODEX AMNIA
              </h1>
              <p className="mt-1 hidden text-[9px] uppercase tracking-[0.24em] text-ink-soft sm:block">
                O compêndio do mundo de Amnia
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-[10px] uppercase tracking-[0.14em] text-ink-soft md:inline">
              {CODEX_ARTICLES.length} páginas
            </span>
            <Button
              variant="ghost"
              className="px-2 lg:hidden"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-expanded={mobileNavOpen}
            >
              <BookOpen className="size-4" aria-hidden />
              Índice
            </Button>
          </div>
        </div>
        <div
          aria-hidden
          className="h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
        />
      </header>

      <main
        className={cn(
          'mx-auto grid max-w-[92rem] gap-6 px-4 py-6 sm:px-6 lg:py-8',
          isHome
            ? 'lg:grid-cols-[16rem_minmax(0,1fr)]'
            : 'lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_13rem]',
        )}
      >
        <aside aria-label="Índice do Codex" className={cn('lg:block', mobileNavOpen ? 'block' : 'hidden')}>
          <div className="codex-scroll lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <Card className="p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
                  Índice
                </p>
                <button
                  type="button"
                  onClick={() => selectArticle(HOME_ID)}
                  className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gold transition hover:text-accent"
                >
                  Início do Codex
                </button>
              </div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
                  aria-hidden
                />
                <TextInput
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar no Codex…"
                  aria-label="Buscar no Codex"
                  className="pl-9 pr-8"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-soft transition hover:bg-ink/5 hover:text-ink"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                {matches.length} {matches.length === 1 ? 'página' : 'páginas'}
              </p>

              <nav aria-label="Páginas" className="mt-3 space-y-3">
                {grouped.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-ink-soft">
                    Nenhuma página encontrada para “{query}”.
                  </p>
                ) : (
                  grouped.map(({ section, articles }) => {
                    const expanded = normalizedQuery.length > 0 || openSections[section.id] !== false
                    return (
                      <div key={section.id}>
                        <button
                          type="button"
                          onClick={() => toggleSection(section.id)}
                          aria-expanded={expanded}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                        >
                          <span aria-hidden className="text-base leading-none">
                            {section.icon}
                          </span>
                          <span className="flex-1 text-left font-display text-base tracking-wide">
                            {section.title}
                          </span>
                          <span className="text-[10px] text-ink-soft">{articles.length}</span>
                          {expanded ? (
                            <ChevronDown className="size-3.5 text-ink-soft" aria-hidden />
                          ) : (
                            <ChevronRight className="size-3.5 text-ink-soft" aria-hidden />
                          )}
                        </button>
                        {expanded ? (
                          <div className="mt-1 space-y-0.5 border-l border-gold/25 pl-2">
                            {articles.map((article) => (
                              <button
                                key={article.id}
                                type="button"
                                onClick={() => selectArticle(article.id)}
                                aria-current={article.id === selectedId ? 'page' : undefined}
                                className={cn(
                                  'block w-full rounded-md px-2.5 py-1.5 text-left text-sm leading-snug transition',
                                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                                  article.id === selectedId
                                    ? 'border-l-2 border-gold bg-gold/12 font-semibold text-ink'
                                    : 'text-ink-soft hover:bg-ink/5 hover:text-ink',
                                )}
                              >
                                {article.title}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </nav>
            </Card>
          </div>
        </aside>

        {normalizedQuery && matches.length === 0 ? (
          <Callout tone="warn">Nada encontrado. Tente outro termo ou limpe a busca.</Callout>
        ) : null}

        {isHome ? (
          <div className="min-w-0">
            <section className="codex-hero relative mb-8 overflow-hidden rounded-2xl border border-gold/25 px-6 py-10 text-center sm:px-10 sm:py-14">
              <p className="relative text-[11px] font-semibold uppercase tracking-[0.32em] text-gold">
                Compêndio interativo
              </p>
              <h2 className="relative mt-4 font-display text-4xl leading-tight tracking-wide sm:text-6xl">
                O mundo de Amnia
              </h2>
              <p className="relative mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">
                Todo o material original organizado para consulta: regras, lore, raças, itens e os
                mistérios do Arcanae.
              </p>
              <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button onClick={() => selectArticle('regras-regras-pericias')}>
                  Explorar as regras
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
                <Button variant="ghost" onClick={() => selectArticle('magias-magia')}>
                  Abrir a Magia
                </Button>
              </div>
              <div className="codex-ornament relative mt-8" aria-hidden>
                ✦
              </div>
            </section>

            <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sectionCards.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  disabled={!section.featured}
                  onClick={() => section.featured && selectArticle(section.featured.id)}
                  className="codex-section-card group rounded-xl border border-ink/10 bg-white/50 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="text-2xl leading-none">
                      {section.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg tracking-wide">{section.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                        {SECTION_BLURBS[section.id]}
                      </p>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
                        {section.pages} páginas · abrir
                      </p>
                    </div>
                    <ArrowRight
                      className="size-4 shrink-0 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-gold"
                      aria-hidden
                    />
                  </div>
                </button>
              ))}
            </div>

            <section className="codex-paper rounded-2xl border border-ink/10 bg-white/55 p-5 sm:p-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
                Comece por aqui
              </p>
              <h3 className="mt-1 font-display text-2xl tracking-wide">Leituras essenciais</h3>
              <div className="codex-ornament my-4" aria-hidden>
                ✦
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {sectionCards
                  .filter((section) => section.featured)
                  .map((section) => (
                    <li key={section.id}>
                      <button
                        type="button"
                        onClick={() => section.featured && selectArticle(section.featured.id)}
                        className="group flex w-full items-center gap-2 rounded-lg border border-ink/8 bg-parchment/40 px-3 py-2.5 text-left transition hover:border-gold/50 hover:bg-white/70"
                      >
                        <span aria-hidden className="text-base">
                          {section.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {section.featured?.title}
                        </span>
                        <ArrowRight
                          className="size-3.5 shrink-0 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-gold"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
              </ul>

              <details className="mt-7 border-t border-ink/10 pt-5">
                <summary className="cursor-pointer font-display text-lg tracking-wide text-ink-soft transition hover:text-ink">
                  Índice completo do material original
                </summary>
                <div className="mt-4">
                  <MarkdownContent markdown={markdown} onSelect={selectArticle} />
                </div>
              </details>
            </section>
          </div>
        ) : (
          <>
            <article ref={articleRef} className="min-w-0">
              <nav
                aria-label="Trilha de navegação"
                className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-soft"
              >
                <button
                  type="button"
                  onClick={() => selectArticle(HOME_ID)}
                  className="transition hover:text-accent"
                >
                  Codex
                </button>
                <ChevronRight className="size-3" aria-hidden />
                <span>{currentSection?.title ?? 'Artigo'}</span>
                {current && current.group !== 'Geral' ? (
                  <>
                    <ChevronRight className="size-3" aria-hidden />
                    <span>{current.group}</span>
                  </>
                ) : null}
                <ChevronRight className="size-3" aria-hidden />
                <span className="font-semibold text-ink">{current?.title ?? ''}</span>
              </nav>

              <div className="codex-paper rounded-2xl border border-ink/10 bg-white/55 px-5 py-6 sm:px-8 sm:py-8">
                {current ? (
                  <>
                    <div className="mb-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="gold">
                          {currentSection?.icon} {currentSection?.title}
                        </Badge>
                        {current.group !== 'Geral' ? <Badge>{current.group}</Badge> : null}
                        {current.stub ? <Badge tone="warn">Página vazia</Badge> : null}
                      </div>
                      <h2 className="mt-4 font-display text-3xl leading-tight tracking-wide sm:text-4xl">
                        {current.title}
                      </h2>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
                        <span>{current.words} palavras</span>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="size-3" aria-hidden />
                          ~{readingMinutes} min de leitura
                        </span>
                      </div>
                      <div className="codex-ornament mt-5" aria-hidden>
                        ✦
                      </div>
                    </div>

                    {current.stub ? (
                      <Callout tone="warn">
                        Esta página existe no material original, mas ainda não tem conteúdo publicado.
                      </Callout>
                    ) : null}

                    {toc.length > 0 ? (
                      <div className="xl:hidden">
                        <details className="mb-6 rounded-lg border border-ink/10 bg-parchment/40 px-3 py-2 text-sm">
                          <summary className="cursor-pointer font-semibold text-ink-soft">
                            Nesta página ({toc.length})
                          </summary>
                          <ul className="mt-2 space-y-1 pb-1">
                            {toc.map((entry) => (
                              <li key={entry.id} style={{ paddingLeft: `${(entry.level - 1) * 0.6}rem` }}>
                                <button
                                  type="button"
                                  onClick={() => jumpTo(entry.id)}
                                  className="text-left text-xs text-ink-soft transition hover:text-accent"
                                >
                                  {entry.text}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    ) : null}

                    <MarkdownContent markdown={markdown} onSelect={selectArticle} />

                    <nav
                      aria-label="Navegação entre páginas"
                      className="no-print mt-10 grid gap-3 border-t border-ink/10 pt-6 sm:grid-cols-2"
                    >
                      {previous ? (
                        <button
                          type="button"
                          onClick={() => selectArticle(previous.id)}
                          className="codex-nav-card rounded-xl border border-ink/10 bg-parchment/40 px-4 py-3 text-left"
                        >
                          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                            <ArrowLeft className="size-3" aria-hidden /> Anterior
                          </span>
                          <span className="mt-1 block truncate font-display text-base tracking-wide">
                            {previous.title}
                          </span>
                        </button>
                      ) : (
                        <div />
                      )}
                      {next ? (
                        <button
                          type="button"
                          onClick={() => selectArticle(next.id)}
                          className="codex-nav-card rounded-xl border border-ink/10 bg-parchment/40 px-4 py-3 text-right"
                        >
                          <span className="flex items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                            Próxima <ArrowRight className="size-3" aria-hidden />
                          </span>
                          <span className="mt-1 block truncate font-display text-base tracking-wide">
                            {next.title}
                          </span>
                        </button>
                      ) : (
                        <div />
                      )}
                    </nav>
                  </>
                ) : (
                  <Callout>Escolha uma página no índice para começar a leitura.</Callout>
                )}
              </div>
            </article>

            {toc.length > 1 && current ? (
              <aside aria-label="Nesta página" className="hidden xl:block">
                <div className="codex-scroll sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pl-2">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
                    Nesta página
                  </p>
                  <ul className="space-y-0.5 border-l border-ink/10">
                    {toc.map((entry) => (
                      <li key={entry.id} style={{ paddingLeft: `${(entry.level - 1) * 0.55}rem` }}>
                        <a
                          href={`#${entry.id}`}
                          onClick={(event) => {
                            event.preventDefault()
                            jumpTo(entry.id)
                          }}
                          className={cn(
                            '-ml-px block border-l-2 py-1 pl-3 text-xs leading-snug transition',
                            activeHeading === entry.id
                              ? 'border-gold font-semibold text-ink'
                              : 'border-transparent text-ink-soft hover:border-gold/50 hover:text-ink',
                          )}
                        >
                          {entry.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <div className="codex-ornament mt-6 text-[9px]" aria-hidden>
                    ✦
                  </div>
                </div>
              </aside>
            ) : null}
          </>
        )}
      </main>

      <footer className="no-print mx-auto mt-12 max-w-[92rem] border-t border-ink/10 px-4 py-8 text-center sm:px-6">
        <div className="codex-ornament mx-auto max-w-sm" aria-hidden>
          ✦
        </div>
        <p className="mt-4 font-display text-sm tracking-[0.2em] text-ink-soft">CODEX AMNIA</p>
        <p className="mt-1 text-[11px] text-ink-soft">
          Compêndio interativo · material original de Amnia v2
        </p>
        <Button variant="quiet" onClick={onBack} className="mt-3 text-xs">
          Voltar ao assistente de fichas
        </Button>
      </footer>
    </div>
  )
}
