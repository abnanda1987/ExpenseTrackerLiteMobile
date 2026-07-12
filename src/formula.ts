// A minimal, safe arithmetic expression evaluator supporting +, -, *, /
// and parentheses, with standard BODMAS precedence. No eval(), no access
// to anything beyond numbers and these four operators - deliberately
// restrictive since this only needs to handle things like "100+45-56".

export interface EvalResult {
  value: number | null
  error: string | null
}

type Token = { type: 'num'; value: number } | { type: 'op'; value: '+' | '-' | '*' | '/' } | { type: 'paren'; value: '(' | ')' }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === ' ' || ch === '\t') {
      i++
      continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch })
      i++
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let j = i
      let numStr = ''
      while (j < expr.length && /[0-9.]/.test(expr[j])) {
        numStr += expr[j]
        j++
      }
      if ((numStr.match(/\./g) || []).length > 1) {
        throw new Error(`Invalid number "${numStr}"`)
      }
      tokens.push({ type: 'num', value: parseFloat(numStr) })
      i = j
      continue
    }
    throw new Error(`Unexpected character "${ch}"`)
  }
  return tokens
}

// Grammar (standard BODMAS):
//   expression := term (('+' | '-') term)*
//   term       := factor (('*' | '/') factor)*
//   factor     := number | '(' expression ')' | '-' factor

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++]
  }

  parseExpression(): number {
    let value = this.parseTerm()
    while (true) {
      const t = this.peek()
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.next()
        const rhs = this.parseTerm()
        value = t.value === '+' ? value + rhs : value - rhs
      } else {
        break
      }
    }
    return value
  }

  private parseTerm(): number {
    let value = this.parseFactor()
    while (true) {
      const t = this.peek()
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/')) {
        this.next()
        const rhs = this.parseFactor()
        if (t.value === '/') {
          if (rhs === 0) throw new Error('Division by zero')
          value = value / rhs
        } else {
          value = value * rhs
        }
      } else {
        break
      }
    }
    return value
  }

  private parseFactor(): number {
    const t = this.next()
    if (!t) throw new Error('Unexpected end of expression')

    if (t.type === 'op' && t.value === '-') {
      return -this.parseFactor()
    }
    if (t.type === 'op' && t.value === '+') {
      return this.parseFactor()
    }
    if (t.type === 'num') {
      return t.value
    }
    if (t.type === 'paren' && t.value === '(') {
      const value = this.parseExpression()
      const close = this.next()
      if (!close || close.type !== 'paren' || close.value !== ')') {
        throw new Error('Missing closing parenthesis')
      }
      return value
    }
    throw new Error('Invalid expression')
  }

  isAtEnd(): boolean {
    return this.pos >= this.tokens.length
  }
}

export function evaluateExpression(raw: string): EvalResult {
  const expr = raw.trim()
  if (!expr) return { value: null, error: null }

  // Only digits, whitespace, ., + - * / ( ) are allowed - reject anything else
  // up front with a clear message rather than a confusing parser error.
  if (!/^[0-9+\-*/(). \t]+$/.test(expr)) {
    return { value: null, error: 'Only numbers and + - * / ( ) are allowed' }
  }

  try {
    const tokens = tokenize(expr)
    if (tokens.length === 0) return { value: null, error: null }
    const parser = new Parser(tokens)
    const value = parser.parseExpression()
    if (!parser.isAtEnd()) {
      return { value: null, error: 'Invalid expression' }
    }
    if (!isFinite(value)) {
      return { value: null, error: 'Invalid expression' }
    }
    return { value, error: null }
  } catch (err: any) {
    return { value: null, error: err.message || 'Invalid expression' }
  }
}
