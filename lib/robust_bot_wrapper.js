/**
 * robust_bot_wrapper.js - Wrapper for controlling robust_bot.js via web GUI
 * Handles: child process spawning, log streaming, session management
 */

const { spawn } = require('child_process');
const { chromium } = require('playwright');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, '../user_data');
const CONFIG_FILE = path.join(__dirname, 'core/config.js');

class RobustBotWrapper extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.botProcess = null;
        this.loginBrowser = null;
        this.stats = { processed: 0, liked: 0, commented: 0, errors: 0 };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
        this.emit('log', { message, type, timestamp });
    }

    /**
     * Check if we have saved session data
     */
    hasSession() {
        return fs.existsSync(USER_DATA_DIR) &&
            fs.readdirSync(USER_DATA_DIR).length > 0;
    }

    /**
     * Get login info from stored cookies (if possible)
     * Returns email or null
     */
    async getLoginInfo() {
        if (!this.hasSession()) {
            return { loggedIn: false, email: null };
        }

        // Try to read cookies from user_data
        const cookiesPath = path.join(USER_DATA_DIR, 'Default', 'Cookies');
        const localStatePath = path.join(USER_DATA_DIR, 'Default', 'Local State');

        // For now, just check if session exists - extracting email requires browser
        // We'll mark as "Session Found" and let the bot verify actual login
        return {
            loggedIn: true,
            email: 'Session data found',
            hasData: true
        };
    }

    /**
     * Clear session data (logout)
     */
    async logout() {
        if (this.isRunning) {
            throw new Error('Cannot logout while bot is running');
        }

        try {
            if (fs.existsSync(USER_DATA_DIR)) {
                // Delete user_data folder recursively
                fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
                this.log('Session data cleared (logged out)', 'success');
            }
            return { success: true };
        } catch (err) {
            this.log(`Logout failed: ${err.message}`, 'error');
            return { success: false, error: err.message };
        }
    }

    /**
     * Open browser for login
     * Waits for user to complete login, then saves session
     */
    async openLoginBrowser() {
        if (this.isRunning) {
            throw new Error('Cannot login while bot is running');
        }

        if (this.loginBrowser) {
            throw new Error('Login browser already open');
        }

        try {
            this.log('Opening browser for LinkedIn login...', 'info');
            this.emit('status', 'logging_in');

            this.loginBrowser = await chromium.launchPersistentContext(USER_DATA_DIR, {
                headless: false,
                channel: 'chrome',
                viewport: null,
                args: ['--start-maximized']
            });

            const page = await this.loginBrowser.newPage();
            await page.goto('https://www.linkedin.com/login');

            this.log('Please log in to LinkedIn in the browser window...', 'warning');

            // Wait for successful login (URL changes away from login page)
            let loggedIn = false;
            const maxWait = 300000; // 5 minutes
            const startTime = Date.now();

            while (!loggedIn && (Date.now() - startTime) < maxWait) {
                const url = page.url();
                if (!url.includes('/login') && !url.includes('/uas/') && !url.includes('/checkpoint')) {
                    loggedIn = true;
                    this.log('Login detected! Session saved.', 'success');
                    break;
                }
                await page.waitForTimeout(1000);
            }

            // Close browser
            await this.loginBrowser.close();
            this.loginBrowser = null;

            if (loggedIn) {
                this.emit('status', 'stopped');
                return { success: true, message: 'Login successful, session saved.' };
            } else {
                this.emit('status', 'stopped');
                return { success: false, message: 'Login timed out.' };
            }
        } catch (err) {
            this.log(`Login error: ${err.message}`, 'error');
            if (this.loginBrowser) {
                await this.loginBrowser.close().catch(() => { });
                this.loginBrowser = null;
            }
            this.emit('status', 'stopped');
            return { success: false, error: err.message };
        }
    }

    /**
     * Close login browser if open
     */
    async closeLoginBrowser() {
        if (this.loginBrowser) {
            await this.loginBrowser.close().catch(() => { });
            this.loginBrowser = null;
            this.emit('status', 'stopped');
        }
    }

    /**
     * Start the robust_bot.js as a child process
     */
    async start() {
        if (this.isRunning) {
            throw new Error('Bot is already running');
        }

        if (!this.hasSession()) {
            throw new Error('No session found. Please login first.');
        }

        this.isRunning = true;
        this.emit('status', 'running');
        this.log('Starting Robust Bot...', 'info');

        const botPath = path.join(__dirname, '../robust_bot.js');

        this.botProcess = spawn('node', [botPath], {
            cwd: path.join(__dirname, '..'),
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Stream stdout
        this.botProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(l => l.trim());
            lines.forEach(line => {
                // Parse log format: [TIME] [LEVEL] Message
                const match = line.match(/\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)/);
                if (match) {
                    this.emit('log', {
                        timestamp: match[1],
                        type: match[2].toLowerCase(),
                        message: match[3]
                    });
                } else {
                    this.emit('log', { message: line, type: 'info' });
                }

                // Update stats from log messages
                if (line.includes('Completed card')) this.stats.processed++;
                if (line.includes('Liked')) this.stats.liked++;
                if (line.includes('Comment posted') || line.includes('existing comment')) this.stats.commented++;
                if (line.includes('Error')) this.stats.errors++;
                this.emit('stats', this.stats);
            });
        });

        // Stream stderr
        this.botProcess.stderr.on('data', (data) => {
            this.emit('log', { message: data.toString(), type: 'error' });
        });

        // Handle process exit
        this.botProcess.on('close', (code) => {
            this.log(`Bot process exited with code ${code}`, code === 0 ? 'info' : 'warning');
            this.isRunning = false;
            this.botProcess = null;
            this.emit('status', 'stopped');
        });

        this.botProcess.on('error', (err) => {
            this.log(`Bot process error: ${err.message}`, 'error');
            this.isRunning = false;
            this.botProcess = null;
            this.emit('status', 'stopped');
        });
    }

    /**
     * Stop the bot process
     */
    async stop() {
        if (!this.isRunning || !this.botProcess) {
            return;
        }

        this.log('Stopping bot...', 'warning');

        // Send SIGTERM to gracefully stop
        this.botProcess.kill('SIGTERM');

        // Force kill after 5 seconds if still running
        setTimeout(() => {
            if (this.botProcess) {
                this.botProcess.kill('SIGKILL');
            }
        }, 5000);
    }

    /**
     * Get processed profiles stats from JSON file
     */
    getProcessedStats() {
        try {
            const storagePath = path.join(__dirname, '../data/processed_profiles.json');
            if (!fs.existsSync(storagePath)) {
                return { entries: 0, liked: 0, commented: 0 };
            }
            const data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
            const entries = Object.keys(data.processedEntries || {});
            let liked = 0, commented = 0;
            entries.forEach(key => {
                if (data.processedEntries[key].liked) liked++;
                if (data.processedEntries[key].commented) commented++;
            });
            return { entries: entries.length, liked, commented };
        } catch (err) {
            return { entries: 0, liked: 0, commented: 0, error: err.message };
        }
    }
}

module.exports = RobustBotWrapper;
