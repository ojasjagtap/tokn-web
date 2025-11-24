/**
 * Provider Registry
 * Central registry for managing model providers (OpenAI, Claude, Gemini)
 */

// Import webStorage for API key management (will be bundled by Vite)
let webStorage = null;
if (typeof window !== 'undefined') {
    // Dynamic import for browser environment
    import('../src/services/webStorage.js').then(module => {
        webStorage = module.default;
    }).catch(err => {
        console.error('Failed to load webStorage:', err);
    });
}

class ProviderRegistry {
    constructor() {
        this.providers = new Map();
        this.modelCache = new Map(); // providerId -> models[]
        this.adapters = new Map(); // providerId -> adapter instance

        // Register built-in providers
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
     * Check if a provider is configured (has API key if required) - async
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
     * Set API key for a provider (async - uses secure web storage)
     */
    async setApiKey(providerId, apiKey) {
        try {
            // Use webStorage (IndexedDB + Web Crypto)
            if (webStorage) {
                await webStorage.setApiKey(providerId, apiKey);
            } else {
                throw new Error('Web storage not initialized');
            }

            // Clear model cache when API key changes
            this.modelCache.delete(providerId);
        } catch (error) {
            console.error('Failed to set API key:', error);
            throw error;
        }
    }

    /**
     * Get API key for a provider (async - uses secure web storage)
     */
    async getApiKey(providerId) {
        try {
            // Use webStorage (IndexedDB + Web Crypto)
            if (webStorage) {
                return await webStorage.getApiKey(providerId);
            }
            return null;
        } catch (error) {
            console.error('Failed to get API key:', error);
            return null;
        }
    }

    /**
     * Remove API key for a provider (async - uses secure storage)
     */
    async removeApiKey(providerId) {
        await this.setApiKey(providerId, null);
        this.modelCache.delete(providerId);
    }

    /**
     * List models for a provider
     */
    async listModels(providerId) {
        // Check cache first
        if (this.modelCache.has(providerId)) {
            return this.modelCache.get(providerId);
        }

        let models = [];

        if (providerId === 'openai') {
            const apiKey = await this.getApiKey('openai');
            if (!apiKey) {
                throw new Error('OpenAI API key not configured');
            }

            try {
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
            } catch (error) {
                console.error('provider_list_models_error: openai', error);
                throw error;
            }
        } else if (providerId === 'claude') {
            const apiKey = await this.getApiKey('claude');
            if (!apiKey) {
                throw new Error('Claude API key not configured');
            }

            try {
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
            } catch (error) {
                console.error('provider_list_models_error: claude', error);
                throw error;
            }
        } else if (providerId === 'gemini') {
            const apiKey = await this.getApiKey('gemini');
            if (!apiKey) {
                throw new Error('Gemini API key not configured');
            }

            try {
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
            } catch (error) {
                console.error('provider_list_models_error: gemini', error);
                throw error;
            }
        }

        // Cache the results
        this.modelCache.set(providerId, models);

        return models;
    }

    /**
     * Get adapter instance for a provider (async - retrieves API key securely)
     */
    async getAdapter(providerId) {
        // Return cached adapter if available
        if (this.adapters.has(providerId)) {
            return this.adapters.get(providerId);
        }

        let adapter = null;

        if (providerId === 'openai') {
            const { OpenAIAdapter } = require('../renderer/model-adapters');
            const apiKey = await this.getApiKey('openai');
            adapter = new OpenAIAdapter({
                apiKey: apiKey
            });
        } else if (providerId === 'claude') {
            const { ClaudeAdapter } = require('../renderer/model-adapters');
            const apiKey = await this.getApiKey('claude');
            adapter = new ClaudeAdapter({
                apiKey: apiKey
            });
        } else if (providerId === 'gemini') {
            const { GeminiAdapter } = require('../renderer/model-adapters');
            const apiKey = await this.getApiKey('gemini');
            adapter = new GeminiAdapter({
                apiKey: apiKey
            });
        }

        if (adapter) {
            this.adapters.set(providerId, adapter);
        }

        return adapter;
    }

    /**
     * Clear all caches (useful for testing or refresh)
     */
    clearCaches() {
        this.modelCache.clear();
        this.adapters.clear();
    }
}

// Singleton instance
const providerRegistry = new ProviderRegistry();

module.exports = {
    ProviderRegistry,
    providerRegistry
};
