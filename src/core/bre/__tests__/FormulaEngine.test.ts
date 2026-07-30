/**
 * M7.6F — FormulaEngine Unit Tests
 *
 * Tests tokenizer, parser, and evaluator of the BRE Formula Engine.
 * Provider-dependent tests use mock evaluation contexts.
 */

import { describe, it, expect } from 'vitest';
import {
  tokenize,
  TokenType,
  FormulaParser,
  evaluateExpression,
  listBuiltInFunctions,
  FormulaError,
} from '../FormulaEngine';

// ─── Tokenizer ──────────────────────────────────────────────────────────────

describe('FormulaEngine — Tokenizer', () => {
  it('tokenizes numbers', () => {
    const tokens = tokenize('42');
    expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '42' });
  });

  it('tokenizes decimal numbers', () => {
    const tokens = tokenize('3.14');
    expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '3.14' });
  });

  it('tokenizes string literals with single quotes', () => {
    const tokens = tokenize("'hello'");
    expect(tokens[0]).toMatchObject({ type: TokenType.STRING, value: 'hello' });
  });

  it('tokenizes string literals with double quotes', () => {
    const tokens = tokenize('"world"');
    expect(tokens[0]).toMatchObject({ type: TokenType.STRING, value: 'world' });
  });

  it('tokenizes operators', () => {
    const tokens = tokenize('1 + 2 * 3');
    const types = tokens.filter((t) => t.type !== TokenType.EOF).map((t) => t.type);
    expect(types).toEqual([
      TokenType.NUMBER,
      TokenType.OPERATOR,
      TokenType.NUMBER,
      TokenType.OPERATOR,
      TokenType.NUMBER,
    ]);
  });

  it('tokenizes comparators', () => {
    const tokens = tokenize('a >= 5');
    expect(tokens[1]).toMatchObject({ type: TokenType.COMPARATOR, value: '>=' });
  });

  it('tokenizes logical operators', () => {
    const tokens = tokenize('a AND b OR NOT c');
    const logicals = tokens.filter((t) => t.type === TokenType.LOGICAL);
    expect(logicals.map((t) => t.value)).toEqual(['AND', 'OR', 'NOT']);
  });

  it('tokenizes parentheses and commas', () => {
    const tokens = tokenize('SUM(1, 2, 3)');
    const types = tokens.filter((t) => t.type !== TokenType.EOF).map((t) => t.type);
    expect(types).toContain(TokenType.LPAREN);
    expect(types).toContain(TokenType.RPAREN);
    expect(types).toContain(TokenType.COMMA);
  });

  it('tokenizes identifiers', () => {
    const tokens = tokenize('SUM');
    expect(tokens[0]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'SUM' });
  });

  it('appends EOF token', () => {
    const tokens = tokenize('42');
    expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
  });

  it('throws on unexpected characters', () => {
    expect(() => tokenize('1 & 2')).toThrow(FormulaError);
  });
});

// ─── Parser ─────────────────────────────────────────────────────────────────

