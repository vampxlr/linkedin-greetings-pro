const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class LinkedInBot extends EventEmitter {
    constructor(userDataDir) {
        super();
        this.userDataDir = userDataDir;
        this.isRunning = false;
        this.browserContext = null;
        this.page = null;
        this.config = {};
        this.stats = { greetings: 0, errors: 0 };
    }

    log(message, type = 'info') {
        console.log(`[BOT] ${message}`);
        this.emit('log', { message, type, timestamp: new Date().toLocaleTimeString() });
    }

    updateStats(key, value) {
        if (value === undefined) this.stats[key]++;
        else this.stats[key] = value;
        this.emit('stats', this.stats);
    }

    getRandomDelay(min, max) {
        const minDelay = min || this.config.minDelay || 20000;
        const maxDelay = max || this.config.maxDelay || 60000;
        return Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
    }

    async stop() {
        if (!this.isRunning) return;
        this.log('Stopping bot...', 'warning');
        this.isRunning = false;
    }

    async start(config = {}) {
        if (this.isRunning) {
            this.log('Bot is already running.', 'warning');
            return;
        }

        this.config = {
            minDelay: config.minDelay || 20000,
            maxDelay: config.maxDelay || 60000
        };

        this.isRunning = true;
        this.emit('status', 'running');
        this.log(`Bot started. Delay: ${this.config.minDelay / 1000}-${this.config.maxDelay / 1000}s`);

        try {
            this.log('Launching browser...');
            this.browserContext = await chromium.launchPersistentContext(this.userDataDir, {
                headless: false,
                channel: 'chrome',
                viewport: null
            });

            this.page = await this.browserContext.newPage();

            this.log('Navigating to LinkedIn Catch Up page...');
            await this.page.goto('https://www.linkedin.com/mynetwork/catch-up/all/');

            // Login Check
            this.log('Checking login status...');
            await this.page.waitForTimeout(5000);

            const isLoggedIn = async () => {
                try {
                    const url = this.page.url();
                    // LinkedIn usually redirects to /feed or stays on catch-up if logged in
                    // If redirected to login, url contains 'login' or 'uas'
                    return !url.includes('linkedin.com/login') && !url.includes('linkedin.com/uas/login');
                } catch (e) { return false; }
            };

            if (!await isLoggedIn()) {
                this.log('Not logged in. Waiting for manual login (up to 5 mins)...', 'warning');
                const maxWait = 300000;
                const interval = 2000;
                let waited = 0;

                while (waited < maxWait && this.isRunning) {
                    if (await isLoggedIn()) {
                        this.log('Login detected! Proceeding...', 'success');
                        await this.page.waitForTimeout(5000); // Wait for load
                        // ensure we are on the right page again
                        await this.page.goto('https://www.linkedin.com/mynetwork/catch-up/all/');
                        break;
                    }
                    await this.page.waitForTimeout(interval);
                    waited += interval;
                }

                if (waited >= maxWait) {
                    this.log('Timed out waiting for login.', 'error');
                    this.isRunning = false;
                    return;
                }
            } else {
                this.log('Logged in.', 'success');
            }

            await this.page.waitForTimeout(3000);

            // Main Loop
            let noButtonsFoundCount = 0;

            while (this.isRunning) {
                try {
                    // Strategy A: Direct "Say..." buttons on the list
                    // These are faster if available.
                    const directButtons = await this.page.getByRole('button', { name: /say happy birthday|say congrats|exclaims/i }).all();
                    let actionTaken = false;

                    for (const button of directButtons) {
                        if (!this.isRunning) break;
                        if (await button.isVisible()) {
                            this.log('Found direct greeting button. Clicking...');
                            await button.click();
                            await this.handleMessaging();
                            actionTaken = true;
                            break;
                        }
                    }

                    // Strategy B: Navigate to "Update" view (Robust Method)
                    // If no direct buttons, find the "Card" and click it to open detailed view
                    if (!actionTaken) {
                        // Find cards by text that indicates a life event
                        const eventKeywords = ['job update', 'birthday', 'work anniversary', 'started a new position'];
                        let cardClicked = false;

                        for (const keyword of eventKeywords) {
                            if (cardClicked || !this.isRunning) break;

                            // Look for the text (Title of the card)
                            // We need to be careful to click the CONTAINER or the LINK, not just the text span
                            const targetText = this.page.getByText(keyword, { exact: false }).first();

                            if (await targetText.isVisible()) {
                                // Logic to avoid re-clicking the same one? 
                                // Ideally we should track processed URLs, but for now we rely on the list changing or scrolling.
                                // Actually, if we just click the first one, we might get stuck in a loop if we don't dismiss it.
                                // The user's flow was: Click -> Reply -> Back. The list effectively refreshes or we need to scroll past it?
                                // Let's try scrolling a bit if we've seen this before?
                                // For now, simple implementation: Click, Reply, Back.

                                this.log(`found event card "${keyword}". Navigating to details...`);

                                // Try to find the closest clickable ancestor (usually the card link or the whole div)
                                // Standard LinkedIn feed update link often wraps the time/text
                                // We'll try capturing the URL before clicking to verify navigation
                                const currentUrl = this.page.url();

                                await targetText.click({ force: true });
                                // Sometimes text is not clickable, try parent?
                                // But usually text works.

                                await this.page.waitForLoadState('domcontentloaded');
                                await this.page.waitForTimeout(3000);

                                if (this.page.url() !== currentUrl) {
                                    this.log('Navigated to update page.');
                                    cardClicked = true;

                                    // Strategy C: Quick Reply Chips (on detailed page)
                                    // Selector: button.comments-quick-comments__reply-button
                                    const replyChips = await this.page.locator('button.comments-quick-comments__reply-button').all();

                                    if (replyChips.length > 0) {
                                        this.log(`Found ${replyChips.length} quick reply chips.`);
                                        // Prefer "Congratulations" or "Happy Birthday"
                                        let chipToClick = replyChips[0]; // Default to first

                                        for (const chip of replyChips) {
                                            const text = await chip.innerText();
                                            if (text.includes('Congratulations') || text.includes('Happy Birthday')) {
                                                chipToClick = chip;
                                                break;
                                            }
                                        }

                                        this.log(`Clicking reply chip: "${(await chipToClick.innerText()).substring(0, 20)}..."`);
                                        await chipToClick.click();
                                        await this.page.waitForTimeout(1000);

                                        // Click "Comment" / "Send"
                                        const submitParams = ['button.comments-comment-box__submit-button--cr', 'button[type="submit"]', 'span:text-is("Comment")'];
                                        for (const sel of submitParams) {
                                            const btn = this.page.locator(sel).first();
                                            if (await btn.isVisible()) {
                                                this.log('Clicking Comment button...');
                                                await btn.click();
                                                this.updateStats('greetings');
                                                await this.page.waitForTimeout(2000);
                                                break;
                                            }
                                        }
                                    } else {
                                        this.log('No quick reply chips found. Trying standard messaging...');
                                        await this.handleMessaging();
                                    }

                                    // Go Back
                                    this.log('Returning to Catch Up list...');
                                    await this.page.goto('https://www.linkedin.com/mynetwork/catch-up/all/');
                                    await this.page.waitForTimeout(3000);
                                    actionTaken = true;

                                } else {
                                    this.log('Click did not navigate. Maybe just expanded?');
                                    // If it didn't navigate, maybe we can reply here?
                                    actionTaken = await this.handleMessaging();
                                }
                            }
                        }
                    }

                    if (actionTaken) {
                        this.log('Action completed. Waiting delay...');
                        noButtonsFoundCount = 0;
                        const delay = this.getRandomDelay();
                        await this.wait(delay);
                    } else {
                        noButtonsFoundCount++;
                        this.log(`No text/buttons found in view. Scrolling... (${noButtonsFoundCount})`);
                        await this.page.evaluate(() => window.scrollBy(0, 500));
                        await this.page.waitForTimeout(2000);

                        if (noButtonsFoundCount > 10) {
                            this.log('Scrolled 10 times with no targets. Reloading page...');
                            await this.page.reload();
                            await this.page.waitForTimeout(5000);
                            noButtonsFoundCount = 0;
                        }
                    }

                } catch (err) {
                    this.log(`Error in loop: ${err.message}`, 'error');
                    this.updateStats('errors');
                    // Recover by going home
                    try { await this.page.goto('https://www.linkedin.com/mynetwork/catch-up/all/'); } catch (e) { }
                    await this.page.waitForTimeout(5000);
                }
            }
        } catch (error) {
            this.log(`Critical error: ${error.message}`, 'error');
        } finally {
            this.isRunning = false;
            this.emit('status', 'stopped');
            if (this.browserContext) {
                this.log('Closing browser...');
                await this.browserContext.close().catch(() => { });
                this.browserContext = null;
            }
        }
    }
}

module.exports = LinkedInBot;
