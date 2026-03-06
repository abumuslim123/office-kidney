import { Ollama } from 'ollama';

export const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
});

export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:32b';

export const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'snowflake-arctic-embed2';

export const OLLAMA_FAST_MODEL = process.env.OLLAMA_FAST_MODEL || 'phi4';
