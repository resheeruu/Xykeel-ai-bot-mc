import type { AIProvider } from "./provider.js";
import type { XykeelLogger } from "../logging/logger.js";
import type { XykeelConfig } from "../config/config.js";
import { createProviderRegistry, type ProviderRegistry } from "./provider-registry.js";

export interface AIRouterMetrics {
  configuredProviders: number;
  availableProviders: number;
  cooldownProviders: number;
  quotaExhaustedProviders: number;
  currentProvider: string | null;
  lastSuccessfulProvider: string | null;
  totalRequests: number;
  fallbackCount: number;
  providerFailures: number;
  averageLatency: number;
  ravenAvailable: boolean;
  deterministicFallbackUsed: number;
}

export interface MultiProviderRouter extends AIProvider {
  getRegistry(): ProviderRegistry;
  getMetrics(): AIRouterMetrics;
}

const PROVIDER_ORDER: Array<{ name: string; priority: number }> = [
  { name: "openai", priority: 1 },
  { name: "anthropic", priority: 2 },
  { name: "gemini", priority: 3 },
  { name: "vertex", priority: 4 },
  { name: "groq", priority: 5 },
  { name: "deepseek", priority: 6 },
  { name: "xai", priority: 7 },
  { name: "mistral", priority: 8 },
  { name: "cohere", priority: 9 },
  { name: "together", priority: 10 },
  { name: "openrouter", priority: 11 },
  { name: "huggingface", priority: 12 },
  { name: "nvidia", priority: 13 },
  { name: "fireworks", priority: 14 },
  { name: "cerebras", priority: 15 },
  { name: "sambanova", priority: 16 },
  { name: "novita", priority: 17 },
  { name: "hyperbolic", priority: 18 },
  { name: "moonshot", priority: 19 },
  { name: "zai", priority: 20 },
  { name: "ai21", priority: 21 },
  { name: "perplexity", priority: 22 },
  { name: "deepinfra", priority: 23 },
  { name: "nebius", priority: 24 },
  { name: "lambda", priority: 25 },
  { name: "baseten", priority: 26 },
  { name: "friendli", priority: 27 },
  { name: "chutes", priority: 28 },
  { name: "featherless", priority: 29 },
  { name: "azure", priority: 30 },
];

