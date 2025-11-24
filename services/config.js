/**
 * Configuration Service
 * 
 * Handles application configuration, environment variables, and settings.
 * This module centralizes all configuration management for the app.
 */

const config = {
    // App settings
    appName: 'tokn',
    version: '1.0.0',
    
    // Window settings
    window: {
        width: 800,
        height: 600,
        minWidth: 400,
        minHeight: 300
    },
    
    // API settings (for future use)
    api: {
        baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
        timeout: 5000
    }
};

module.exports = config;

