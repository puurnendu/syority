/**
 * M7.6E — Formula Engine
 *
 * Metadata-driven expression parser and evaluator.
 * Supports arithmetic, aggregations, conditionals, and provider references.
 *
 * Expression Syntax (SQL-like):
 *   Arithmetic:   +, -, *, /, %, ^
 *   Comparison:   =, !=, <, >, <=, >=
 *   Logical:      AND, OR, NOT
 *   Functions:    SUM, AVG, MIN, MAX, COUNT, COUNTIF, ABS, ROUND, POWER, SQRT, LOG, EXP, MOD
 *   Conditional:  IF(cond, then, else), CASE(val, when1, then1, ..., default)
 *   Aggregation:  WEIGHTED_AVG, ROLLING_AVG, VARIANCE, TREND, MOVING_AVG
 *   Data Access:  PROVIDER('key', 'field'), PROVIDER_COUNT('key')
 *   Constants:    PI, E, TRUE, FALSE, NULL
 *
 * Architecture:
 *   Tokenizer → Parser (recursive descent) → AST → Evaluator
 *   Data reads go through ProviderRegistry — zero raw Prisma.
 */

import { providerRegistry } from '@/core/report-engine/providers';
import type { ProviderContext } from '@/core/report-engine/providers/BaseProvider';

// ═══════════════════════════════════════════════════════════════════════════════
// Token Types
// ═══════════════════════════════════════════════════════════════════════════════

export enum TokenType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',
  OPERATOR = 'OPERATOR',
  COMPARATOR = 'COMPARATOR',
  LOGICAL = 'LOGICAL',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  COMMA = 'COMMA',
  DOT = 'DOT',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AST Node Types
// ═══════════════════════════════════════════════════════════════════════════════

export type ASTNode =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | IdentifierNode
  | BinaryExpression
  | UnaryExpression
  | FunctionCall
  | ConditionalExpression
  | CaseExpression
  | ProviderAccess;

interface NumberLiteral { type: 'NumberLiteral'; value: number }
interface StringLiteral { type: 'StringLiteral'; value: string }
interface BooleanLiteral { type: 'BooleanLiteral'; value: boolean }
interface NullLiteral { type: 'NullLiteral' }
interface IdentifierNode { type: 'Identifier'; name: string }
interface BinaryExpression { type: 'BinaryExpression'; operator: string; left: ASTNode; right: ASTNode }
interface UnaryExpression { type: 'UnaryExpression'; operator: string; operand: ASTNode }
interface FunctionCall { type: 'FunctionCall'; name: string; args: ASTNode[] }
interface ConditionalExpression { type: 'ConditionalExpression'; condition: ASTNode; thenBranch: ASTNode; elseBranch: ASTNode }
interface CaseExpression { type: 'CaseExpression'; subject: ASTNode; whens: { when: ASTNode; then: ASTNode }[]; defaultCase: ASTNode }
interface ProviderAccess { type: 'ProviderAccess'; providerKey: string; field: string }

// ═══════════════════════════════════════════════════════════════════════════════
// Tokenizer
// ═══════════════════════════════════════════════════════════════════════════════

const KEYWORDS = new Set(['AND', 'OR', 'NOT', 'IF', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'TRUE', 'FALSE', 'NULL', 'PROVIDER', 'PROVIDER_COUNT']);
const OPERATORS = new Set(['+', '-', '*', '/', '%', '^']);
const COMPARATORS = ['!=', '<=', '>=', '=', '<', '>'];

