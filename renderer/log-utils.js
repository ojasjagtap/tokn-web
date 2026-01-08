/**
 * Logging Utilities
 * Shared logging functions used across renderer modules
 */

/**
 * Format timestamp for logs
 * @returns {string} - Formatted timestamp HH:MM:SS
 */
function formatTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Create a tagged message with proper formatting
 * Ensures exactly one tag in the format: [tag] message
 * @param {string} tag - The tag to apply (e.g., "DSPy", "GEPA", "Flow")
 * @param {string} message - The raw log message (may or may not have an existing tag)
 * @returns {string} - The message with exactly one tag: [tag] message
 */
export function createTaggedMessage(tag, message) {
    // Remove any existing tag pattern from the start of the message
    // Pattern matches: optional whitespace + [anything] + optional whitespace
    const cleanMessage = message.replace(/^\s*\[([^\]]+)\]\s*/, '');

    // Return message with the specified tag
    return `[${tag}] ${cleanMessage}`;
}

export { formatTimestamp };