export function createMultiProviderRouter(
  config: XykeelConfig,
  logger: XykeelLogger,
  fallbackProvider: AIProvider
): MultiProviderRouter {
  const registry = createProviderRegistry(logger, `${config.storagePath}/provider-quota.json`);
  const providerInstances = new Map<string, AIProvider>();
  const metrics: AIRouterMetrics = {
    configuredProviders: 0,
    availableProviders: 0,
    cooldownProviders: 0,
    quotaExhaustedProviders: 0,
    currentProvider: null,
    lastSuccessfulProvider: null,
    totalRequests: 0,
    fallbackCount: 0,
    providerFailures: 0,
    averageLatency: 0,
    ravenAvailable: false,
    deterministicFallbackUsed: 0,
  };

  let totalLatencyMs = 0;
  let latencyCount = 0;

  async function initialize(): Promise<void> {
    registerProvidersFromConfig();
    registry.restore();
    if (config.ai.ravenEnabled && config.ai.ravenModel) {
      metrics.ravenAvailable = true;
      logger.ai("Raven AI configured");
    }
    const available = registry.getAvailable();
    metrics.configuredProviders = registry.getAll().length;
    metrics.availableProviders = available.length;
    logger.ai(`AI Router initialized: ${registry.getAll().length} providers configured, ${available.length} available`);
  }

  function registerProvidersFromConfig(): void {
    for (const slot of PROVIDER_ORDER) {
      const providerSlot = config.ai.providers[slot.name];
      if (!providerSlot || !providerSlot.apiKey || !providerSlot.enabled) {
        if (providerSlot?.enabled && !providerSlot.apiKey) {
          registry.markConfigError(slot.name);
        }
        continue;
      }
      const entry = {
        name: slot.name,
        state: "available" as const,
        apiKey: providerSlot.apiKey,
        model: providerSlot.model || getDefaultModel(slot.name),
        baseUrl: providerSlot.baseUrl || getDefaultBaseUrl(slot.name),
        enabled: true,
        priority: slot.priority,
      };
      if (!config.ai.allowPaidProviders && isPaidProvider(slot.name)) {
        entry.enabled = false;
        registry.register({ ...entry, state: "disabled" });
        logger.ai(`Provider ${slot.name} disabled: paid provider not allowed`);
        continue;
      }
      registry.register(entry);
    }
  }

  function getDefaultModel(name: string): string {
    const defaults: Record<string, string> = {
      openai: "gpt-3.5-turbo",
      gemini: "gemini-2.0-flash",
      groq: "llama-3.1-8b-instant",
      deepseek: "deepseek-chat",
      mistral: "mistral-small-latest",
      together: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      openrouter: "meta-llama/llama-3.1-8b-instruct:free",
      fireworks: "accounts/fireworks/models/llama-v3p1-8b-instruct",
      nvidia: "nvidia/llama-3.1-nemotron-70b-instruct",
      cerebras: "llama-3.1-8b",
      sambanova: "Meta-Llama-3.1-8B-Instruct",
      huggingface: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    };
    return defaults[name] || "gpt-3.5-turbo";
  }

  function getDefaultBaseUrl(name: string): string {
    const urls: Record<string, string> = {
      openai: "https://api.openai.com/v1",
      groq: "https://api.groq.com/openai/v1",
      deepseek: "https://api.deepseek.com/v1",
      mistral: "https://api.mistral.ai/v1",
      together: "https://api.together.xyz/v1",
      openrouter: "https://openrouter.ai/api/v1",
      fireworks: "https://api.fireworks.ai/inference/v1",
      nvidia: "https://integrate.api.nvidia.com/v1",
      cerebras: "https://api.cerebras.ai/v1",
      sambanova: "https://api.sambanova.ai/v1",
      huggingface: "https://api-inference.huggingface.co/v1",
      novita: "https://api.novita.ai/v3/openai",
      hyperbolic: "https://api.hyperbolic.xyz/v1",
      deepinfra: "https://api.deepinfra.com/v1/openai",
      nebius: "https://api.studio.nebius.ai/v1",
      lambda: "https://api.lambdalabs.com/v1",
      baseten: "https://inference.baseten.co/v1",
      friendli: "https://inference.friendli.ai/v1",
      chutes: "https://api.chutes.ai/v1",
      featherless: "https://api.featherless.ai/v1",
      azure: "https://your-resource.openai.azure.com/v1",
      xai: "https://api.x.ai/v1",
      moonshot: "https://api.moonshot.cn/v1",
      zai: "https://open.bigmodel.cn/api/paas/v4",
      perplexity: "https://api.perplexity.ai",
    };
    return urls[name] || "";
  }

  function isPaidProvider(name: string): boolean {
    const paid = new Set(["anthropic", "openai", "vertex", "azure"]);
    return paid.has(name);
  }

  function createOpenAICompatibleProvider(name: string, apiKey: string, model: string, baseUrl: string): AIProvider {
    return {
      name,
      async initialize() {},
      async chat(prompt: string, context?: string): Promise<string> {
        const messages: Array<{ role: string; content: string }> = [];
        if (context) {
          messages.push({ role: "system", content: context });
        }
        messages.push({ role: "user", content: prompt });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages,
              max_tokens: 512,
              temperature: 0.7,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
            registry.reportRateLimit(name, retryMs);
            throw new Error(`Rate limited by ${name}`);
          }

          if (response.status === 401 || response.status === 403) {
            registry.reportFailure(name, "auth", `HTTP ${response.status}`);
            throw new Error(`Auth error from ${name}`);
          }

          if (response.status >= 500) {
            registry.reportFailure(name, "network", `HTTP ${response.status}`);
            throw new Error(`Server error from ${name}: ${response.status}`);
          }

          if (!response.ok) {
            registry.reportFailure(name, "network", `HTTP ${response.status}`);
            throw new Error(`HTTP ${response.status} from ${name}`);
          }

          const data = await response.json() as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = data?.choices?.[0]?.message?.content;
          if (!content) {
            registry.reportFailure(name, "malformed", "Empty response");
            throw new Error(`Empty response from ${name}`);
          }

          registry.reportSuccess(name);
          return content;
        } catch (err: unknown) {
          clearTimeout(timeout);
          if (err instanceof Error) {
            if (err.name === "AbortError") {
              registry.reportFailure(name, "timeout", "Request timed out");
              throw new Error(`Timeout from ${name}`);
            }
            if (err.message.includes("Rate limited")) throw err;
            if (err.message.includes("Auth error")) throw err;
            if (err.message.includes("Server error")) throw err;
          }
          registry.reportFailure(name, "network", String(err));
          throw err;
        }
      },
      async isAvailable() {
        return registry.get(name)?.state === "available";
      },
      async shutdown() {},
    };
  }

  function createAnthropicProvider(apiKey: string, model: string): AIProvider {
    return {
      name: "anthropic",
      async initialize() {},
      async chat(prompt: string, context?: string): Promise<string> {
        const systemMsg = context || "You are a helpful assistant.";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model,
              max_tokens: 512,
              system: systemMsg,
              messages: [{ role: "user", content: prompt }],
            }),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
            registry.reportRateLimit("anthropic", retryMs);
            throw new Error("Rate limited by anthropic");
          }

          if (response.status === 401 || response.status === 403) {
            registry.reportFailure("anthropic", "auth", `HTTP ${response.status}`);
            throw new Error("Auth error from anthropic");
          }

          if (!response.ok) {
            registry.reportFailure("anthropic", "network", `HTTP ${response.status}`);
            throw new Error(`HTTP ${response.status} from anthropic`);
          }

          const data = await response.json() as {
            content?: Array<{ type: string; text?: string }>;
          };
          const content = data?.content?.[0]?.text;
          if (!content) {
            registry.reportFailure("anthropic", "malformed", "Empty response");
            throw new Error("Empty response from anthropic");
          }

          registry.reportSuccess("anthropic");
          return content;
        } catch (err: unknown) {
          clearTimeout(timeout);
          if (err instanceof Error && err.name === "AbortError") {
            registry.reportFailure("anthropic", "timeout", "Request timed out");
          }
          throw err;
        }
      },
      async isAvailable() {
        return registry.get("anthropic")?.state === "available";
      },
      async shutdown() {},
    };
  }

  function createCohereProvider(apiKey: string, model: string): AIProvider {
    return {
      name: "cohere",
      async initialize() {},
      async chat(prompt: string, context?: string): Promise<string> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
          const response = await fetch("https://api.cohere.com/v2/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                ...(context ? [{ role: "Chatbot" as const, content: context }] : []),
                { role: "User" as const, content: prompt },
              ],
            }),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (response.status === 429) {
            registry.reportRateLimit("cohere");
            throw new Error("Rate limited by cohere");
          }
          if (!response.ok) {
            registry.reportFailure("cohere", "network", `HTTP ${response.status}`);
            throw new Error(`HTTP ${response.status} from cohere`);
          }

          const data = await response.json() as {
            message?: { content?: Array<{ text?: string }> };
          };
          const content = data?.message?.content?.[0]?.text;
          if (!content) {
            registry.reportFailure("cohere", "malformed", "Empty response");
            throw new Error("Empty response from cohere");
          }

          registry.reportSuccess("cohere");
          return content;
        } catch (err: unknown) {
          clearTimeout(timeout);
          throw err;
        }
      },
      async isAvailable() {
        return registry.get("cohere")?.state === "available";
      },
      async shutdown() {},
    };
  }

  function createAI21Provider(apiKey: string, model: string): AIProvider {
    return {
      name: "ai21",
      async initialize() {},
      async chat(prompt: string, context?: string): Promise<string> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
          const response = await fetch(`https://api.ai21.com/studio/v1/${model}/chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              messages: [
                ...(context ? [{ role: "system", text: context }] : []),
                { role: "user", text: prompt },
              ],
            }),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (response.status === 429) {
            registry.reportRateLimit("ai21");
            throw new Error("Rate limited by ai21");
          }
          if (!response.ok) {
            registry.reportFailure("ai21", "network", `HTTP ${response.status}`);
            throw new Error(`HTTP ${response.status} from ai21`);
          }

          const data = await response.json() as {
            outputs?: Array<{ text?: string }>;
          };
          const content = data?.outputs?.[0]?.text;
          if (!content) {
            registry.reportFailure("ai21", "malformed", "Empty response");
            throw new Error("Empty response from ai21");
          }

          registry.reportSuccess("ai21");
          return content;
        } catch (err: unknown) {
          clearTimeout(timeout);
          throw err;
        }
      },
      async isAvailable() {
        return registry.get("ai21")?.state === "available";
      },
      async shutdown() {},
    };
  }

  function getOrCreateProvider(name: string): AIProvider | null {
    if (providerInstances.has(name)) {
      return providerInstances.get(name)!;
    }
    const entry = registry.get(name);
    if (!entry || entry.state === "config_error" || entry.state === "disabled") {
      return null;
    }

    let provider: AIProvider;
    if (name === "anthropic") {
      provider = createAnthropicProvider(entry.apiKey, entry.model);
    } else if (name === "cohere") {
      provider = createCohereProvider(entry.apiKey, entry.model);
    } else if (name === "ai21") {
      provider = createAI21Provider(entry.apiKey, entry.model);
    } else {
      provider = createOpenAICompatibleProvider(name, entry.apiKey, entry.model, entry.baseUrl);
    }

    providerInstances.set(name, provider);
    return provider;
  }

  async function tryRaven(prompt: string, context?: string): Promise<string | null> {
    if (!config.ai.ravenEnabled || !config.ai.ravenModel) return null;

    const baseUrl = config.ai.ravenBaseUrl;
    const apiKey = config.ai.ravenApiKey || "no-key";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.ai.ravenTimeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.ai.ravenModel,
          messages: [
            ...(context ? [{ role: "system", content: context }] : []),
            { role: "user", content: prompt },
          ],
          max_tokens: 512,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        logger.ai(`Raven failed: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data?.choices?.[0]?.message?.content || null;
    } catch (err: unknown) {
      clearTimeout(timeout);
      logger.ai(`Raven error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async function chat(prompt: string, context?: string): Promise<string> {
    const startTime = Date.now();
    metrics.totalRequests++;

    let attempts = 0;
    const maxAttempts = 35;

    while (attempts < maxAttempts) {
      attempts++;
      const candidate = registry.getNextCandidate();

      if (!candidate) break;

      metrics.currentProvider = candidate.name;
      const provider = getOrCreateProvider(candidate.name);
      if (!provider) {
        registry.reportFailure(candidate.name, "config", "Could not create provider");
        continue;
      }

      try {
        const result = await provider.chat(prompt, context);
        const elapsed = Date.now() - startTime;
        totalLatencyMs += elapsed;
        latencyCount++;
        metrics.averageLatency = Math.round(totalLatencyMs / latencyCount);
        metrics.lastSuccessfulProvider = candidate.name;
        metrics.currentProvider = candidate.name;
        updateMetricsCounts();
        return result;
      } catch {
        metrics.fallbackCount++;
        metrics.providerFailures++;
        continue;
      }
    }

    logger.ai("All 30 providers exhausted, trying Raven...");

    const ravenResult = await tryRaven(prompt, context);
    if (ravenResult) {
      const elapsed = Date.now() - startTime;
      totalLatencyMs += elapsed;
      latencyCount++;
      metrics.averageLatency = Math.round(totalLatencyMs / latencyCount);
      metrics.lastSuccessfulProvider = "raven";
      metrics.currentProvider = "raven";
      updateMetricsCounts();
      return ravenResult;
    }

    logger.ai("Raven unavailable, using deterministic fallback");
    metrics.deterministicFallbackUsed++;
    metrics.currentProvider = "deterministic";
    updateMetricsCounts();
    return fallbackProvider.chat(prompt, context);
  }

  function updateMetricsCounts(): void {
    const all = registry.getAll();
    metrics.availableProviders = all.filter((p) => p.state === "available").length;
    metrics.cooldownProviders = all.filter((p) => p.state === "cooldown").length;
    metrics.quotaExhaustedProviders = all.filter((p) => p.state === "quota_exhausted").length;
  }

  async function isAvailable(): Promise<boolean> {
    return registry.getAvailable().length > 0 || config.ai.ravenEnabled || true;
  }

  async function shutdown(): Promise<void> {
    for (const [, provider] of providerInstances) {
      try { await provider.shutdown(); } catch { /* ignore */ }
    }
    providerInstances.clear();
    registry.persist();
  }

  return {
    name: "multi-provider-router",
    initialize,
    chat,
    isAvailable,
    shutdown,
    getRegistry: () => registry,
    getMetrics: () => ({ ...metrics }),
  };
}
