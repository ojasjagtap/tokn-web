/**
 * Web Storage Service
 * Provides secure API key storage using IndexedDB + Web Crypto API
 * Replaces Electron's secure storage for browser environment
 */

const DB_NAME = 'tokn_secure_storage';
const DB_VERSION = 1;
const STORE_NAME = 'encrypted_keys';
const CRYPTO_KEY_NAME = 'master_encryption_key';

/**
 * Crypto key cache to avoid repeated derivations
 */
let cachedCryptoKey = null;

/**
 * In-memory cache for decrypted API keys (performance optimization)
 */
const memoryCache = new Map();

/**
 * Open IndexedDB connection
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

/**
 * Get or create master encryption key
 * Stored in IndexedDB, generated once per browser/device
 */
async function getMasterCryptoKey() {
    if (cachedCryptoKey) {
        return cachedCryptoKey;
    }

    const db = await openDatabase();

    // Try to retrieve existing key
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(CRYPTO_KEY_NAME);

    return new Promise((resolve, reject) => {
        getRequest.onsuccess = async () => {
            let keyData = getRequest.result;

            if (!keyData) {
                // Generate new key if none exists
                const newKey = await crypto.subtle.generateKey(
                    { name: 'AES-GCM', length: 256 },
                    true, // extractable
                    ['encrypt', 'decrypt']
                );

                // Export and store the key
                const exportedKey = await crypto.subtle.exportKey('jwk', newKey);

                const writeTransaction = db.transaction(STORE_NAME, 'readwrite');
                const writeStore = writeTransaction.objectStore(STORE_NAME);
                writeStore.put(exportedKey, CRYPTO_KEY_NAME);

                await new Promise((res, rej) => {
                    writeTransaction.oncomplete = res;
                    writeTransaction.onerror = () => rej(writeTransaction.error);
                });

                keyData = exportedKey;
            }

            // Import key from JWK
            const cryptoKey = await crypto.subtle.importKey(
                'jwk',
                keyData,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );

            cachedCryptoKey = cryptoKey;
            resolve(cryptoKey);
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
}

/**
 * Encrypt data using Web Crypto API
 */
async function encryptData(plaintext) {
    const key = await getMasterCryptoKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Generate random IV (initialization vector)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    // Return as base64
    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using Web Crypto API
 */
async function decryptData(encryptedBase64) {
    const key = await getMasterCryptoKey();

    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
}

/**
 * Set API key for a provider (encrypted)
 */
export async function setApiKey(providerId, apiKey) {
    if (!apiKey) {
        return await removeApiKey(providerId);
    }

    try {
        const encrypted = await encryptData(apiKey);
        const db = await openDatabase();

        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(encrypted, `api_key_${providerId}`);

        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });

        // Update memory cache
        memoryCache.set(providerId, apiKey);

        return true;
    } catch (error) {
        console.error('Failed to set API key:', error);
        throw error;
    }
}

/**
 * Get API key for a provider (decrypted)
 */
export async function getApiKey(providerId) {
    // Check memory cache first
    if (memoryCache.has(providerId)) {
        return memoryCache.get(providerId);
    }

    try {
        const db = await openDatabase();

        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(`api_key_${providerId}`);

        return new Promise((resolve, reject) => {
            getRequest.onsuccess = async () => {
                const encrypted = getRequest.result;

                if (!encrypted) {
                    resolve(null);
                    return;
                }

                try {
                    const decrypted = await decryptData(encrypted);
                    // Cache for future use
                    memoryCache.set(providerId, decrypted);
                    resolve(decrypted);
                } catch (error) {
                    console.error('Failed to decrypt API key:', error);
                    resolve(null);
                }
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    } catch (error) {
        console.error('Failed to get API key:', error);
        return null;
    }
}

/**
 * Remove API key for a provider
 */
export async function removeApiKey(providerId) {
    try {
        const db = await openDatabase();

        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(`api_key_${providerId}`);

        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });

        // Remove from memory cache
        memoryCache.delete(providerId);

        return true;
    } catch (error) {
        console.error('Failed to remove API key:', error);
        throw error;
    }
}

/**
 * Check if API key exists for a provider
 */
export async function hasApiKey(providerId) {
    // Check memory cache first
    if (memoryCache.has(providerId)) {
        return true;
    }

    try {
        const db = await openDatabase();

        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(`api_key_${providerId}`);

        return new Promise((resolve) => {
            getRequest.onsuccess = () => {
                resolve(!!getRequest.result);
            };
            getRequest.onerror = () => resolve(false);
        });
    } catch (error) {
        console.error('Failed to check API key:', error);
        return false;
    }
}

/**
 * Clear all stored keys (for testing/debugging)
 */
export async function clearAllKeys() {
    try {
        const db = await openDatabase();

        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();

        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });

        memoryCache.clear();
        return true;
    } catch (error) {
        console.error('Failed to clear keys:', error);
        throw error;
    }
}

// Export as default object for compatibility
export default {
    setApiKey,
    getApiKey,
    removeApiKey,
    hasApiKey,
    clearAllKeys
};
