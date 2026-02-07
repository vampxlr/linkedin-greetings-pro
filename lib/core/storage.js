/**
 * storage.js - Persistent storage for processed profiles
 * Uses composite keys (name + year/context) for anniversary year tracking
 */

const fs = require('fs');
const path = require('path');
const logger = require('../core/logger');

const DATA_DIR = path.join(__dirname, '../../data');
const STORAGE_FILE = path.join(DATA_DIR, 'processed_profiles.json');

class Storage {
    constructor() {
        this._ensureDataDir();
        this._data = this._load();
    }

    _ensureDataDir() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            logger.debug(`Created data directory: ${DATA_DIR}`);
        }
    }

    _load() {
        try {
            if (fs.existsSync(STORAGE_FILE)) {
                const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
                return JSON.parse(raw);
            }
        } catch (err) {
            logger.warn('Failed to load storage file, starting fresh:', err.message);
        }
        // New structure: object with composite keys
        return {
            processedEntries: {},  // { "Name|context": { liked: true, commented: true, timestamp: "..." } }
            legacyCommented: [],   // Keep old format for backwards compat
            legacyLiked: []
        };
    }

    _save() {
        try {
            fs.writeFileSync(STORAGE_FILE, JSON.stringify(this._data, null, 2));
            logger.debug('Storage file saved.');
        } catch (err) {
            logger.error('Failed to save storage file:', err);
        }
    }

    /**
     * Generate a composite key from name and context (year info or birthday)
     * @param {string} name - Profile name
     * @param {string} contextText - Card text containing year info like "11 years"
     * @returns {string} - Composite key like "John Doe|11 years" or "John Doe|birthday"
     */
    _generateKey(name, contextText) {
        // Extract year info: "Completed 11 years at..." → "11 years"
        const yearMatch = contextText.match(/(\d+)\s*(year|years)/i);
        if (yearMatch) {
            return `${name}|${yearMatch[1]} years`;
        }

        // For birthdays, just use "birthday" as context
        if (contextText.toLowerCase().includes('birthday')) {
            // For birthdays we could use date, but for now just use current date
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            return `${name}|birthday|${today}`;
        }

        // Fallback
        return `${name}|generic`;
    }

    /**
     * Check if this specific entry (name + context) is fully processed
     * @param {string} name - Profile name
     * @param {string} contextText - Card text with year/event info
     * @returns {boolean}
     */
    isFullyProcessed(name, contextText) {
        const key = this._generateKey(name, contextText);
        const entry = this._data.processedEntries[key];

        if (entry && entry.liked && entry.commented) {
            logger.debug(`Storage: "${key}" fully processed.`);
            return true;
        }
        return false;
    }

    /**
     * Check if we've already commented on this specific entry
     */
    isCommentProcessed(name, contextText) {
        const key = this._generateKey(name, contextText);
        const entry = this._data.processedEntries[key];
        return entry && entry.commented === true;
    }

    /**
     * Check if we've already liked this specific entry
     */
    isLikeProcessed(name, contextText) {
        const key = this._generateKey(name, contextText);
        const entry = this._data.processedEntries[key];
        return entry && entry.liked === true;
    }

    /**
     * Mark this entry as commented
     */
    markCommentProcessed(name, contextText) {
        const key = this._generateKey(name, contextText);
        if (!this._data.processedEntries[key]) {
            this._data.processedEntries[key] = {};
        }
        this._data.processedEntries[key].commented = true;
        this._data.processedEntries[key].commentedAt = new Date().toISOString();
        this._save();
        logger.info(`Marked "${key}" as commented in storage.`);
    }

    /**
     * Mark this entry as liked
     */
    markLikeProcessed(name, contextText) {
        const key = this._generateKey(name, contextText);
        if (!this._data.processedEntries[key]) {
            this._data.processedEntries[key] = {};
        }
        this._data.processedEntries[key].liked = true;
        this._data.processedEntries[key].likedAt = new Date().toISOString();
        this._save();
        logger.debug(`Marked "${key}" as liked in storage.`);
    }

    /**
     * Get stats for logging
     */
    getStats() {
        const entries = Object.keys(this._data.processedEntries);
        let commented = 0, liked = 0;
        for (const key of entries) {
            if (this._data.processedEntries[key].commented) commented++;
            if (this._data.processedEntries[key].liked) liked++;
        }
        return { entries: entries.length, commented, liked };
    }
}

module.exports = new Storage();
