// Multi-API rotation system for AI providers
// Rotates between Groq, Hugging Face, Together.ai, and Fireworks.ai
// Falls back automatically when one provider hits rate limits

export type Provider = "groq" | "huggingface" | "together" | "fireworks";

export interface AIProvider {
  name: Provider;
  url: string;
  apiKey: string | null;
  model: string;
  headers: Record<string, string>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  response_format?: { type: "json_object" };
  max_tokens?: number;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Provider configurations
const PROVIDERS: Record<Provider, Omit<AIProvider, "apiKey">> = {
  groq: {
    name: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    headers: {},
  },
  huggingface: {
    name: "huggingface",
    url: "https://api-inference.huggingface.co/models/meta-llama/Llama-3.3-70B-Instruct/v1/chat/completions",
    model: "meta-llama/Llama-3.3-70B-Instruct",
    headers: {},
  },
  together: {
    name: "together",
    url: "https://api.together.xyz/v1/chat/completions",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    headers: {},
  },
  fireworks: {
    name: "fireworks",
    url: "https://api.fireworks.ai/inference/v1/chat/completions",
    model: "accounts/fireworks/models/llama-3.3-70b-instruct",
    headers: {},
  },
};

// Vision model for OCR
const VISION_PROVIDERS: Record<Provider, Omit<AIProvider, "apiKey">> = {
  groq: {
    name: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "qwen/qwen3.6-27b",
    headers: {},
  },
  huggingface: {
    name: "huggingface",
    url: "https://api-inference.huggingface.co/models/Qwen/Qwen2-VL-7B-Instruct/v1/chat/completions",
    model: "Qwen/Qwen2-VL-7B-Instruct",
    headers: {},
  },
  together: {
    name: "together",
    url: "https://api.together.xyz/v1/chat/completions",
    model: "Qwen/Qwen2-VL-7B-Instruct",
    headers: {},
  },
  fireworks: {
    name: "fireworks",
    url: "https://api.fireworks.ai/inference/v1/chat/completions",
    model: "accounts/fireworks/models/qwen2-vl-7b-instruct",
    headers: {},
  },
};

function getApiKey(provider: Provider): string | null {
  switch (provider) {
    case "groq":
      return process.env.GROQ_API_KEY ?? null;
    case "huggingface":
      return process.env.HUGGINGFACE_API_KEY ?? null;
    case "together":
      return process.env.TOGETHER_API_KEY ?? null;
    case "fireworks":
      return process.env.FIREWORKS_API_KEY ?? null;
  }
}

function getHeaders(provider: Provider, apiKey: string): Record<string, string> {
  const baseHeaders = {
    "Content-Type": "application/json",
  };

  switch (provider) {
    case "groq":
      return { ...baseHeaders, Authorization: `Bearer ${apiKey}` };
    case "huggingface":
      return { ...baseHeaders, Authorization: `Bearer ${apiKey}` };
    case "together":
      return { ...baseHeaders, Authorization: `Bearer ${apiKey}` };
    case "fireworks":
      return { ...baseHeaders, Authorization: `Bearer ${apiKey}` };
  }
}

// Track failed providers to avoid retrying them immediately
const failedProviders = new Set<Provider>();
const failureTimestamps = new Map<Provider, number>();
const FAILURE_COOLDOWN = 5 * 60 * 1000; // 5 minutes

function isProviderAvailable(provider: Provider): boolean {
  if (!failedProviders.has(provider)) return true;
  
  const timestamp = failureTimestamps.get(provider);
  if (!timestamp) return true;
  
  // Reset if cooldown period has passed
  if (Date.now() - timestamp > FAILURE_COOLDOWN) {
    failedProviders.delete(provider);
    failureTimestamps.delete(provider);
    return true;
  }
  
  return false;
}

function markProviderFailed(provider: Provider) {
  failedProviders.add(provider);
  failureTimestamps.set(provider, Date.now());
}

function getAvailableProviders(): Provider[] {
  const allProviders: Provider[] = ["groq", "huggingface", "together", "fireworks"];
  return allProviders.filter((p) => {
    const hasKey = getApiKey(p) !== null;
    const isAvailable = isProviderAvailable(p);
    return hasKey && isAvailable;
  });
}

export async function callAI(
  request: ChatCompletionRequest,
  vision = false
): Promise<ChatCompletionResponse> {
  const providers = getAvailableProviders();
  
  if (providers.length === 0) {
    throw new Error("No AI providers available. Please configure API keys.");
  }

  const providerConfigs = vision ? VISION_PROVIDERS : PROVIDERS;
  const lastError = new Error("All providers failed");

  for (const providerName of providers) {
    const apiKey = getApiKey(providerName);
    if (!apiKey) continue;

    const config = providerConfigs[providerName];
    const headers = getHeaders(providerName, apiKey);

    try {
      const response = await fetch(config.url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model,
          ...request,
        }),
      });

      if (response.status === 429) {
        // Rate limited - mark as failed and try next provider
        markProviderFailed(providerName);
        lastError.message = `${providerName} rate limited. Trying next provider...`;
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        markProviderFailed(providerName);
        lastError.message = `${providerName} failed: ${errorText}`;
        continue;
      }

      const data = await response.json();
      
      // Reset failure status on success
      failedProviders.delete(providerName);
      failureTimestamps.delete(providerName);
      
      return data;
    } catch (error) {
      markProviderFailed(providerName);
      lastError.message = `${providerName} error: ${error instanceof Error ? error.message : String(error)}`;
      continue;
    }
  }

  throw lastError;
}

// Helper function for text-based AI calls (plan, questions, answers)
export async function callTextAI(
  messages: ChatMessage[],
  temperature = 0.6,
  responseFormat?: { type: "json_object" }
): Promise<string> {
  const response = await callAI({
    messages,
    temperature,
    response_format: responseFormat,
  });
  
  return response.choices[0]?.message?.content ?? "";
}

// Helper function for vision AI calls (OCR)
export async function callVisionAI(
  text: string,
  imageBase64: string
): Promise<string> {
  const response = await callAI({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text },
          { type: "image_url", image_url: { url: imageBase64 } },
        ],
      },
    ],
    temperature: 0,
  }, true);
  
  return response.choices[0]?.message?.content ?? "";
}
