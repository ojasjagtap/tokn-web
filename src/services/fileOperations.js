/**
 * File Operations Service
 * Provides file save/load functionality using File System Access API
 * Replaces Electron's IPC-based file operations for browser environment
 */

/**
 * File handle cache to enable quick saves without re-prompting
 */
let currentFileHandle = null;
let currentFileName = null;

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported() {
    return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
}

/**
 * Save workflow to file (prompts for location if no handle exists)
 * @param {Object} workflowData - Workflow data to save
 * @param {boolean} saveAs - Force "Save As" dialog even if handle exists
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
export async function saveWorkflow(workflowData, saveAs = false) {
    if (!isFileSystemAccessSupported()) {
        return {
            success: false,
            error: 'File System Access API not supported. Please use a Chromium-based browser (Chrome, Edge, Opera).'
        };
    }

    try {
        let fileHandle = currentFileHandle;

        // Show save dialog if no handle or user requested "Save As"
        if (!fileHandle || saveAs) {
            fileHandle = await window.showSaveFilePicker({
                suggestedName: currentFileName || 'workflow.toknflow',
                types: [{
                    description: 'Tokn Flow Files',
                    accept: { 'application/json': ['.toknflow'] }
                }]
            });

            // Cache the file handle for quick saves
            currentFileHandle = fileHandle;
            currentFileName = fileHandle.name;
        }

        // Create a writable stream
        const writable = await fileHandle.createWritable();

        // Write the workflow data as JSON
        const jsonString = JSON.stringify(workflowData, null, 2);
        await writable.write(jsonString);

        // Close the file
        await writable.close();

        return {
            success: true,
            filePath: fileHandle.name
        };
    } catch (error) {
        // User cancelled the dialog
        if (error.name === 'AbortError') {
            return { success: false, error: 'Save cancelled' };
        }

        console.error('Failed to save workflow:', error);
        return {
            success: false,
            error: error.message || 'Failed to save workflow'
        };
    }
}

/**
 * Open workflow from file
 * @returns {Promise<{success: boolean, data?: Object, filePath?: string, error?: string}>}
 */
export async function openWorkflow() {
    if (!isFileSystemAccessSupported()) {
        return {
            success: false,
            error: 'File System Access API not supported. Please use a Chromium-based browser (Chrome, Edge, Opera).'
        };
    }

    try {
        // Show file picker
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{
                description: 'Tokn Flow Files',
                accept: { 'application/json': ['.toknflow'] }
            }],
            multiple: false
        });

        // Cache the file handle for quick saves
        currentFileHandle = fileHandle;
        currentFileName = fileHandle.name;

        // Read the file
        const file = await fileHandle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);

        return {
            success: true,
            data,
            filePath: fileHandle.name
        };
    } catch (error) {
        // User cancelled the dialog
        if (error.name === 'AbortError') {
            return { success: false, error: 'Open cancelled' };
        }

        console.error('Failed to open workflow:', error);
        return {
            success: false,
            error: error.message || 'Failed to open workflow'
        };
    }
}

/**
 * Get current file name (if any file is open)
 */
export function getCurrentFileName() {
    return currentFileName;
}

/**
 * Check if there's a current file handle (for determining "Save" vs "Save As")
 */
export function hasCurrentFile() {
    return currentFileHandle !== null;
}

/**
 * Clear current file handle (for "New" workflow)
 */
export function clearCurrentFile() {
    currentFileHandle = null;
    currentFileName = null;
}

/**
 * Download workflow as file (fallback for unsupported browsers)
 * @param {Object} workflowData - Workflow data to download
 * @param {string} fileName - Suggested file name
 */
export function downloadWorkflow(workflowData, fileName = 'workflow.toknflow') {
    const jsonString = JSON.stringify(workflowData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

/**
 * Upload workflow file (fallback for unsupported browsers)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export function uploadWorkflow() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.toknflow,application/json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) {
                resolve({ success: false, error: 'No file selected' });
                return;
            }

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                resolve({ success: true, data, filePath: file.name });
            } catch (error) {
                resolve({ success: false, error: error.message || 'Failed to read file' });
            }
        };

        input.oncancel = () => {
            resolve({ success: false, error: 'Upload cancelled' });
        };

        input.click();
    });
}

/**
 * Autosave functionality using IndexedDB
 */
const AUTOSAVE_DB_NAME = 'tokn_autosave';
const AUTOSAVE_DB_VERSION = 1;
const AUTOSAVE_STORE_NAME = 'autosaves';
const AUTOSAVE_KEY = 'current_workflow';

/**
 * Open autosave database
 */
function openAutosaveDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(AUTOSAVE_DB_NAME, AUTOSAVE_DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(AUTOSAVE_STORE_NAME)) {
                db.createObjectStore(AUTOSAVE_STORE_NAME);
            }
        };
    });
}

/**
 * Save autosave data
 */
export async function saveAutosave(workflowData) {
    try {
        const db = await openAutosaveDB();

        const autosaveData = {
            data: workflowData,
            timestamp: Date.now()
        };

        const transaction = db.transaction(AUTOSAVE_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(AUTOSAVE_STORE_NAME);
        store.put(autosaveData, AUTOSAVE_KEY);

        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });

        return true;
    } catch (error) {
        console.error('Failed to save autosave:', error);
        return false;
    }
}

/**
 * Load autosave data
 */
export async function loadAutosave() {
    try {
        const db = await openAutosaveDB();

        const transaction = db.transaction(AUTOSAVE_STORE_NAME, 'readonly');
        const store = transaction.objectStore(AUTOSAVE_STORE_NAME);
        const getRequest = store.get(AUTOSAVE_KEY);

        return new Promise((resolve) => {
            getRequest.onsuccess = () => {
                const result = getRequest.result;
                if (result && result.data) {
                    resolve({
                        data: result.data,
                        timestamp: result.timestamp
                    });
                } else {
                    resolve(null);
                }
            };

            getRequest.onerror = () => resolve(null);
        });
    } catch (error) {
        console.error('Failed to load autosave:', error);
        return null;
    }
}

/**
 * Delete autosave data
 */
export async function deleteAutosave() {
    try {
        const db = await openAutosaveDB();

        const transaction = db.transaction(AUTOSAVE_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(AUTOSAVE_STORE_NAME);
        store.delete(AUTOSAVE_KEY);

        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });

        return true;
    } catch (error) {
        console.error('Failed to delete autosave:', error);
        return false;
    }
}

/**
 * Check if autosave exists and get its timestamp
 */
export async function getAutosaveInfo() {
    try {
        const autosave = await loadAutosave();
        if (autosave) {
            return {
                exists: true,
                timestamp: autosave.timestamp
            };
        }
        return { exists: false };
    } catch (error) {
        console.error('Failed to get autosave info:', error);
        return { exists: false };
    }
}

// Export as default object for compatibility
export default {
    isFileSystemAccessSupported,
    saveWorkflow,
    openWorkflow,
    getCurrentFileName,
    hasCurrentFile,
    clearCurrentFile,
    downloadWorkflow,
    uploadWorkflow,
    saveAutosave,
    loadAutosave,
    deleteAutosave,
    getAutosaveInfo
};
