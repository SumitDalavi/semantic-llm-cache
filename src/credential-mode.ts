export type ProviderMode = 'mock' | 'live';

export interface CredentialStatus {
  openai: ProviderMode;
  redis: ProviderMode;
}

export function isRealOpenAIKey(key?: string): boolean {
  return !!key && key.startsWith('sk-') && !key.startsWith('sk-dummy') && key.length >= 20;
}

export function isRealRedisUrl(url?: string): boolean {
  return !!url && (url.startsWith('redis://') || url.startsWith('rediss://'));
}

export function detectCredentialStatus(): CredentialStatus {
  return {
    openai: isRealOpenAIKey(process.env.OPENAI_API_KEY) ? 'live' : 'mock',
    redis: isRealRedisUrl(process.env.REDIS_URL) ? 'live' : 'mock',
  };
}

export const credentialStatus = detectCredentialStatus();
