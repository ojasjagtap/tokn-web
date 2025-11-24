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

        try {
            const adapter = await this.getAdapter(providerId);
            const models = await adapter.listModels();
            this.modelCache.set(providerId, models);
            return models;
        } catch (error) {
            console.error(`Failed to list models for ${providerId}:`, error);
            // Return default models on error
            return this.getDefaultModels(providerId);
        }
    }

    /**
     * Get default models for a provider (fallback)
     */
    getDefaultModels(providerId) {
        const defaults = {
            'openai': [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
            ],
            'claude': [
                { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
                { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
                { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
            ],
            'gemini': [
                { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
                { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
                { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
            ]
        };

        return defaults[providerId] || [];
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
                adapter = new OpenAIAdapter(apiKey);
                break;
            case 'claude':
                adapter = new ClaudeAdapter(apiKey);
                break;
            case 'gemini':
                adapter = new GeminiAdapter(apiKey);
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
