/**
 * Shared utilities for ESG Demo platform
 * Extracted common functionality to reduce code duplication
 */

/**
 * Get session ID from URL or localStorage
 * @returns {string} Session ID
 */
function getSessionId() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('sessionId');
    if (fromQuery) {
        localStorage.setItem('currentSessionId', fromQuery);
        return fromQuery;
    }
    const stored = localStorage.getItem('currentSessionId');
    return stored || 'default-session';
}

/**
 * Map phase number to phase name
 * @param {number} num - Phase number (1-5)
 * @returns {string} Phase name
 */
function mapPhaseEnum(num) {
    const map = {
        1: 'Internal Deliberation',
        2: 'Alliance Consultation',
        3: 'Finalization',
        4: 'Adjudication',
        5: 'Results Brief'
    };
    return map[num] || 'Internal Deliberation';
}

/**
 * Append timeline item to shared timeline storage
 * @param {string} sessionId - Session ID
 * @param {number} move - Move number
 * @param {Object} item - Timeline item data
 */
async function appendTimelineItem(sessionId, move, item) {
    const required = ['phase', 'type', 'title', 'content', 'team'];
    for (const k of required) {
        if (!item[k]) {
            console.warn('appendTimelineItem: Missing required field:', k);
            return;
        }
    }
    // Normalize phase to number if it's a string
    let phaseNum = item.phase;
    if (typeof phaseNum === 'string') {
        // Try to convert phase name to number
        const phaseMap = {
            'Internal Deliberation': 1,
            'Alliance Consultation': 2,
            'Finalization': 3,
            'Adjudication': 4,
            'Results Brief': 5
        };
        phaseNum = phaseMap[phaseNum] || parseInt(phaseNum) || 1;
    }
    
    const event = {
        id: item.id || Date.now() + Math.random(), // Ensure unique ID
        move: move,
        phase: phaseNum, // Always store as number
        time: new Date().toISOString(),
        timestamp: Date.now(), // Add timestamp for better deduplication
        type: item.type,
        title: item.title,
        content: item.content,
        team: item.team,
        refs: item.refs || {}
    };
    const key = `whiteCell_session_${sessionId}_move_${move}`;
    
    // Use a retry mechanism to handle race conditions
    let retries = 3;
    while (retries > 0) {
        try {
            const stored = JSON.parse(localStorage.getItem(key) || '{}');
            const timeline = stored.timelineItems || [];
            
            // Check for duplicate by ID if provided
            if (event.id && timeline.some(t => t.id === event.id)) {
                console.warn('Timeline item with same ID already exists, skipping');
                return;
            }
            
            timeline.push(event);
            stored.timelineItems = timeline;
            localStorage.setItem(key, JSON.stringify(stored));
            localStorage.setItem('_timelineUpdate', JSON.stringify({
                moveNumber: move,
                item: event,
                team: item.team,
                timestamp: Date.now()
            }));
            return; // Success
        } catch (e) {
            retries--;
            if (e.name === 'QuotaExceededError') {
                console.error('Storage quota exceeded while appending timeline item');
                showToast('Storage full. Please export data and clear storage.', 5000);
                return;
            }
            if (retries === 0) {
                console.error('Error appending timeline item after retries:', e);
                showToast('Failed to save timeline item. Please try again.', 3000);
            } else {
                // Wait a bit before retry (exponential backoff) - use setTimeout with Promise
                await new Promise(resolve => setTimeout(resolve, 50 * (4 - retries)));
            }
        }
    }
}

/**
 * Safe JSON parse with fallback
 * @param {string} jsonString - JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} Parsed object or fallback
 */
function safeJSONParse(jsonString, fallback = null) {
    if (!jsonString) return fallback;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error('JSON parse error:', e);
        return fallback;
    }
}

/**
 * Safe localStorage get with validation and recovery
 * @param {string} key - Storage key
 * @param {*} fallback - Fallback value
 * @returns {*} Stored value or fallback
 */