export function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    // Skip whitespace
    if (/\s/.test(expression[i])) { i++; continue; }

    const pos = i;

    // Number (integer or decimal)
    if (/[0-9]/.test(expression[i]) || (expression[i] === '.' && i + 1 < expression.length && /[0-9]/.test(expression[i + 1]))) {
      let num = '';
      while (i < expression.length && (/[0-9]/.test(expression[i]) || expression[i] === '.')) {
        num += expression[i++];
      }
      tokens.push({ type: TokenType.NUMBER, value: num, position: pos });
      continue;
    }

    // String literal (single or double quotes)
    if (expression[i] === "'" || expression[i] === '"') {
      const quote = expression[i++];
      let str = '';
      while (i < expression.length && expression[i] !== quote) {
        if (expression[i] === '\\' && i + 1 < expression.length) { str += expression[++i]; }
        else { str += expression[i]; }
        i++;
      }
      if (i < expression.length) i++; // skip closing quote
      tokens.push({ type: TokenType.STRING, value: str, position: pos });
      continue;
    }

    // Comparators (multi-char first)
    const remaining = expression.slice(i);
    const comp = COMPARATORS.find((c) => remaining.startsWith(c));
    if (comp) {
      tokens.push({ type: TokenType.COMPARATOR, value: comp, position: pos });
      i += comp.length;
      continue;
    }

    // Operators
    if (OPERATORS.has(expression[i])) {
      tokens.push({ type: TokenType.OPERATOR, value: expression[i], position: pos });
      i++;
      continue;
    }

    // Parentheses
    if (expression[i] === '(') { tokens.push({ type: TokenType.LPAREN, value: '(', position: pos }); i++; continue; }
    if (expression[i] === ')') { tokens.push({ type: TokenType.RPAREN, value: ')', position: pos }); i++; continue; }
    if (expression[i] === ',') { tokens.push({ type: TokenType.COMMA, value: ',', position: pos }); i++; continue; }
    if (expression[i] === '.') { tokens.push({ type: TokenType.DOT, value: '.', position: pos }); i++; continue; }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(expression[i])) {
      let id = '';
      while (i < expression.length && /[a-zA-Z0-9_]/.test(expression[i])) {
        id += expression[i++];
      }
      const upper = id.toUpperCase();
      if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
        tokens.push({ type: TokenType.LOGICAL, value: upper, position: pos });
      } else {
        tokens.push({ type: TokenType.IDENTIFIER, value: id, position: pos });
      }
      continue;
    }

    throw new FormulaError(`Unexpected character '${expression[i]}' at position ${i}`, i);
  }

  tokens.push({ type: TokenType.EOF, value: '', position: i });
  return tokens;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Parser (Recursive Descent)
// ═══════════════════════════════════════════════════════════════════════════════

