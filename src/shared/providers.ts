// ============================================================================
// Provider Configurations
// ============================================================================

export interface ProviderConfig {
  id: string; // Unique identifier: 'openai-gpt4o', 'claude-sonnet-35'
  name: string; // Display name: 'GPT-4o'
  provider: string; // Provider type: 'openai', 'claude', 'yandex'
  description: string; // Key benefits and use cases
  model: string; // Model identifier for API
  apiUrl: string; // API endpoint URL
  requiresProxy: boolean; // true if CORS proxy needed
  pricing: {
    input: number; // $ per 1M tokens
    output: number; // $ per 1M tokens
  };
  limits?: {
    maxTokens?: number; // Maximum tokens per request
    rateLimit?: string; // Rate limit description
  };
  tags?: string[]; // ['fast', 'cheap', 'smart', 'free']
}

// ============================================================================
// Full list of pre-configured providers (2026 pricing)
// ============================================================================

export const PROVIDER_CONFIGS: ProviderConfig[] = [
  // ==========================================================================
  // LM STUDIO (LOCAL) — First: free, private, no API key needed
  // ==========================================================================
  {
    id: 'lmstudio-custom',
    name: 'LM Studio (Local)',
    provider: 'lmstudio',
    description:
      'Run models locally on your machine. FREE, private, and fully offline-capable.',
    model: 'local-model',
    apiUrl: '{{baseUrl}}/v1', // Template syntax triggers Custom URL field in UI
    requiresProxy: false, // Local server doesn't need proxy
    pricing: { input: 0, output: 0 },
    limits: { maxTokens: 4096, rateLimit: 'Unlimited (local)' },
    tags: ['free', 'private', 'offline', 'local'],
  },

  // ==========================================================================
  // OPENAI — Pricing as of late 2025
  // ==========================================================================
  {
    id: 'openai-gpt4o',
    name: 'GPT-4o',
    provider: 'openai',
    description:
      'Most capable OpenAI model. Best for complex tasks, reasoning, and creativity.',
    model: 'gpt-4o',
    apiUrl: 'https://proxy.uixray.tech/api/openai',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 2.5, output: 10 },
    limits: { maxTokens: 4096, rateLimit: '500 req/min' },
    tags: ['smart', 'creative'],
  },

  {
    id: 'openai-gpt4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description:
      'Affordable and fast. Excellent for bulk generation and simple tasks.',
    model: 'gpt-4o-mini',
    apiUrl: 'https://proxy.uixray.tech/api/openai',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 0.15, output: 0.6 },
    limits: { maxTokens: 4096, rateLimit: '500 req/min' },
    tags: ['cheap', 'fast', 'balanced'],
  },

  // ==========================================================================
  // ANTHROPIC CLAUDE — Pricing as of late 2025
  // ==========================================================================
  {
    id: 'claude-35-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'claude',
    description:
      'Fastest Claude model. Great for simple tasks with quick turnaround.',
    model: 'claude-3-5-haiku-20241022',
    apiUrl: 'https://proxy.uixray.tech/api/claude',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 0.8, output: 4 },
    limits: { maxTokens: 8192, rateLimit: '50 req/min' },
    tags: ['fast', 'cheap', 'anthropic'],
  },

  {
    id: 'claude-35-sonnet',
    name: 'Claude Sonnet 4.5',
    provider: 'claude',
    description:
      'Best balance of quality and speed. Excellent for creative writing and design content.',
    model: 'claude-sonnet-4-5-20250929',
    apiUrl: 'https://proxy.uixray.tech/api/claude',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 3, output: 15 },
    limits: { maxTokens: 8192, rateLimit: '50 req/min' },
    tags: ['balanced', 'creative', 'anthropic'],
  },

  {
    id: 'claude-opus-45',
    name: 'Claude Opus 4.5',
    provider: 'claude',
    description:
      'Most powerful Claude model. Best for complex analysis and high-quality content.',
    model: 'claude-opus-4-5-20250929',
    apiUrl: 'https://proxy.uixray.tech/api/claude',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 15, output: 75 },
    limits: { maxTokens: 8192, rateLimit: '50 req/min' },
    tags: ['smart', 'expensive', 'anthropic'],
  },

  // ==========================================================================
  // GOOGLE GEMINI — Pricing as of late 2025
  // ==========================================================================
  {
    id: 'gemini-25-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description:
      'FREE tier available! Up to 15 req/min. Great for experimentation and prototyping.',
    model: 'gemini-2.5-flash',
    apiUrl: 'https://proxy.uixray.tech/api/gemini',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 0.15, output: 0.6 },
    limits: { maxTokens: 8192, rateLimit: '15 req/min (free tier)' },
    tags: ['free', 'fast', 'experimental', 'google'],
  },

  {
    id: 'gemini-25-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    description:
      'Most capable Gemini model. 1M token context. Excellent for complex reasoning.',
    model: 'gemini-2.5-pro',
    apiUrl: 'https://proxy.uixray.tech/api/gemini',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 1.25, output: 10 },
    limits: { maxTokens: 8192, rateLimit: '360 req/min' },
    tags: ['smart', 'longcontext', 'google'],
  },

  // ==========================================================================
  // GROQ — Ultra-fast inference. Pricing as of late 2025
  // ==========================================================================
  {
    id: 'groq-llama-70b',
    name: 'Llama 3.3 70B (Groq)',
    provider: 'groq',
    description:
      'Ultra-fast inference! Up to 800+ tokens/sec. Perfect for real-time applications.',
    model: 'llama-3.3-70b-versatile',
    apiUrl: 'https://proxy.uixray.tech/api/groq',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 0.59, output: 0.79 },
    limits: { maxTokens: 8192, rateLimit: '30 req/min' },
    tags: ['fast', 'realtime', 'opensource'],
  },

  {
    id: 'groq-llama-8b',
    name: 'Llama 3.1 8B (Groq)',
    provider: 'groq',
    description:
      'Fastest model on Groq. 1000+ tokens/sec. Ultra-cheap for simple tasks.',
    model: 'llama-3.1-8b-instant',
    apiUrl: 'https://proxy.uixray.tech/api/groq',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 0.05, output: 0.08 },
    limits: { maxTokens: 8192, rateLimit: '30 req/min' },
    tags: ['fast', 'cheap', 'opensource'],
  },

  // ==========================================================================
  // MISTRAL AI — Pricing as of late 2025
  // ==========================================================================
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'mistral',
    description:
      'Top-tier European model. Best for complex tasks with EU data residency.',
    model: 'mistral-large-latest',
    apiUrl: 'https://proxy.uixray.tech/api/mistral',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 2, output: 6 },
    limits: { maxTokens: 8192, rateLimit: '60 req/min' },
    tags: ['smart', 'european', 'balanced'],
  },

  {
    id: 'mistral-small',
    name: 'Mistral Small 3.1',
    provider: 'mistral',
    description:
      'Cost-effective European model. Great for standard tasks with fast response.',
    model: 'mistral-small-latest',
    apiUrl: 'https://proxy.uixray.tech/api/mistral',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 0.1, output: 0.3 },
    limits: { maxTokens: 8192, rateLimit: '60 req/min' },
    tags: ['cheap', 'fast', 'european'],
  },

  // ==========================================================================
  // COHERE — Pricing as of late 2025
  // ==========================================================================
  {
    id: 'cohere-command-r-plus',
    name: 'Command R+',
    provider: 'cohere',
    description:
      'Business-focused model. Excellent for enterprise content and summarization.',
    model: 'command-r-plus',
    apiUrl: 'https://proxy.uixray.tech/api/cohere',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 2.5, output: 10 },
    limits: { maxTokens: 4096, rateLimit: '100 req/min' },
    tags: ['business', 'smart', 'enterprise'],
  },

  {
    id: 'cohere-command-r',
    name: 'Command R',
    provider: 'cohere',
    description:
      'Cost-effective business model. Good for high-volume content generation.',
    model: 'command-r',
    apiUrl: 'https://proxy.uixray.tech/api/cohere',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 0.15, output: 0.6 },
    limits: { maxTokens: 4096, rateLimit: '100 req/min' },
    tags: ['business', 'cheap', 'enterprise'],
  },

  // ==========================================================================
  // YANDEX CLOUD — Pricing from yandex.cloud/en/docs/foundation-models/pricing
  // Prices in $/1M tokens (converted from official USD/1K pricing)
  // ==========================================================================
  {
    id: 'yandex-gpt5-lite',
    name: 'YandexGPT 5 Lite',
    provider: 'yandex',
    description:
      'Fastest model. Perfect for simple tasks and drafts. Great for Russian language.',
    model: 'yandexgpt-lite/latest',
    apiUrl: 'https://proxy.uixray.tech/api/yandex',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 1.67, output: 1.67 },
    limits: { maxTokens: 8000, rateLimit: '20 req/sec' },
    tags: ['fast', 'cheap', 'russian'],
  },

  {
    id: 'yandex-gpt5-pro',
    name: 'YandexGPT 5 Pro',
    provider: 'yandex',
    description:
      'Balance of speed and quality. Suitable for most tasks. Best for Russian content.',
    model: 'yandexgpt/latest',
    apiUrl: 'https://proxy.uixray.tech/api/yandex',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 10, output: 10 },
    limits: { maxTokens: 8000, rateLimit: '20 req/sec' },
    tags: ['balanced', 'russian'],
  },

  {
    id: 'yandex-gpt51-pro',
    name: 'YandexGPT 5.1 Pro',
    provider: 'yandex',
    description:
      'Latest generation. Enhanced reasoning and multilingual support. Premium quality.',
    model: 'yandexgpt-51/latest',
    apiUrl: 'https://proxy.uixray.tech/api/yandex',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 6.7, output: 6.7 },
    limits: { maxTokens: 8000, rateLimit: '20 req/sec' },
    tags: ['smart', 'russian', 'multilingual'],
  },

  {
    id: 'yandex-alice-llm',
    name: 'Alice AI LLM',
    provider: 'yandex',
    description:
      'Conversational AI optimized for dialog and creative tasks. Fun and engaging.',
    model: 'alice-llm/latest',
    apiUrl: 'https://proxy.uixray.tech/api/yandex',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 4.2, output: 16.7 },
    limits: { maxTokens: 8000, rateLimit: '20 req/sec' },
    tags: ['creative', 'russian', 'conversational'],
  },

  {
    id: 'yandex-gpt-oss-120b',
    name: 'GPT OSS 120B',
    provider: 'yandex',
    description:
      'Open-source large model. Powerful for complex reasoning and long context.',
    model: 'gpt-oss-120b/latest',
    apiUrl: 'https://proxy.uixray.tech/api/yandex',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 2.5, output: 2.5 },
    limits: { maxTokens: 16000, rateLimit: '10 req/sec' },
    tags: ['opensource', 'smart', 'longcontext'],
  },

  {
    id: 'yandex-gpt-oss-20b',
    name: 'GPT OSS 20B',
    provider: 'yandex',
    description:
      'Smaller open-source model. Faster and cheaper for standard tasks.',
    model: 'gpt-oss-20b/latest',
    apiUrl: 'https://proxy.uixray.tech/api/yandex',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 0.83, output: 0.83 },
    limits: { maxTokens: 8000, rateLimit: '20 req/sec' },
    tags: ['opensource', 'fast', 'cheap'],
  },

  {
    id: 'yandex-gemma3-27b',
    name: 'Gemma 3 27B IT',
    provider: 'yandex',
    description:
      "Google's Gemma hosted on Yandex. Great multilingual support and instruction following.",
    model: 'gemma-3-27b-it/latest',
    apiUrl: 'https://proxy.uixray.tech/api/yandex',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 3.33, output: 3.33 },
    limits: { maxTokens: 8000, rateLimit: '20 req/sec' },
    tags: ['multilingual', 'balanced', 'google'],
  },

  {
    id: 'yandex-qwen3-235b',
    name: 'Qwen3 235B',
    provider: 'yandex',
    description:
      'Alibaba Qwen model. Excellent for multilingual tasks and complex reasoning.',
    model: 'qwen3-235b/latest',
    apiUrl: 'https://proxy.uixray.tech/api/yandex',
    requiresProxy: false, // Already uses proxy URL
    pricing: { input: 4.2, output: 4.2 },
    limits: { maxTokens: 16000, rateLimit: '10 req/sec' },
    tags: ['multilingual', 'smart', 'alibaba'],
  },
];