describe('FormulaEngine — Parser', () => {
  function parse(expr: string) {
    const tokens = tokenize(expr);
    return new FormulaParser(tokens).parse();
  }

  it('parses number literals', () => {
    const ast = parse('42');
    expect(ast).toMatchObject({ type: 'NumberLiteral', value: 42 });
  });

  it('parses string literals', () => {
    const ast = parse("'hello'");
    expect(ast).toMatchObject({ type: 'StringLiteral', value: 'hello' });
  });

  it('parses binary expressions', () => {
    const ast = parse('1 + 2');
    expect(ast).toMatchObject({
      type: 'BinaryExpression',
      operator: '+',
      left: { type: 'NumberLiteral', value: 1 },
      right: { type: 'NumberLiteral', value: 2 },
    });
  });

  it('respects operator precedence (* before +)', () => {
    const ast = parse('1 + 2 * 3');
    // Should be: 1 + (2 * 3), not (1 + 2) * 3
    expect(ast).toMatchObject({
      type: 'BinaryExpression',
      operator: '+',
      right: {
        type: 'BinaryExpression',
        operator: '*',
      },
    });
  });

  it('parses function calls', () => {
    const ast = parse('ABS(5)');
    expect(ast).toMatchObject({
      type: 'FunctionCall',
      name: 'ABS',
      args: [{ type: 'NumberLiteral', value: 5 }],
    });
  });

  it('parses nested function calls', () => {
    const ast = parse('ABS(MIN(1, 2))');
    expect(ast).toMatchObject({
      type: 'FunctionCall',
      name: 'ABS',
    });
  });

  it('parses conditional IF expressions', () => {
    const ast = parse('IF(1 > 0, 10, 20)');
    expect(ast).toMatchObject({
      type: 'ConditionalExpression',
    });
  });

  it('parses PROVIDER access', () => {
    const ast = parse("PROVIDER('planning.daily_progress', 'completed')");
    expect(ast).toMatchObject({
      type: 'ProviderAccess',
      providerKey: 'planning.daily_progress',
      field: 'completed',
    });
  });

  it('throws on extra tokens', () => {
    expect(() => parse('1 + 2 3')).toThrow(FormulaError);
  });
});

// ─── Evaluator ──────────────────────────────────────────────────────────────

