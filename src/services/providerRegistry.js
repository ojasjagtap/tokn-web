/**
 * Provider Registry for Web App
 * Simplified version that uses webStorage for API key management
 */

import webStorage from './webStorage.js';
import { OpenAIAdapter, ClaudeAdapter, GeminiAdapter } from '../../renderer/model-adapters.js';

class ProviderRegistry {
    constructor() {
        this.providers = new Map();
        this.modelCache = new Map(); // providerId -> models[]
        this.adapters = new Map(); // providerId -> adapter instance

        // Register built-in providers (no Ollama in web version)
        this.registerProvider({
            id: 'openai',
            name: 'OpenAI',
            requiresApiKey: true
        });

        this.registerProvider({
            id: 'claude',
            name: 'Anthropic',
            requiresApiKey: true
        });

        this.registerProvider({
            id: 'gemini',
            name: 'Google',
            requiresApiKey: true
        });
    }

    /**
     * Register a provider
     */
    registerProvider(config) {
        this.providers.set(config.id, config);
    }

    /**
     * Get all registered providers
     */
    getProviders() {
        return Array.from(this.providers.values());
    }

    /**
     * Get provider config
     */
    getProvider(providerId) {
        return this.providers.get(providerId);
    }

    /**
     * Check if a provider is configured (has API key if required)
     */
    async isProviderConfigured(providerId) {
        const provider = this.providers.get(providerId);
        if (!provider) return false;

        if (!provider.requiresApiKey) return true;

        // Check if API key exists in storage
        const apiKey = await this.getApiKey(providerId);
        return !!apiKey;
    }

    /**
     * Set API key for a provider
     */
    async setApiKey(providerId, apiKey) {
        try {
            await webStorage.setApiKey(providerId, apiKey);
            // Clear model cache when API key changes
            this.modelCache.delete(providerId);
        } catch (error) {
            console.error('Failed to set API key:', error);
            throw error;
        }
    }

    /**
     * Get API key for a provider
     */
    async getApiKey(providerId) {
        try {
            return await webStorage.getApiKey(providerId);
        } catch (error) {
            console.error('Failed to get API key:', error);
            return null;
        }
    }

    /**
     * Remove API key for a provider
     */
    async removeApiKey(providerId) {
        try {
            await webStorage.removeApiKey(providerId);
            this.modelCache.delete(providerId);
        } catch (error) {
            console.error('Failed to remove API key:', error);
            throw error;
        }
    }

    /**
     * List available models for a provider
     */
    async listModels(providerId) {
        // Check cache first
        if (this.modelCache.has(providerId)) {
            return this.modelCache.get(providerId);
        }

        const apiKey = await this.getApiKey(providerId);
        if (!apiKey) {
            throw new Error(`No API key configured for ${providerId}`);
        }

        let models = [];

        try {
            if (providerId === 'openai') {
                const response = await fetch('https://api.openai.com/v1/models', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`OpenAI list models failed: ${response.status}`);
                }

                const data = await response.json();

                // Filter to only chat models and sort by most useful first
                const chatModels = data.data
                    .filter(m => m.id.includes('gpt'))
                    .sort((a, b) => {
                        // Prioritize newer models
                        const priority = ['gpt-4', 'gpt-3.5-turbo', 'gpt-4o'];
                        const aIdx = priority.findIndex(p => a.id.includes(p));
                        const bIdx = priority.findIndex(p => b.id.includes(p));
                        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                        if (aIdx !== -1) return -1;
                        if (bIdx !== -1) return 1;
                        return a.id.localeCompare(b.id);
                    });

                models = chatModels.map(m => ({ id: m.id, name: m.id }));
            } else if (providerId === 'claude') {
                const response = await fetch('https://api.anthropic.com/v1/models', {
                    method: 'GET',
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Claude list models failed: ${response.status}`);
                }

                const data = await response.json();
                models = Array.isArray(data?.data)
                    ? data.data.map(m => ({
                        id: m.id,
                        name: m.display_name || m.id
                    }))
                    : [];
            } else if (providerId === 'gemini') {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
                    method: 'GET'
                });

                if (!response.ok) {
                    throw new Error(`Gemini list models failed: ${response.status}`);
                }

                const data = await response.json();

                // Filter to only models that support generateContent
                const generativeModels = Array.isArray(data?.models)
                    ? data.models.filter(m =>
                        m.supportedGenerationMethods?.includes('generateContent')
                    )
                    : [];

                models = generativeModels.map(m => ({
                    id: m.name.replace('models/', ''), // Remove 'models/' prefix
                    name: m.displayName || m.name.replace('models/', '')
                }));
            } else {
                throw new Error(`Unknown provider: ${providerId}`);
            }

            // Cache the results
            this.modelCache.set(providerId, models);
            return models;
        } catch (error) {
            console.error(`Failed to list models for ${providerId}:`, error);
            throw error;
        }
    }

    /**
     * Get adapter for a provider
     */
    async getAdapter(providerId) {
        // Check cache
        if (this.adapters.has(providerId)) {
            return this.adapters.get(providerId);
        }

        // Get API key
        const apiKey = await this.getApiKey(providerId);
        if (!apiKey) {
            throw new Error(`No API key configured for ${providerId}`);
        }

        // Create adapter
        let adapter;
        switch (providerId) {
            case 'openai':
                adapter = new OpenAIAdapter({ apiKey });
                break;
            case 'claude':
                adapter = new ClaudeAdapter({ apiKey });
                break;
            case 'gemini':
                adapter = new GeminiAdapter({ apiKey });
                break;
            default:
                throw new Error(`Unknown provider: ${providerId}`);
        }

        this.adapters.set(providerId, adapter);
        return adapter;
    }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();
export default { providerRegistry };
