/**
 * M7.6F — ProviderRegistry Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistryClass } from '../ProviderRegistry';
import { BaseProvider, type ProviderContext, type ProviderMeta } from '../BaseProvider';

// ── Mock Provider ───────────────────────────────────────────────────────────

class MockProvider extends BaseProvider {
  key: string;
  private category: string;
  private label: string;

  constructor(key: string, category = 'test', label = 'Mock Provider') {
    super();
    this.key = key;
    this.category = category;
    this.label = label;
  }

  getMeta(): ProviderMeta {
    return {
      key: this.key,
      label: this.label,
      category: this.category,
      description: `Test provider: ${this.key}`,
      parameters: [],
      columns: [],
    };
  }

  async fetch(_ctx: ProviderContext, _params: Record<string, any>) {
    return {
      columns: [{ key: 'value', label: 'Value' }],
      rows: [{ value: 42 }],
      summary: { total: 1 },
    };
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ProviderRegistry', () => {
  let registry: ProviderRegistryClass;

  beforeEach(() => {
    registry = new ProviderRegistryClass();
  });

  it('starts empty', () => {
    expect(registry.size).toBe(0);
    expect(registry.keys()).toEqual([]);
  });

  it('registers a provider', () => {
    registry.register(new MockProvider('test.provider'));
    expect(registry.has('test.provider')).toBe(true);
    expect(registry.size).toBe(1);
  });

  it('registers multiple providers', () => {
    registry.registerAll([
      new MockProvider('a.provider'),
      new MockProvider('b.provider'),
      new MockProvider('c.provider'),
    ]);
    expect(registry.size).toBe(3);
    expect(registry.keys()).toContain('a.provider');
    expect(registry.keys()).toContain('b.provider');
    expect(registry.keys()).toContain('c.provider');
  });

  it('retrieves a registered provider', () => {
    const provider = new MockProvider('my.provider');
    registry.register(provider);
    const retrieved = registry.get('my.provider');
    expect(retrieved).toBe(provider);
  });

  it('returns undefined for unregistered key', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('replaces existing provider on duplicate key', () => {
    const p1 = new MockProvider('dup.key', 'cat1', 'First');
    const p2 = new MockProvider('dup.key', 'cat2', 'Second');
    registry.register(p1);
    registry.register(p2);
    expect(registry.size).toBe(1);
    expect(registry.get('dup.key')?.getMeta().label).toBe('Second');
  });

  it('fetches data from a registered provider', async () => {
    registry.register(new MockProvider('data.source'));
    const result = await registry.fetch('data.source', { organizationId: 'org1' }, {});
    expect(result.rows).toEqual([{ value: 42 }]);
    expect(result.summary.total).toBe(1);
  });

  it('throws on fetch with unregistered key', async () => {
    await expect(
      registry.fetch('missing.key', { organizationId: 'org1' }, {}),
    ).rejects.toThrow('No provider registered for key: missing.key');
  });

  it('lists all provider metadata', () => {
    registry.registerAll([
      new MockProvider('p1', 'planning', 'Planning Provider'),
      new MockProvider('p2', 'safety', 'Safety Provider'),
    ]);
    const all = registry.listAll();
    expect(all).toHaveLength(2);
    expect(all.map((m) => m.key)).toContain('p1');
    expect(all.map((m) => m.key)).toContain('p2');
  });

  it('groups providers by category', () => {
    registry.registerAll([
      new MockProvider('plan.a', 'planning'),
      new MockProvider('plan.b', 'planning'),
      new MockProvider('safe.a', 'safety'),
    ]);
    const grouped = registry.listByCategory();
    expect(grouped['planning']).toHaveLength(2);
    expect(grouped['safety']).toHaveLength(1);
  });

  it('generates backward-compatible DataFetcher map', () => {
    registry.register(new MockProvider('fetcher.test'));
    const map = registry.toDataFetcherMap();
    expect(map).toHaveProperty('fetcher.test');
    expect(typeof map['fetcher.test']).toBe('function');
  });

  it('has() returns false for unregistered key', () => {
    expect(registry.has('nope')).toBe(false);
  });

  it('keys() returns all registered keys', () => {
    registry.registerAll([
      new MockProvider('x'),
      new MockProvider('y'),
      new MockProvider('z'),
    ]);
    expect(registry.keys().sort()).toEqual(['x', 'y', 'z']);
  });
});