function safeGetItem(key, fallback = null) {
    try {
        const value = localStorage.getItem(key);
        if (!value) return fallback;
        const parsed = safeJSONParse(value, fallback);
        
        // If parsing failed, attempt recovery
        if (parsed === fallback && value) {
            console.warn(`Data corruption detected for key ${key}. Attempting recovery...`);
            
            // Try to recover partial data by removing corrupted parts
            try {
                // Attempt to fix common JSON corruption issues
                let cleaned = value.trim();
                // Remove trailing commas before closing braces/brackets
                cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
                // Try parsing again
                const recovered = JSON.parse(cleaned);
                console.log(`Recovered data for key ${key}`);
                // Save recovered data back
                try {
                    localStorage.setItem(key, JSON.stringify(recovered));
                } catch (saveError) {
                    console.error(`Failed to save recovered data for ${key}:`, saveError);
                }
                return recovered;
            } catch (recoveryError) {
                console.error(`Recovery failed for key ${key}. Using fallback.`, recoveryError);
                // Remove corrupted data to prevent further issues
                try {
                    localStorage.removeItem(key);
                    console.log(`Removed corrupted data for key ${key}`);
                } catch (removeError) {
                    console.error(`Failed to remove corrupted data for ${key}:`, removeError);
                }
            }
        }
        
        return parsed;
    } catch (e) {
        console.error(`Error getting localStorage key ${key}:`, e);
        // Attempt to remove corrupted key
        try {
            localStorage.removeItem(key);
        } catch (removeError) {
            // Ignore removal errors
        }
        return fallback;
    }
}

/**
 * Safe localStorage set with error handling
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} Success status
 */
function safeSetItem(key, value) {
    try {
        const jsonString = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, jsonString);
        return true;
    } catch (e) {
        console.error(`Error setting localStorage key ${key}:`, e);
        if (e.name === 'QuotaExceededError') {
            // Try to free up space by removing old session data
            const currentSessionId = getSessionId();
            let freedSpace = false;
            
            // Remove old session data (keep only current session)
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const storedKey = localStorage.key(i);
                    // Remove old session data that's not current session
                    if (storedKey && storedKey.includes('_session_') && !storedKey.includes(`_session_${currentSessionId}_`)) {
                        keysToRemove.push(storedKey);
                    }
                }
                
                // Remove old data (limit to prevent removing too much)
                const removeCount = Math.min(keysToRemove.length, 10);
                for (let i = 0; i < removeCount; i++) {
                    localStorage.removeItem(keysToRemove[i]);
                    freedSpace = true;
                }
                
                // Try again if we freed space
                if (freedSpace) {
                    try {
                        localStorage.setItem(key, jsonString);
                        if (typeof showToast === 'function') {
                            showToast('Freed storage space by removing old session data', 3000);
                        }
                        return true;
                    } catch (retryError) {
                        // Still failed, continue to user notification
                    }
                }
            } catch (cleanupError) {
                console.error('Error during storage cleanup:', cleanupError);
            }
            
            // Show user-friendly error with export option
            const message = 'Browser storage is full. ' + 
                          (freedSpace ? 'Tried to free space but still insufficient. ' : '') +
                          'Please export your data and clear old sessions.';
            
            // Prompt user to export before data loss
            if (typeof showToast === 'function') {
                showToast(message, 10000);
            } else {
                const userChoice = confirm(message + '\n\nWould you like to export your data now?');
                if (userChoice && typeof exportData === 'function') {
                    // Try to trigger export if available
                    try {
                        exportData();
                    } catch (exportError) {
                        console.error('Error triggering export:', exportError);
                    }
                }
            }
            
            // Also try to trigger export automatically if export function is available
            // This gives user a chance to save before losing data
            if (typeof exportData === 'function') {
                // Use setTimeout to allow UI to update first
                setTimeout(() => {
                    try {
                        // Check if we're in a context where exportData is available
                        const path = window.location.pathname;
                        if (path.includes('facilitator') || path.includes('notetaker') || 
                            path.includes('white_cell') || path.includes('whitecell')) {
                            // exportData should be available in these contexts
                            console.log('Storage full - consider exporting data');
                        }
                    } catch (e) {
                        console.error('Error checking export availability:', e);
                    }
                }, 100);
            }
        }
        return false;
    }
}

