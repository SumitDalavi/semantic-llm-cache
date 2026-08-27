import { cosineSimilarity, buildCacheKeyHash, determineTtl } from '../src/embeddings';

describe('Cosine Similarity', () => {
  test('identical vectors return 1.0', () => {
    const v = [1, 0, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  test('orthogonal vectors return 0', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  test('opposite vectors return -1', () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
  });

  test('mismatched lengths return 0', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  test('zero vectors return 0', () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  test('partial overlap produces intermediate value', () => {
    const a = [1, 1, 0];
    const b = [1, 0, 0];
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});

describe('Cache Key Hash', () => {
  test('same params produce same hash', () => {
    const h1 = buildCacheKeyHash('system', 'gpt-4o', 0.7, 1024);
    const h2 = buildCacheKeyHash('system', 'gpt-4o', 0.7, 1024);
    expect(h1).toBe(h2);
  });

  test('different system prompts produce different hashes', () => {
    const h1 = buildCacheKeyHash('system A', 'gpt-4o', 0.7, 1024);
    const h2 = buildCacheKeyHash('system B', 'gpt-4o', 0.7, 1024);
    expect(h1).not.toBe(h2);
  });

  test('different models produce different hashes', () => {
    const h1 = buildCacheKeyHash('system', 'gpt-4o', 0.7, 1024);
    const h2 = buildCacheKeyHash('system', 'gpt-4o-mini', 0.7, 1024);
    expect(h1).not.toBe(h2);
  });

  test('hash is 16 chars', () => {
    const h = buildCacheKeyHash('system', 'gpt-4o', 0.7, 1024);
    expect(h).toHaveLength(16);
  });
});

describe('TTL Determination', () => {
  test('time-sensitive prompts get 1 hour TTL', () => {
    expect(determineTtl('What is the latest news today?')).toBe(3600);
  });

  test('stable definition prompts get 7 day TTL', () => {
    expect(determineTtl('What is the definition of recursion?')).toBe(604800);
  });

  test('generic prompts get default TTL', () => {
    const defaultTtl = parseInt(process.env.DEFAULT_TTL_SECONDS ?? '86400', 10);
    expect(determineTtl('Summarize this paragraph for me.')).toBe(defaultTtl);
  });
});

describe('Embed Text', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key' };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('embedText uses mocked OpenAI client', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }]
    });

    jest.doMock('openai', () => {
      return jest.fn().mockImplementation(() => {
        return {
          embeddings: {
            create: mockCreate
          }
        };
      });
    });

    const { embedText } = require('../src/embeddings');
    const result = await embedText('hello world');
    
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      input: 'hello world',
      model: 'text-embedding-3-small'
    }));
  });
});