export class FormulaParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ASTNode {
    const node = this.parseExpression();
    if (this.current().type !== TokenType.EOF) {
      throw new FormulaError(`Unexpected token '${this.current().value}' at position ${this.current().position}`, this.current().position);
    }
    return node;
  }

  private current(): Token { return this.tokens[this.pos] ?? { type: TokenType.EOF, value: '', position: -1 }; }
  private advance(): Token { return this.tokens[this.pos++]; }
  private expect(type: TokenType, value?: string): Token {
    const tok = this.current();
    if (tok.type !== type || (value !== undefined && tok.value.toUpperCase() !== value.toUpperCase())) {
      throw new FormulaError(`Expected ${value ?? type} but got '${tok.value}' at position ${tok.position}`, tok.position);
    }
    return this.advance();
  }
  private match(type: TokenType, value?: string): boolean {
    const tok = this.current();
    return tok.type === type && (value === undefined || tok.value.toUpperCase() === value.toUpperCase());
  }

  // ── Precedence Levels ──────────────────────────────────────────────────────

  private parseExpression(): ASTNode {
    return this.parseOr();
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.match(TokenType.LOGICAL, 'OR')) {
      this.advance();
      const right = this.parseAnd();
      left = { type: 'BinaryExpression', operator: 'OR', left, right };
    }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseNot();
    while (this.match(TokenType.LOGICAL, 'AND')) {
      this.advance();
      const right = this.parseNot();
      left = { type: 'BinaryExpression', operator: 'AND', left, right };
    }
    return left;
  }

  private parseNot(): ASTNode {
    if (this.match(TokenType.LOGICAL, 'NOT')) {
      this.advance();
      const operand = this.parseNot();
      return { type: 'UnaryExpression', operator: 'NOT', operand };
    }
    return this.parseComparison();
  }

  private parseComparison(): ASTNode {
    let left = this.parseAddition();
    if (this.current().type === TokenType.COMPARATOR) {
      const op = this.advance().value;
      const right = this.parseAddition();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  private parseAddition(): ASTNode {
    let left = this.parseMultiplication();
    while (this.match(TokenType.OPERATOR, '+') || this.match(TokenType.OPERATOR, '-')) {
      const op = this.advance().value;
      const right = this.parseMultiplication();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  private parseMultiplication(): ASTNode {
    let left = this.parseExponent();
    while (this.match(TokenType.OPERATOR, '*') || this.match(TokenType.OPERATOR, '/') || this.match(TokenType.OPERATOR, '%')) {
      const op = this.advance().value;
      const right = this.parseExponent();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  private parseExponent(): ASTNode {
    let left = this.parseUnary();
    if (this.match(TokenType.OPERATOR, '^')) {
      this.advance();
      const right = this.parseExponent(); // right-associative
      left = { type: 'BinaryExpression', operator: '^', left, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.match(TokenType.OPERATOR, '-')) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryExpression', operator: '-', operand };
    }
    if (this.match(TokenType.OPERATOR, '+')) {
      this.advance();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const tok = this.current();

    // Number
    if (tok.type === TokenType.NUMBER) {
      this.advance();
      return { type: 'NumberLiteral', value: parseFloat(tok.value) };
    }

    // String
    if (tok.type === TokenType.STRING) {
      this.advance();
      return { type: 'StringLiteral', value: tok.value };
    }

    // Grouped expression
    if (tok.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    // Identifiers, keywords, functions
    if (tok.type === TokenType.IDENTIFIER) {
      const name = tok.value.toUpperCase();

      // Boolean/null constants
      if (name === 'TRUE') { this.advance(); return { type: 'BooleanLiteral', value: true }; }
      if (name === 'FALSE') { this.advance(); return { type: 'BooleanLiteral', value: false }; }
      if (name === 'NULL') { this.advance(); return { type: 'NullLiteral' }; }
      if (name === 'PI') { this.advance(); return { type: 'NumberLiteral', value: Math.PI }; }
      if (name === 'E') { this.advance(); return { type: 'NumberLiteral', value: Math.E }; }

      // IF(condition, then, else)
      if (name === 'IF') {
        this.advance();
        this.expect(TokenType.LPAREN);
        const condition = this.parseExpression();
        this.expect(TokenType.COMMA);
        const thenBranch = this.parseExpression();
        this.expect(TokenType.COMMA);
        const elseBranch = this.parseExpression();
        this.expect(TokenType.RPAREN);
        return { type: 'ConditionalExpression', condition, thenBranch, elseBranch };
      }

      // CASE(subject, when1, then1, when2, then2, ..., default)
      if (name === 'CASE') {
        this.advance();
        this.expect(TokenType.LPAREN);
        const subject = this.parseExpression();
        const whens: { when: ASTNode; then: ASTNode }[] = [];
        while (this.match(TokenType.COMMA)) {
          this.advance();
          // Check if next comma means we're at default
          const whenOrDefault = this.parseExpression();
          if (this.match(TokenType.COMMA)) {
            this.advance();
            const then = this.parseExpression();
            whens.push({ when: whenOrDefault, then });
          } else {
            // This is the default
            this.expect(TokenType.RPAREN);
            return { type: 'CaseExpression', subject, whens, defaultCase: whenOrDefault };
          }
        }
        this.expect(TokenType.RPAREN);
        return { type: 'CaseExpression', subject, whens, defaultCase: { type: 'NullLiteral' } };
      }

      // PROVIDER('key', 'field')
      if (name === 'PROVIDER') {
        this.advance();
        this.expect(TokenType.LPAREN);
        const keyNode = this.expect(TokenType.STRING);
        this.expect(TokenType.COMMA);
        const fieldNode = this.expect(TokenType.STRING);
        this.expect(TokenType.RPAREN);
        return { type: 'ProviderAccess', providerKey: keyNode.value, field: fieldNode.value };
      }

      // PROVIDER_COUNT('key')
      if (name === 'PROVIDER_COUNT') {
        this.advance();
        this.expect(TokenType.LPAREN);
        const keyNode = this.expect(TokenType.STRING);
        this.expect(TokenType.RPAREN);
        return { type: 'ProviderAccess', providerKey: keyNode.value, field: '_count' };
      }

      // Generic function call: FUNC(arg1, arg2, ...)
      if (this.tokens[this.pos + 1]?.type === TokenType.LPAREN) {
        this.advance();
        this.advance(); // skip LPAREN
        const args: ASTNode[] = [];
        if (!this.match(TokenType.RPAREN)) {
          args.push(this.parseExpression());
          while (this.match(TokenType.COMMA)) {
            this.advance();
            args.push(this.parseExpression());
          }
        }
        this.expect(TokenType.RPAREN);
        return { type: 'FunctionCall', name: name, args };
      }

      // Simple identifier (variable reference)
      this.advance();
      return { type: 'Identifier', name: tok.value };
    }

    throw new FormulaError(`Unexpected token '${tok.value}' at position ${tok.position}`, tok.position);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Evaluator
// ═══════════════════════════════════════════════════════════════════════════════

export interface EvaluationContext {
  providerCtx: ProviderContext;
  variables: Record<string, any>;
  providerParams: Record<string, any>;
  /** Cached provider results to avoid redundant fetches */
  providerCache?: Map<string, any>;
}

const BUILT_IN_FUNCTIONS: Record<string, (args: any[]) => any> = {
  SUM: (args) => args.flat().reduce((s: number, v: any) => s + (Number(v) || 0), 0),
  AVG: (args) => { const flat = args.flat().map(Number).filter((v: number) => !isNaN(v)); return flat.length ? flat.reduce((s: number, v: number) => s + v, 0) / flat.length : 0; },
  MIN: (args) => Math.min(...args.flat().map(Number).filter((v: number) => !isNaN(v))),
  MAX: (args) => Math.max(...args.flat().map(Number).filter((v: number) => !isNaN(v))),
  COUNT: (args) => args.flat().length,
  COUNTIF: (args) => args.flat().filter(Boolean).length,
  ABS: (args) => Math.abs(Number(args[0]) || 0),
  ROUND: (args) => { const [val, dec] = args; return Number((Number(val) || 0).toFixed(Number(dec) || 0)); },
  POWER: (args) => Math.pow(Number(args[0]) || 0, Number(args[1]) || 0),
  SQRT: (args) => Math.sqrt(Number(args[0]) || 0),
  LOG: (args) => args.length > 1 ? Math.log(Number(args[0]) || 1) / Math.log(Number(args[1]) || Math.E) : Math.log(Number(args[0]) || 1),
  EXP: (args) => Math.exp(Number(args[0]) || 0),
  MOD: (args) => (Number(args[0]) || 0) % (Number(args[1]) || 1),
  FLOOR: (args) => Math.floor(Number(args[0]) || 0),
  CEIL: (args) => Math.ceil(Number(args[0]) || 0),
  COALESCE: (args) => args.find((a) => a != null && a !== '') ?? null,
  CONCAT: (args) => args.map(String).join(''),
  // Aggregation
  WEIGHTED_AVG: (args) => {
    // WEIGHTED_AVG(values_array, weights_array)
    const vals = Array.isArray(args[0]) ? args[0] : [args[0]];
    const weights = Array.isArray(args[1]) ? args[1] : [args[1]];
    let sumProduct = 0, sumWeights = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = Number(vals[i]) || 0;
      const w = Number(weights[i]) || 0;
      sumProduct += v * w;
      sumWeights += w;
    }
    return sumWeights > 0 ? sumProduct / sumWeights : 0;
  },
  VARIANCE: (args) => {
    const vals = args.flat().map(Number).filter((v: number) => !isNaN(v));
    if (vals.length < 2) return 0;
    const mean = vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
    return vals.reduce((s: number, v: number) => s + Math.pow(v - mean, 2), 0) / (vals.length - 1);
  },
  STDEV: (args) => {
    const variance = BUILT_IN_FUNCTIONS.VARIANCE(args);
    return Math.sqrt(variance);
  },
  MOVING_AVG: (args) => {
    // MOVING_AVG(values_array, window_size)
    const vals = Array.isArray(args[0]) ? args[0].map(Number) : [];
    const window = Number(args[1]) || 3;
    if (vals.length === 0) return 0;
    const slice = vals.slice(-window);
    return slice.reduce((s: number, v: number) => s + (v || 0), 0) / slice.length;
  },
  ROLLING_AVG: (args) => BUILT_IN_FUNCTIONS.MOVING_AVG(args),
  TREND: (args) => {
    // TREND: returns slope of linear regression on values array
    const vals = Array.isArray(args[0]) ? args[0].map(Number) : [];
    const n = vals.length;
    if (n < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i; sumY += vals[i]; sumXY += i * vals[i]; sumX2 += i * i;
    }
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  },
  PERCENTAGE: (args) => {
    const part = Number(args[0]) || 0;
    const total = Number(args[1]) || 1;
    return total !== 0 ? (part / total) * 100 : 0;
  },
  RATIO: (args) => {
    const a = Number(args[0]) || 0;
    const b = Number(args[1]) || 1;
    return b !== 0 ? a / b : 0;
  },
};

export async function evaluate(node: ASTNode, ctx: EvaluationContext): Promise<any> {
  switch (node.type) {
    case 'NumberLiteral': return node.value;
    case 'StringLiteral': return node.value;
    case 'BooleanLiteral': return node.value;
    case 'NullLiteral': return null;

    case 'Identifier': {
      if (node.name in ctx.variables) return ctx.variables[node.name];
      throw new FormulaError(`Unknown variable '${node.name}'`, -1);
    }

    case 'BinaryExpression': {
      const left = await evaluate(node.left, ctx);
      const right = await evaluate(node.right, ctx);
      return evaluateBinary(node.operator, left, right);
    }

    case 'UnaryExpression': {
      const operand = await evaluate(node.operand, ctx);
      if (node.operator === '-') return -(Number(operand) || 0);
      if (node.operator === 'NOT') return !operand;
      return operand;
    }

    case 'FunctionCall': {
      const fn = BUILT_IN_FUNCTIONS[node.name.toUpperCase()];
      if (!fn) throw new FormulaError(`Unknown function '${node.name}'`, -1);
      const args = await Promise.all(node.args.map((a) => evaluate(a, ctx)));
      return fn(args);
    }

    case 'ConditionalExpression': {
      const cond = await evaluate(node.condition, ctx);
      return cond ? evaluate(node.thenBranch, ctx) : evaluate(node.elseBranch, ctx);
    }

    case 'CaseExpression': {
      const subject = await evaluate(node.subject, ctx);
      for (const w of node.whens) {
        const whenVal = await evaluate(w.when, ctx);
        if (subject === whenVal) return evaluate(w.then, ctx);
      }
      return evaluate(node.defaultCase, ctx);
    }

    case 'ProviderAccess': {
      const cache = ctx.providerCache ?? new Map();
      const cacheKey = `${node.providerKey}::${JSON.stringify(ctx.providerParams)}`;
      let data = cache.get(cacheKey);
      if (!data) {
        data = await providerRegistry.fetch(node.providerKey, ctx.providerCtx, ctx.providerParams);
        cache.set(cacheKey, data);
      }
      if (node.field === '_count') return data.rows?.length ?? 0;
      // Look in kpis first, then rows
      if (data.kpis) {
        const kpi = data.kpis.find((k: any) => k.label === node.field || k.key === node.field);
        if (kpi) return kpi.value;
      }
      if (data.rows) return data.rows.map((r: any) => r[node.field]);
      if (data.summary && node.field === 'summary') return data.summary;
      return null;
    }
  }
}

function evaluateBinary(op: string, left: any, right: any): any {
  switch (op) {
    case '+': return (Number(left) || 0) + (Number(right) || 0);
    case '-': return (Number(left) || 0) - (Number(right) || 0);
    case '*': return (Number(left) || 0) * (Number(right) || 0);
    case '/': { const r = Number(right) || 0; return r !== 0 ? (Number(left) || 0) / r : 0; }
    case '%': { const r = Number(right) || 1; return (Number(left) || 0) % r; }
    case '^': return Math.pow(Number(left) || 0, Number(right) || 0);
    case '=': return left === right;
    case '!=': return left !== right;
    case '<': return (Number(left) || 0) < (Number(right) || 0);
    case '>': return (Number(left) || 0) > (Number(right) || 0);
    case '<=': return (Number(left) || 0) <= (Number(right) || 0);
    case '>=': return (Number(left) || 0) >= (Number(right) || 0);
    case 'AND': return Boolean(left) && Boolean(right);
    case 'OR': return Boolean(left) || Boolean(right);
    default: throw new FormulaError(`Unknown operator '${op}'`, -1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dependency Graph & Validation
// ═══════════════════════════════════════════════════════════════════════════════

export interface FormulaDependency {
  from: string; // formula slug
  to: string;   // depends-on slug
}

/**
 * Extract provider keys referenced in an AST.
 */
export function extractProviderDependencies(node: ASTNode): string[] {
  const deps: string[] = [];
  function walk(n: ASTNode) {
    if (n.type === 'ProviderAccess') { deps.push(n.providerKey); return; }
    if (n.type === 'BinaryExpression') { walk(n.left); walk(n.right); return; }
    if (n.type === 'UnaryExpression') { walk(n.operand); return; }
    if (n.type === 'FunctionCall') { n.args.forEach(walk); return; }
    if (n.type === 'ConditionalExpression') { walk(n.condition); walk(n.thenBranch); walk(n.elseBranch); return; }
    if (n.type === 'CaseExpression') { walk(n.subject); n.whens.forEach((w) => { walk(w.when); walk(w.then); }); walk(n.defaultCase); }
  }
  walk(node);
  return [...new Set(deps)];
}

/**
 * Extract variable names referenced in an AST.
 */
export function extractVariables(node: ASTNode): string[] {
  const vars: string[] = [];
  function walk(n: ASTNode) {
    if (n.type === 'Identifier') { vars.push(n.name); return; }
    if (n.type === 'BinaryExpression') { walk(n.left); walk(n.right); return; }
    if (n.type === 'UnaryExpression') { walk(n.operand); return; }
    if (n.type === 'FunctionCall') { n.args.forEach(walk); return; }
    if (n.type === 'ConditionalExpression') { walk(n.condition); walk(n.thenBranch); walk(n.elseBranch); return; }
    if (n.type === 'CaseExpression') { walk(n.subject); n.whens.forEach((w) => { walk(w.when); walk(w.then); }); walk(n.defaultCase); }
  }
  walk(node);
  return [...new Set(vars)];
}

/**
 * Detect circular references in a dependency graph.
 * Returns the cycle path if found, null otherwise.
 */
export function detectCircularDependency(graph: FormulaDependency[]): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): boolean {
    if (inStack.has(node)) {
      path.push(node);
      return true; // cycle found
    }
    if (visited.has(node)) return false;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const neighbor of adjacency.get(node) ?? []) {
      if (dfs(neighbor)) return true;
    }

    path.pop();
    inStack.delete(node);
    return false;
  }

  for (const node of adjacency.keys()) {
    if (dfs(node)) return path;
  }
  return null;
}

/**
 * Validate a formula expression. Returns errors or empty array.
 */
export function validateExpression(expression: string): { message: string; position: number }[] {
  const errors: { message: string; position: number }[] = [];

  try {
    const tokens = tokenize(expression);
    const parser = new FormulaParser(tokens);
    const ast = parser.parse();

    // Check provider references exist
    const providers = extractProviderDependencies(ast);
    for (const key of providers) {
      if (!providerRegistry.has(key)) {
        errors.push({ message: `Unknown provider '${key}'`, position: -1 });
      }
    }

    // Check functions are known
    function walkFunctions(n: ASTNode) {
      if (n.type === 'FunctionCall' && !BUILT_IN_FUNCTIONS[n.name.toUpperCase()]) {
        errors.push({ message: `Unknown function '${n.name}'`, position: -1 });
      }
      if (n.type === 'BinaryExpression') { walkFunctions(n.left); walkFunctions(n.right); }
      if (n.type === 'UnaryExpression') walkFunctions(n.operand);
      if (n.type === 'FunctionCall') n.args.forEach(walkFunctions);
      if (n.type === 'ConditionalExpression') { walkFunctions(n.condition); walkFunctions(n.thenBranch); walkFunctions(n.elseBranch); }
      if (n.type === 'CaseExpression') { walkFunctions(n.subject); n.whens.forEach((w) => { walkFunctions(w.when); walkFunctions(w.then); }); walkFunctions(n.defaultCase); }
    }
    walkFunctions(ast);
  } catch (err: any) {
    errors.push({ message: err.message, position: err.position ?? -1 });
  }

  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Convenience: Parse + Evaluate
// ═══════════════════════════════════════════════════════════════════════════════

export async function evaluateExpression(
  expression: string,
  ctx: EvaluationContext,
): Promise<any> {
  const tokens = tokenize(expression);
  const parser = new FormulaParser(tokens);
  const ast = parser.parse();
  return evaluate(ast, ctx);
}

/**
 * List all available built-in functions (for autocomplete).
 */
export function listBuiltInFunctions(): { name: string; description: string }[] {
  return [
    { name: 'SUM', description: 'Sum of values' },
    { name: 'AVG', description: 'Average of values' },
    { name: 'MIN', description: 'Minimum value' },
    { name: 'MAX', description: 'Maximum value' },
    { name: 'COUNT', description: 'Count of values' },
    { name: 'COUNTIF', description: 'Count of truthy values' },
    { name: 'ABS', description: 'Absolute value' },
    { name: 'ROUND', description: 'Round to N decimal places' },
    { name: 'POWER', description: 'Raise to power' },
    { name: 'SQRT', description: 'Square root' },
    { name: 'LOG', description: 'Logarithm (base optional, defaults to natural)' },
    { name: 'EXP', description: 'Exponential (e^x)' },
    { name: 'MOD', description: 'Modulus (remainder)' },
    { name: 'FLOOR', description: 'Round down to integer' },
    { name: 'CEIL', description: 'Round up to integer' },
    { name: 'COALESCE', description: 'First non-null value' },
    { name: 'CONCAT', description: 'Concatenate strings' },
    { name: 'WEIGHTED_AVG', description: 'Weighted average of values' },
    { name: 'VARIANCE', description: 'Variance of values' },
    { name: 'STDEV', description: 'Standard deviation' },
    { name: 'MOVING_AVG', description: 'Moving average over window' },
    { name: 'ROLLING_AVG', description: 'Alias for MOVING_AVG' },
    { name: 'TREND', description: 'Linear regression slope' },
    { name: 'PERCENTAGE', description: 'Percentage: (part / total) * 100' },
    { name: 'RATIO', description: 'Ratio: a / b' },
    { name: 'IF', description: 'Conditional: IF(condition, then, else)' },
    { name: 'CASE', description: 'Switch: CASE(subject, when1, then1, ..., default)' },
    { name: 'PROVIDER', description: "Read data: PROVIDER('key', 'field')" },
    { name: 'PROVIDER_COUNT', description: "Row count: PROVIDER_COUNT('key')" },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Error
// ═══════════════════════════════════════════════════════════════════════════════

export class FormulaError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = 'FormulaError';
    this.position = position;
  }
}