/**
 * Validate data structure
 * @param {*} data - Data to validate
 * @param {Object} schema - Expected schema
 * @returns {boolean} Is valid
 */
function validateData(data, schema) {
    if (!data || typeof data !== 'object') return false;
    for (const key in schema) {
        if (schema[key].required && !(key in data)) {
            console.warn(`Validation failed: required field '${key}' missing`);
            return false;
        }
        if (data[key] !== undefined && data[key] !== null && schema[key].type) {
            const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key];
            if (actualType !== schema[key].type) {
                console.warn(`Validation failed: field '${key}' expected type '${schema[key].type}', got '${actualType}'`);
                return false;
            }
        }
    }
    return true;
}

/**
 * Strict data validation with recovery options
 * @param {*} data - Data to validate
 * @param {Object} schema - Expected schema
 * @param {boolean} strict - If true, return null on failure. If false, return sanitized data.
 * @returns {*} Validated data or null
 */
function validateDataStrict(data, schema, strict = false) {
    if (!data || typeof data !== 'object') {
        return strict ? null : {};
    }
    
    const validated = {};
    let hasErrors = false;
    
    for (const key in schema) {
        if (schema[key].required && !(key in data)) {
            if (strict) {
                console.error(`Strict validation failed: required field '${key}' missing`);
                return null;
            }
            hasErrors = true;
            // Set default value if provided
            if (schema[key].default !== undefined) {
                validated[key] = schema[key].default;
            }
        } else if (data[key] !== undefined && data[key] !== null) {
            const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key];
            if (schema[key].type && actualType !== schema[key].type) {
                if (strict) {
                    console.error(`Strict validation failed: field '${key}' type mismatch`);
                    return null;
                }
                hasErrors = true;
                // Try to coerce or use default
                if (schema[key].default !== undefined) {
                    validated[key] = schema[key].default;
                }
            } else {
                validated[key] = data[key];
            }
        } else if (schema[key].default !== undefined) {
            validated[key] = schema[key].default;
        }
    }
    
    if (strict && hasErrors) {
        return null;
    }
    
    return validated;
}

/**
 * Error handling wrapper for async functions
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context description for error messages
 * @returns {Function} Wrapped function
 */
function withErrorHandling(fn, context = 'Operation') {
    return async function(...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            console.error(`${context} error:`, error);
            const errorMsg = error.message || error.toString() || 'Unknown error';
            showToast(`${context} failed: ${errorMsg}`, 4000);
            throw error; // Re-throw for caller to handle if needed
        }
    };
}

/**
 * Error handling wrapper for sync functions
 * @param {Function} fn - Function to wrap
 * @param {string} context - Context description for error messages
 * @param {*} fallback - Fallback value to return on error
 * @returns {Function} Wrapped function
 */
function withErrorHandlingSync(fn, context = 'Operation', fallback = null) {
    return function(...args) {
        try {
            return fn.apply(this, args);
        } catch (error) {
            console.error(`${context} error:`, error);
            const errorMsg = error.message || error.toString() || 'Unknown error';
            showToast(`${context} failed: ${errorMsg}`, 4000);
            return fallback;
        }
    };
}

/**
 * Show toast notification (single instance with queue system)
 * @param {string} message - Message to display
 * @param {number} duration - Duration in ms
 */
let toastQueue = [];
let toastTimeout = null;
let isToastShowing = false;

function showToast(message, duration = 2500) {
    // Add to queue
    toastQueue.push({ message, duration });
    
    // If not currently showing, show next in queue
    if (!isToastShowing) {
        showNextToast();
    }
}

