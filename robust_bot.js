const { chromium } = require('playwright');
const path = require('path');
const config = require('./lib/core/config');
const logger = require('./lib/core/logger');
const storage = require('./lib/core/storage');
const inspector = require('./lib/actions/inspector');
const interactor = require('./lib/actions/interactor');
const navigator = require('./lib/actions/navigator');
const liker = require('./lib/actions/liker');
const commenter = require('./lib/actions/commenter');

async function run() {
    logger.info('Starting Robust LinkedIn Bot...');
    const USER_DATA_DIR = path.join(__dirname, 'user_data');

    // Launch persistent context to reuse login session
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        channel: 'chrome', // Use actual Chrome for better evasion/state
        viewport: null,
        args: ['--start-maximized'],
        slowMo: 100
    });

    // Persistent context comes with a default page, use it or create new if needed.
    // Usually pages()[0] is the default tab.
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    try {
        // 1. Navigate to LinkedIn & Check Login
        await page.goto('https://www.linkedin.com');
        // Simple check: if "Sign in" button exists, we are not logged in.
        // For the robust bot, we assume user is logged in or we pause for them.
        // Ideally, we'd reuse the user_data_dir from Chrome if possible, but 
        // to simplify, let's assume this is a "Fresh Run" where user logs in manually if needed
        // OR we use the same user data dir as previous attempts.

        // Let's assume we are using the `start_trainer.bat` style which might not persist cookies 
        // across these "fresh" node runs unless we specify context. 
        // USER PROMPT implies "Detection" is a concern, so reusing a persistent context is CRITICAL.
        // We will notify the user if they need to log in.

        await navigator.goToCatchUp(page);

        // Wait for user to maybe login if redirected to login page
        if (page.url().includes('login') || page.url().includes('signup') || page.url().includes('checkpoint')) {
            logger.action('Please log in manually in the browser window. Waiting for login...');

            // Wait until URL indicates we are logged in (no longer on login/signup pages)
            while (page.url().includes('login') || page.url().includes('signup') || page.url().includes('checkpoint')) {
                await page.waitForTimeout(1000);
            }

            logger.info('Login detected! Re-navigating to Catch Up...');
            await navigator.goToCatchUp(page);
        }

        // 2. Wait for catch-up container to load
        logger.info('Scanning Catch Up list...');
        try {
            await page.waitForSelector(config.SELECTORS.CATCH_UP_CONTAINER, { timeout: 15000 });
            logger.info('Catch Up list container found.');
        } catch (e) {
            logger.warn('Catch Up container not found within 15s, will try scanning anyway...');
        }

        // Process max cards for this safety run
        let processedCount = 0;
        const MAX_CARDS = 50;
        let emptyScrollCount = 0;
        const MAX_EMPTY_SCROLLS = 12; // Stop after 12 consecutive empty scrolls

        while (processedCount < MAX_CARDS) {
            // Find all visible cards within the list container
            const container = await page.$(config.SELECTORS.CATCH_UP_CONTAINER);
            let cards;
            if (container) {
                cards = await container.$$(config.SELECTORS.PROFILE_CARD);
            } else {
                cards = await page.$$(config.SELECTORS.PROFILE_CARD);
            }
            logger.info(`Found ${cards.length} visible cards.`);

            if (cards.length === 0) {
                emptyScrollCount++;
                if (emptyScrollCount >= MAX_EMPTY_SCROLLS) {
                    logger.info(`No cards found after ${MAX_EMPTY_SCROLLS} scroll attempts. Ending.`);
                    break;
                }
                logger.info(`No more cards found. Scrolling... (attempt ${emptyScrollCount}/${MAX_EMPTY_SCROLLS})`);
                await interactor.humanScroll(page);
                await page.waitForTimeout(3000);
                continue;
            }

            // Reset empty scroll counter when cards are found
            emptyScrollCount = 0;

            // Iterate cards
            for (const card of cards) {
                if (processedCount >= MAX_CARDS) break;

                // Pre-emptive Cleanup
                await closeAllOverlays(page);
                if (processedCount >= MAX_CARDS) break;

                // Scroll card into view
                await card.scrollIntoViewIfNeeded();

                // Get Name for logging - ROBUST METHOD using aria-label (stable)
                let name = 'Unknown';
                let cardText = '';

                // Method 1: Extract from profile figure's aria-label (most stable)
                const profileFigure = await card.$(config.SELECTORS.PROFILE_FIGURE);
                if (profileFigure) {
                    const ariaLabel = await profileFigure.getAttribute('aria-label');
                    // aria-label format: "Name's profile picture"
                    if (ariaLabel && ariaLabel.includes("'s profile picture")) {
                        name = ariaLabel.replace("'s profile picture", "").trim();
                    }
                }

                // Method 2: Fallback - use structural navigation from three-dots menu
                if (name === 'Unknown') {
                    const threeDots = await card.$(config.SELECTORS.THREE_DOTS_MENU);
                    if (threeDots) {
                        // Get parent (header row) and find first <p> element
                        const headerRow = await threeDots.evaluateHandle(el => el.parentElement);
                        const pElements = await headerRow.$$('p');
                        if (pElements.length > 0) {
                            name = await pElements[0].innerText() || 'Unknown';
                        }
                    }
                }

                logger.debug(`Analyzing card for: ${name}`);

                // Get card text for context (year info, birthday/anniversary)
                cardText = await card.innerText();
                let type = 'generic';
                if (cardText.toLowerCase().includes(config.STRINGS.BIRTHDAY)) type = 'birthday';
                else if (cardText.toLowerCase().includes(config.STRINGS.ANNIVERSARY)) type = 'anniversary';

                logger.info(`Context for ${name}: ${type}`);

                // Check storage to see what's already done for this specific entry
                const messageSent = await inspector.isAlreadyProcessed(page, card);
                const likeAlreadyDone = storage.isLikeProcessed(name, cardText);
                const commentAlreadyDone = storage.isCommentProcessed(name, cardText);

                // If ALL tasks done, skip this card entirely
                if (messageSent && likeAlreadyDone && commentAlreadyDone) {
                    logger.info(`Skipping ${name}: All 3 tasks (message, like, comment) complete.`);
                    continue;
                }

                logger.info(`Tasks for ${name}: Message=${messageSent ? '✓' : '○'}, Like=${likeAlreadyDone ? '✓' : '○'}, Comment=${commentAlreadyDone ? '✓' : '○'}`);

                try {
                    // ========== STEP 1: MESSAGE (if not already sent) ==========
                    if (!messageSent) {
                        const messageBtn = await card.$(config.SELECTORS.MESSAGE_BUTTON);
                        if (messageBtn && !config.DRY_RUN) {
                            logger.action(`Clicking Message for ${name}...`);
                            logger.debug(`Waiting ${config.ACTION_DELAY.min}-${config.ACTION_DELAY.max}ms before click...`);
                            await interactor.delay(config.ACTION_DELAY.min, config.ACTION_DELAY.max);
                            await messageBtn.click();

                            // Wait for overlay and pre-filled message
                            logger.info('Waiting for overlay and pre-filled message...');
                            await page.waitForTimeout(2500);

                            // Check for pre-filled text
                            const inputSelector = config.SELECTORS.COMMENT_INPUT;
                            let hasPreFilled = false;

                            try {
                                await page.waitForSelector(inputSelector, { timeout: 5000 });
                                const inputs = await page.$$(inputSelector);

                                for (let i = inputs.length - 1; i >= 0; i--) {
                                    const input = inputs[i];
                                    if (await input.isVisible()) {
                                        const pTag = await input.$('p');
                                        let text = pTag ? await pTag.innerText() : await input.innerText();
                                        const lowerText = text.toLowerCase();

                                        const isBirthday = type === 'birthday';
                                        const isAnniversary = type === 'anniversary';
                                        const matchesBirthday = lowerText.includes('birthday');
                                        const matchesAnniversary = lowerText.includes('anniversary') || lowerText.includes('years') || lowerText.includes('congrat');

                                        if ((isBirthday && matchesBirthday) || (isAnniversary && matchesAnniversary)) {
                                            hasPreFilled = true;
                                            logger.info(`Confirmed pre-filled message: "${text.substring(0, 30)}..."`);
                                            await input.click();
                                            await page.waitForTimeout(500);
                                            break;
                                        }
                                    }
                                }
                            } catch (e) {
                                logger.warn('Input box exploration failed:', e.message);
                            }

                            if (hasPreFilled) {
                                logger.action('Sending pre-filled message...');
                                await page.keyboard.press('Enter');
                                await page.waitForTimeout(1000);
                                const closeBtn = await page.$(config.SELECTORS.OVERLAY_CLOSE_BUTTON);
                                if (closeBtn) await closeBtn.click();
                                logger.info(`Message sent to ${name}.`);
                            } else {
                                logger.warn(`No valid pre-filled text for ${name}, closing overlay.`);
                                const closeBtn = await page.$(config.SELECTORS.OVERLAY_CLOSE_BUTTON);
                                if (closeBtn) await closeBtn.click();
                            }
                        }
                    } else {
                        logger.debug(`Message already sent to ${name}.`);
                    }

                    // ========== STEP 2: LIKE (if not already liked) ==========
                    // NOTE: Birthday cards don't have Like buttons - only anniversaries do
                    if (type !== 'birthday') {
                        if (!likeAlreadyDone) {
                            // Check DOM for like state
                            const isLikedInDOM = await liker.isAlreadyLiked(card);

                            if (!isLikedInDOM) {
                                logger.action(`Liking ${name}'s post...`);
                                const liked = await liker.clickLike(card, page);
                                if (liked) {
                                    storage.markLikeProcessed(name, cardText);
                                    logger.info(`Liked ${name}'s post.`);
                                }
                            } else {
                                // Already liked in DOM, just update storage
                                storage.markLikeProcessed(name, cardText);
                                logger.debug(`${name}'s post already liked (DOM), updated storage.`);
                            }
                        } else {
                            logger.debug(`Like already in storage for ${name}.`);
                        }
                    } else {
                        logger.debug(`Skipping Like for ${name} (birthday card - no Like button).`);
                    }

                    // ========== STEP 3: COMMENT (open new tab to verify) ==========
                    // NOTE: Birthday cards don't have Comment buttons - only anniversaries do
                    if (type !== 'birthday') {
                        if (!commentAlreadyDone) {
                            logger.info(`Opening comment tab for ${name}...`);
                            const newTab = await commenter.openCommentTab(card, page, context);

                            if (newTab) {
                                // Check if we already commented on this post (in new tab)
                                const alreadyCommented = await commenter.hasAlreadyCommented(newTab);

                                if (alreadyCommented) {
                                    logger.info(`Found existing comment for ${name}, saving to storage.`);
                                } else {
                                    // Post comment
                                    logger.action(`Posting comment for ${name}...`);
                                    const posted = await commenter.postComment(newTab);
                                    if (posted) {
                                        logger.info(`Comment posted for ${name}.`);
                                    }
                                }

                                // Close tab and save to storage
                                await newTab.close();
                                storage.markCommentProcessed(name, cardText);
                                logger.debug(`Closed comment tab, marked ${name} as commented.`);
                            } else {
                                logger.warn(`Failed to open comment tab for ${name}.`);
                            }
                        } else {
                            logger.debug(`Comment already in storage for ${name}.`);
                        }
                    } else {
                        logger.debug(`Skipping Comment for ${name} (birthday card - no Comment button).`);
                    }

                    // Card fully processed
                    processedCount++;
                    logger.info(`Completed card for ${name}. Total: ${processedCount}/${MAX_CARDS}`);

                    // Wait between cards
                    logger.debug(`Waiting ${config.BETWEEN_CARDS_DELAY.min}-${config.BETWEEN_CARDS_DELAY.max}ms before next card...`);
                    await interactor.delay(config.BETWEEN_CARDS_DELAY.min, config.BETWEEN_CARDS_DELAY.max);

                } catch (err) {
                    logger.error(`Error processing ${name}:`, err);
                    // Recover by closing any open overlays
                    const closeBtn = await page.$(config.SELECTORS.OVERLAY_CLOSE_BUTTON);
                    if (closeBtn) await closeBtn.click();
                }

                // Ensure cleanup after every card
                await closeAllOverlays(page);

                // Scroll for more
                await interactor.humanScroll(page);
            }

        } // End of while loop

        logger.info('Session complete.');

    } catch (error) {
        logger.error('Fatal Bot Error:', error);
    } finally {
        // await browser.close(); // Keep open for user inspection?
    }
}

// Helper to cleanup popups
async function closeAllOverlays(page) {
    try {
        // Find all potential close buttons
        const closeBtns = await page.$$(config.SELECTORS.OVERLAY_CLOSE_BUTTON);
        let closedCount = 0;

        for (const btn of closeBtns) {
            // Check if it's visible and is actually a close button (avoid minimize)
            // Use safe checks
            try {
                const isVisible = await btn.isVisible();
                const text = await btn.innerText();

                if (isVisible && text.includes('Close')) {
                    await btn.click();
                    await page.waitForTimeout(300); // Small wait between clicks
                    closedCount++;
                }
            } catch (ignore) {
                // Element might have detached
            }
        }

        if (closedCount > 0) {
            logger.debug(`Closed ${closedCount} overlay(s).`);
            await page.waitForTimeout(1000); // Allow animations to finish
        }
    } catch (err) {
        logger.warn('Error during overlay cleanup:', err);
    }
}



run();
