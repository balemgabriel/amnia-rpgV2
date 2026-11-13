/**
 * Avaliador de fórmulas das regras do Amnia.
 *
 * Suporta números, identificadores, `+ - * /`, parênteses e menos unário.
 * Não usa `eval`: é um parser recursivo descendente, seguro para receber
 * fórmulas vindas de dados (inclusive editáveis pelo usuário no futuro).
 */

export type FormulaScope = Record<string, number>

export class FormulaError extends Error {
  constructor(message: string, readonly formula: string) {
    super(`${message} (fórmula: "${formula}")`)
    this.name = 'FormulaError'
  }
}

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '(' | ')' }

function tokenize(formula: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < formula.length) {
    const ch = formula[i] as string

    if (/\s/.test(ch)) {
      i += 1
      continue
    }

    if (/[0-9]/.test(ch)) {
      let raw = ''
      while (i < formula.length && /[0-9.]/.test(formula[i] as string)) {
        raw += formula[i]
        i += 1
      }
      const value = Number(raw)
      if (Number.isNaN(value)) throw new FormulaError(`Número inválido "${raw}"`, formula)
      tokens.push({ kind: 'number', value })
      continue
    }

    if (/[A-Za-zÀ-ÿ_]/.test(ch)) {
      let raw = ''
      while (i < formula.length && /[A-Za-zÀ-ÿ0-9_]/.test(formula[i] as string)) {
        raw += formula[i]
        i += 1
      }
      tokens.push({ kind: 'ident', value: raw })
      continue
    }

    if ('+-*/()'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch as '+' | '-' | '*' | '/' | '(' | ')' })
      i += 1
      continue
    }

    throw new FormulaError(`Caractere inesperado "${ch}"`, formula)
  }

  return tokens
}

/** Extrai os identificadores usados na fórmula (para validar/depurar). */
export function formulaVariables(formula: string): string[] {
  const found = new Set<string>()
  for (const token of tokenize(formula)) {
    if (token.kind === 'ident') found.add(token.value)
  }
  return [...found]
}

/**
 * Compila uma fórmula em uma função. O resultado é memoizado por chamada de
 * `compile`, então chamar a função retornada em loop é barato.
 */
export function compile(formula: string): (scope: FormulaScope) => number {
  const tokens = tokenize(formula)
  let pos = 0

  function peek(): Token | undefined {
    return tokens[pos]
  }

  function eat(): Token {
    const token = tokens[pos]
    if (!token) throw new FormulaError('Fim inesperado da fórmula', formula)
    pos += 1
    return token
  }

  function expectOp(value: '+' | '-' | '*' | '/' | '(' | ')') {
    const token = eat()
    if (token.kind !== 'op' || token.value !== value) {
      throw new FormulaError(`Esperava "${value}"`, formula)
    }
  }

  function parseExpression(): number {
    let value = parseTerm()
    for (;;) {
      const token = peek()
      if (token?.kind !== 'op' || (token.value !== '+' && token.value !== '-')) break
      eat()
      const right = parseTerm()
      value = token.value === '+' ? value + right : value - right
    }
    return value
  }

  function parseTerm(): number {
    let value = parseUnary()
    for (;;) {
      const token = peek()
      if (token?.kind !== 'op' || (token.value !== '*' && token.value !== '/')) break
      eat()
      const right = parseUnary()
      if (token.value === '/' && right === 0) {
        throw new FormulaError('Divisão por zero', formula)
      }
      value = token.value === '*' ? value * right : value / right
    }
    return value
  }

  function parseUnary(): number {
    const token = peek()
    if (token?.kind === 'op' && (token.value === '+' || token.value === '-')) {
      eat()
      const value = parseUnary()
      return token.value === '-' ? -value : value
    }
    return parsePrimary()
  }

  function parsePrimary(): number {
    const token = eat()

    if (token.kind === 'number') return token.value

    if (token.kind === 'ident') {
      const value = scope[token.value]
      if (value === undefined) {
        throw new FormulaError(`Variável desconhecida "${token.value}"`, formula)
      }
      return value
    }

    if (token.value === '(') {
      const value = parseExpression()
      expectOp(')')
      return value
    }

    throw new FormulaError(`Token inesperado "${token.value}"`, formula)
  }

  // `scope` é reatribuído a cada avaliação; por isso a função é declarada antes
  // e recebe o escopo via parâmetro.
  let scope: FormulaScope = {}

  const evaluate = (): number => {
    pos = 0
    const value = parseExpression()
    if (pos !== tokens.length) {
      throw new FormulaError('Sobrou conteúdo no fim da fórmula', formula)
    }
    return value
  }

  return (nextScope: FormulaScope) => {
    scope = nextScope
    return evaluate()
  }
}