function showNextToast() {
    if (toastQueue.length === 0) {
        isToastShowing = false;
        return;
    }
    
    isToastShowing = true;
    const { message, duration } = toastQueue.shift();
    
    let toast = document.getElementById('globalToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'globalToast';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.background = 'rgba(26,68,128,0.95)';
        toast.style.color = '#fff';
        toast.style.padding = '10px 14px';
        toast.style.borderRadius = '6px';
        toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)';
        toast.style.zIndex = '2000';
        toast.style.transition = 'opacity 0.3s';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.opacity = '1';
    
    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    // Hide after duration and show next in queue
    toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
        // Wait for fade out, then show next
        setTimeout(() => {
            isToastShowing = false;
            showNextToast();
        }, 300); // Match transition duration
    }, duration);
}

/**
 * Create backup of all session data
 * @param {string} sessionId - Session ID
 * @returns {Object} Backup data
 */
function createBackup(sessionId) {
    const backup = {
        version: '1.0',
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        data: {}
    };
    
    // Collect all session-related keys
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes(sessionId) || key.includes('currentSessionId')) {
            try {
                backup.data[key] = localStorage.getItem(key);
            } catch (e) {
                console.error(`Error backing up key ${key}:`, e);
            }
        }
    }
    
    return backup;
}

/**
 * Restore from backup
 * @param {Object} backup - Backup data
 * @returns {boolean} Success status
 */
function restoreBackup(backup) {
    if (!backup || !backup.data) {
        return false;
    }
    
    try {
        for (const key in backup.data) {
            localStorage.setItem(key, backup.data[key]);
        }
        return true;
    } catch (e) {
        console.error('Error restoring backup:', e);
        return false;
    }
}

/**
 * Migrate old data format to new format (one-time migration)
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if migration occurred, false if already migrated
 */