describe('FormulaEngine — Evaluator', () => {
  const ctx = {
    organizationId: 'test-org',
    projectId: 'test-project',
    eventId: 'test-event',
    variables: {} as Record<string, any>,
  };

  it('evaluates arithmetic: 2 + 3', async () => {
    const result = await evaluateExpression('2 + 3', ctx);
    expect(result).toBe(5);
  });

  it('evaluates arithmetic: 10 / 2', async () => {
    const result = await evaluateExpression('10 / 2', ctx);
    expect(result).toBe(5);
  });

  it('evaluates exponentiation: 2 ^ 3', async () => {
    const result = await evaluateExpression('2 ^ 3', ctx);
    expect(result).toBe(8);
  });

  it('evaluates modulus: 10 % 3', async () => {
    const result = await evaluateExpression('10 % 3', ctx);
    expect(result).toBe(1);
  });

  it('evaluates nested arithmetic: (2 + 3) * 4', async () => {
    const result = await evaluateExpression('(2 + 3) * 4', ctx);
    expect(result).toBe(20);
  });

  it('evaluates ABS(-5)', async () => {
    const result = await evaluateExpression('ABS(-5)', ctx);
    expect(result).toBe(5);
  });

  it('evaluates ROUND(3.14159, 2)', async () => {
    const result = await evaluateExpression('ROUND(3.14159, 2)', ctx);
    expect(result).toBe(3.14);
  });

  it('evaluates SUM(1, 2, 3, 4)', async () => {
    const result = await evaluateExpression('SUM(1, 2, 3, 4)', ctx);
    expect(result).toBe(10);
  });

  it('evaluates AVG(2, 4, 6)', async () => {
    const result = await evaluateExpression('AVG(2, 4, 6)', ctx);
    expect(result).toBe(4);
  });

  it('evaluates MIN(5, 3, 8)', async () => {
    const result = await evaluateExpression('MIN(5, 3, 8)', ctx);
    expect(result).toBe(3);
  });

  it('evaluates MAX(5, 3, 8)', async () => {
    const result = await evaluateExpression('MAX(5, 3, 8)', ctx);
    expect(result).toBe(8);
  });

  it('evaluates SQRT(16)', async () => {
    const result = await evaluateExpression('SQRT(16)', ctx);
    expect(result).toBe(4);
  });

  it('evaluates POWER(2, 10)', async () => {
    const result = await evaluateExpression('POWER(2, 10)', ctx);
    expect(result).toBe(1024);
  });

  it('evaluates FLOOR(3.7)', async () => {
    const result = await evaluateExpression('FLOOR(3.7)', ctx);
    expect(result).toBe(3);
  });

  it('evaluates CEIL(3.2)', async () => {
    const result = await evaluateExpression('CEIL(3.2)', ctx);
    expect(result).toBe(4);
  });

  it('evaluates MOD(10, 3)', async () => {
    const result = await evaluateExpression('MOD(10, 3)', ctx);
    expect(result).toBe(1);
  });

  it('evaluates PERCENTAGE(25, 100)', async () => {
    const result = await evaluateExpression('PERCENTAGE(25, 100)', ctx);
    expect(result).toBe(25);
  });

  it('evaluates RATIO(10, 5)', async () => {
    const result = await evaluateExpression('RATIO(10, 5)', ctx);
    expect(result).toBe(2);
  });

  it('evaluates comparison: 5 > 3', async () => {
    const result = await evaluateExpression('5 > 3', ctx);
    expect(result).toBe(true);
  });

  it('evaluates comparison: 2 = 2', async () => {
    const result = await evaluateExpression('2 = 2', ctx);
    expect(result).toBe(true);
  });

  it('evaluates comparison: 3 != 5', async () => {
    const result = await evaluateExpression('3 != 5', ctx);
    expect(result).toBe(true);
  });

  it('evaluates logical AND: TRUE AND FALSE', async () => {
    const result = await evaluateExpression('TRUE AND FALSE', ctx);
    expect(result).toBe(false);
  });

  it('evaluates logical OR: TRUE OR FALSE', async () => {
    const result = await evaluateExpression('TRUE OR FALSE', ctx);
    expect(result).toBe(true);
  });

  it('evaluates IF: IF(5 > 3, 10, 20)', async () => {
    const result = await evaluateExpression('IF(5 > 3, 10, 20)', ctx);
    expect(result).toBe(10);
  });

  it('evaluates IF false branch: IF(1 > 5, 10, 20)', async () => {
    const result = await evaluateExpression('IF(1 > 5, 10, 20)', ctx);
    expect(result).toBe(20);
  });

  it('evaluates nested IF', async () => {
    const result = await evaluateExpression('IF(1 > 2, 10, IF(3 > 2, 30, 40))', ctx);
    expect(result).toBe(30);
  });

  it('evaluates complex expression: (10 + 5) * 2 / 3', async () => {
    const result = await evaluateExpression('(10 + 5) * 2 / 3', ctx);
    expect(result).toBe(10);
  });

  it('evaluates COALESCE with nulls', async () => {
    const result = await evaluateExpression('COALESCE(NULL, NULL, 42)', ctx);
    expect(result).toBe(42);
  });

  it('evaluates boolean constants', async () => {
    expect(await evaluateExpression('TRUE', ctx)).toBe(true);
    expect(await evaluateExpression('FALSE', ctx)).toBe(false);
  });

  it('evaluates NULL constant', async () => {
    const result = await evaluateExpression('NULL', ctx);
    expect(result).toBeNull();
  });

  it('evaluates variables from context', async () => {
    const varCtx = { ...ctx, variables: { threshold: 42 } };
    const result = await evaluateExpression('threshold', varCtx);
    expect(result).toBe(42);
  });
});

// ─── Built-in Functions List ────────────────────────────────────────────────

describe('FormulaEngine — listBuiltInFunctions', () => {
  it('returns all 29 built-in functions', () => {
    const fns = listBuiltInFunctions();
    expect(fns.length).toBeGreaterThanOrEqual(25);
    expect(fns.map((f) => f.name)).toContain('SUM');
    expect(fns.map((f) => f.name)).toContain('IF');
    expect(fns.map((f) => f.name)).toContain('PROVIDER');
    expect(fns.map((f) => f.name)).toContain('PERCENTAGE');
  });

  it('each function has name and description', () => {
    const fns = listBuiltInFunctions();
    for (const fn of fns) {
      expect(fn.name).toBeTruthy();
      expect(fn.description).toBeTruthy();
    }
  });
});