// ============================================================================
// Grouping providers by category for UI
// ============================================================================

export function getProvidersByCategory(): Record<string, ProviderConfig[]> {
  return {
    'Local Models': PROVIDER_CONFIGS.filter((p) => p.provider === 'lmstudio'),
    OpenAI: PROVIDER_CONFIGS.filter((p) => p.provider === 'openai'),
    'Anthropic Claude': PROVIDER_CONFIGS.filter((p) => p.provider === 'claude'),
    'Google Gemini': PROVIDER_CONFIGS.filter((p) => p.provider === 'gemini'),
    Groq: PROVIDER_CONFIGS.filter((p) => p.provider === 'groq'),
    'Mistral AI': PROVIDER_CONFIGS.filter((p) => p.provider === 'mistral'),
    Cohere: PROVIDER_CONFIGS.filter((p) => p.provider === 'cohere'),
    'Yandex Cloud': PROVIDER_CONFIGS.filter((p) => p.provider === 'yandex'),
  };
}

// ============================================================================
// Helper functions
// ============================================================================

export function getProviderById(id: string): ProviderConfig | undefined {
  return PROVIDER_CONFIGS.find((p) => p.id === id);
}

export function getProvidersByTag(tag: string): ProviderConfig[] {
  return PROVIDER_CONFIGS.filter((p) => p.tags?.includes(tag));
}