function migrateData(sessionId) {
    const migrationKey = `data_migrated_session_${sessionId}`;
    if (localStorage.getItem(migrationKey)) {
        return false; // Already migrated
    }
    
    // Create backup before migration
    let backupCreated = false;
    try {
        const backup = createBackup(sessionId);
        if (backup && Object.keys(backup.data).length > 0) {
            // Store backup in localStorage with timestamp
            const backupKey = `migration_backup_${sessionId}_${Date.now()}`;
            try {
                localStorage.setItem(backupKey, JSON.stringify(backup));
                backupCreated = true;
                console.log('Migration backup created:', backupKey);
                
                // Notify user if showToast is available
                if (typeof showToast === 'function') {
                    showToast('Data migration backup created', 3000);
                }
            } catch (e) {
                console.error('Failed to store migration backup:', e);
                // Try to export backup as download
                try {
                    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `migration_backup_${sessionId}_${new Date().toISOString().split('T')[0]}.json`;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    backupCreated = true;
                    console.log('Migration backup exported as download');
                } catch (exportError) {
                    console.error('Failed to export migration backup:', exportError);
                }
            }
        }
    } catch (backupError) {
        console.error('Error creating migration backup:', backupError);
        // Continue with migration but warn user
        if (typeof showToast === 'function') {
            showToast('Warning: Could not create migration backup', 5000);
        }
    }
    
    let migrated = false;
    
    // Migrate move-only keys to session-aware keys
    for (let move = 1; move <= 3; move++) {
        // Migrate requests
        const oldRequestKey = `blueRequests_move_${move}`;
        const newRequestKey = `blueRequests_session_${sessionId}_move_${move}`;
        if (localStorage.getItem(oldRequestKey) && !localStorage.getItem(newRequestKey)) {
            const oldData = safeGetItem(oldRequestKey, []);
            if (safeSetItem(newRequestKey, oldData)) {
                migrated = true;
            }
        }
        
        // Migrate actions
        const oldActionKey = `blueActions_move_${move}`;
        const newActionKey = `blueActions_session_${sessionId}_move_${move}`;
        if (localStorage.getItem(oldActionKey) && !localStorage.getItem(newActionKey)) {
            const oldData = safeGetItem(oldActionKey, {});
            if (safeSetItem(newActionKey, oldData)) {
                migrated = true;
            }
        }
        
        // Migrate adjudications
        const oldAdjKey = `adjudications_move_${move}`;
        const newAdjKey = `adjudications_session_${sessionId}_move_${move}`;
        if (localStorage.getItem(oldAdjKey) && !localStorage.getItem(newAdjKey)) {
            const oldData = safeGetItem(oldAdjKey, []);
            if (safeSetItem(newAdjKey, oldData)) {
                migrated = true;
            }
        }
        
        // Migrate whiteCell data
        const oldWhiteCellKey = `whiteCell_move_${move}`;
        const newWhiteCellKey = `whiteCell_session_${sessionId}_move_${move}`;
        if (localStorage.getItem(oldWhiteCellKey) && !localStorage.getItem(newWhiteCellKey)) {
            const oldData = safeGetItem(oldWhiteCellKey, {});
            if (safeSetItem(newWhiteCellKey, oldData)) {
                migrated = true;
            }
        }
        
        // Migrate communications
        const oldCommKey = `communications_move_${move}`;
        const newCommKey = `communications_session_${sessionId}_move_${move}`;
        if (localStorage.getItem(oldCommKey) && !localStorage.getItem(newCommKey)) {
            const oldData = safeGetItem(oldCommKey, []);
            if (safeSetItem(newCommKey, oldData)) {
                migrated = true;
            }
        }
        
        // Migrate notes (notetaker data)
        const oldNotesKey = `blueFacilitatorMove${move}`;
        const newNotesKey = `notes_session_${sessionId}_move_${move}`;
        if (localStorage.getItem(oldNotesKey) && !localStorage.getItem(newNotesKey)) {
            const oldData = safeGetItem(oldNotesKey, {});
            if (safeSetItem(newNotesKey, oldData)) {
                migrated = true;
            }
        }
        
        // Migrate legacy submitted keys
        const oldSubmittedKey = `blueActionsSubmittedMove${move}`;
        const newSubmittedKey = `blueActions_session_${sessionId}_move_${move}`;
        if (localStorage.getItem(oldSubmittedKey) && !localStorage.getItem(newSubmittedKey)) {
            const oldData = safeGetItem(oldSubmittedKey, {});
            if (safeSetItem(newSubmittedKey, oldData)) {
                migrated = true;
            }
        }
        
        const oldRequestsSubmittedKey = `blueRequestsSubmittedMove${move}`;
        if (localStorage.getItem(oldRequestsSubmittedKey) && !localStorage.getItem(newRequestKey)) {
            const oldData = safeGetItem(oldRequestsSubmittedKey, []);
            if (safeSetItem(newRequestKey, oldData)) {
                migrated = true;
            }
        }
    }
    
    // Mark migration as complete only if successful
    if (migrated) {
        try {
            const migrationResult = safeSetItem(migrationKey, { 
                migratedAt: new Date().toISOString(), 
                sessionId,
                backupCreated: backupCreated
            });
            
            if (migrationResult) {
                console.log('Data migration completed for session:', sessionId);
                if (typeof showToast === 'function') {
                    showToast('Data migration completed successfully', 3000);
                }
            } else {
                console.error('Failed to mark migration as complete');
                if (typeof showToast === 'function') {
                    showToast('Migration completed but failed to save status. Backup available if needed.', 5000);
                }
            }
        } catch (e) {
            console.error('Error marking migration complete:', e);
            // Don't throw - migration data is already saved, just status update failed
        }
    } else if (backupCreated) {
        // Even if no migration occurred, if backup was created, notify user
        console.log('Migration backup created (no migration needed)');
    }
    
    return migrated;
}

/**
 * Remove legacy keys after migration (optional cleanup)
 * @param {string} sessionId - Session ID
 */
function cleanupLegacyKeys(sessionId) {
    const legacyPatterns = [
        /^blueRequests_move_\d+$/,
        /^blueActions_move_\d+$/,
        /^communications_move_\d+$/,
        /^whiteCell_move_\d+$/,
        /^blueFacilitatorMove\d+$/,
        /^blueActionsSubmittedMove\d+$/,
        /^blueRequestsSubmittedMove\d+$/
    ];
    
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (legacyPatterns.some(pattern => pattern.test(key))) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => {
        try {
            localStorage.removeItem(key);
            console.log('Removed legacy key:', key);
        } catch (e) {
            console.error('Error removing legacy key:', key, e);
        }
    });
    
    return keysToRemove.length;
}

/**
 * Deduplicate timeline items by ID and timestamp
 * @param {Array} items - Timeline items to deduplicate
 * @returns {Array} Deduplicated items
 */
function deduplicateTimelineItems(items) {
    if (!Array.isArray(items)) return [];
    
    const seen = new Map();
    const deduplicated = [];
    
    for (const item of items) {
        // Create unique key from ID (preferred), timestamp, team, and full content hash
        // Use ID if available (most reliable)
        let key;
        if (item.id) {
            // If ID exists, use it as primary key (most reliable)
            key = `id:${item.id}`;
        } else {
            // Fallback: use timestamp + team + content hash for items without ID
            const timestamp = item.timestamp || (item.time ? new Date(item.time).getTime() : 0);
            const team = item.team || 'unknown';
            // Use full content for hash to avoid false positives
            const contentHash = item.content ? 
                (item.content.length > 100 ? item.content.substring(0, 100) : item.content) : '';
            key = `ts:${timestamp}_team:${team}_hash:${contentHash}`;
        }
        
        if (!seen.has(key)) {
            seen.set(key, true);
            deduplicated.push(item);
        } else {
            // If duplicate found by key, keep the one with more complete data
            const existingIndex = deduplicated.findIndex(i => {
                if (item.id && i.id) {
                    return i.id === item.id;
                }
                // For non-ID items, compare by the same key generation logic
                const iTimestamp = i.timestamp || (i.time ? new Date(i.time).getTime() : 0);
                const iTeam = i.team || 'unknown';
                const iContentHash = i.content ? 
                    (i.content.length > 100 ? i.content.substring(0, 100) : i.content) : '';
                const iKey = i.id ? `id:${i.id}` : `ts:${iTimestamp}_team:${iTeam}_hash:${iContentHash}`;
                return iKey === key;
            });
            
            if (existingIndex !== -1) {
                const existing = deduplicated[existingIndex];
                // Keep the item with more complete data (longer content, more fields)
                const itemCompleteness = (item.content?.length || 0) + Object.keys(item).length;
                const existingCompleteness = (existing.content?.length || 0) + Object.keys(existing).length;
                
                if (itemCompleteness > existingCompleteness) {
                    deduplicated[existingIndex] = item;
                }
            }
        }
    }
    
    // Sort by timestamp (newest first)
    return deduplicated.sort((a, b) => {
        const timeA = a.timestamp || (a.time ? new Date(a.time).getTime() : 0);
        const timeB = b.timestamp || (b.time ? new Date(b.time).getTime() : 0);
        return timeB - timeA;
    });
}

/**
 * Search/filter items
 * @param {Array} items - Items to search
 * @param {string} query - Search query
 * @param {Array} fields - Fields to search in
 * @returns {Array} Filtered items
 */
function searchItems(items, query, fields = []) {
    if (!query || !query.trim()) return items;
    const lowerQuery = query.toLowerCase();
    return items.filter(item => {
        if (fields.length === 0) {
            // Search all string fields
            return Object.values(item).some(val => {
                if (typeof val === 'string') {
                    return val.toLowerCase().includes(lowerQuery);
                }
                if (Array.isArray(val)) {
                    return val.some(v => String(v).toLowerCase().includes(lowerQuery));
                }
                return false;
            });
        }
        return fields.some(field => {
            const val = item[field];
            if (typeof val === 'string') {
                return val.toLowerCase().includes(lowerQuery);
            }
            if (Array.isArray(val)) {
                return val.some(v => String(v).toLowerCase().includes(lowerQuery));
            }
            return String(val).toLowerCase().includes(lowerQuery);
        });
    });
}

