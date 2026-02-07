/**
 * commenter.js - Comment verification and posting functionality
 * Opens new tab to check for existing comments and posts quick replies
 */

const config = require('../core/config');
const logger = require('../core/logger');
const interactor = require('./interactor');

class Commenter {
    /**
     * Open the comment link in a new tab (Ctrl+Click simulation)
     * @param {ElementHandle} card - The profile card element
     * @param {Page} mainPage - Main Playwright page
     * @param {BrowserContext} context - Browser context for new pages
     * @returns {Promise<Page|null>} - The new tab page, or null if failed
     */
    async openCommentTab(card, mainPage, context) {
        try {
            // Find the comment link/button
            const commentLink = await card.$(config.SELECTORS.COMMENT_LINK);
            if (!commentLink) {
                logger.warn('Comment link not found on card.');
                return null;
            }

            // Get the href if it's a link, or just click with modifier
            const href = await commentLink.getAttribute('href');

            let newPage;
            if (href) {
                // Open in new tab directly via URL
                const fullUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
                logger.debug(`Opening comment page: ${fullUrl}`);

                newPage = await context.newPage();
                await newPage.goto(fullUrl, { waitUntil: 'domcontentloaded' });
            } else {
                // Ctrl+Click to open in new tab
                logger.debug('Using Ctrl+Click to open comment page...');

                const [popup] = await Promise.all([
                    context.waitForEvent('page'),
                    commentLink.click({ modifiers: ['Control'] })
                ]);
                newPage = popup;
            }

            // Wait for page to load
            await interactor.delay(2000, 3000);
            logger.info('Comment tab opened successfully.');

            return newPage;
        } catch (err) {
            logger.error('Error opening comment tab:', err);
            return null;
        }
    }

    /**
     * Check if we've already commented on this post
     * Looks for "• You" marker in comments section
     * @param {Page} page - The new tab page with the post
     * @returns {Promise<boolean>} - true if already commented
     */
    async hasAlreadyCommented(page) {
        try {
            // Wait for comments to load
            await interactor.delay(1500, 2500);

            // Look for all comment metadata elements
            const metaElements = await page.$$(config.SELECTORS.MY_COMMENT_MARKER);

            for (const el of metaElements) {
                try {
                    const text = await el.innerText();
                    if (text && text.includes('You')) {
                        logger.info('Found existing comment marker "• You" - already commented.');
                        return true;
                    }
                } catch (ignore) {
                    // Element may have detached
                }
            }

            logger.debug('No existing comment found.');
            return false;
        } catch (err) {
            logger.error('Error checking for existing comment:', err);
            return false;
        }
    }

    /**
     * Post a congratulations comment using the quick reply chip
     * @param {Page} page - The new tab page with the post
     * @returns {Promise<boolean>} - true if comment was posted
     */
    async postComment(page) {
        try {
            // Human-like delay before action
            await interactor.delay(config.ACTION_DELAY.min, config.ACTION_DELAY.max);

            // Find the "Congratulations! 🎉" quick reply button
            const quickReply = await page.$(config.SELECTORS.QUICK_REPLY_CONGRATS);
            if (!quickReply) {
                logger.warn('Quick reply "Congratulations" button not found.');
                return false;
            }

            logger.action('Clicking "Congratulations! 🎉" quick reply...');

            if (!config.DRY_RUN) {
                await quickReply.click();
                await interactor.delay(1000, 2000); // Wait for text to populate
            } else {
                logger.debug('[DRY RUN] Would click Congratulations quick reply.');
            }

            // Now find and click the Comment/Submit button
            await interactor.delay(500, 1000);

            const submitBtn = await page.$(config.SELECTORS.COMMENT_SUBMIT_BUTTON);
            if (!submitBtn) {
                logger.warn('Comment submit button not found.');
                return false;
            }

            logger.action('Clicking Comment submit button...');

            if (!config.DRY_RUN) {
                await submitBtn.click();
                await interactor.delay(2000, 3000); // Wait for comment to post
                logger.info('Comment posted successfully!');
            } else {
                logger.debug('[DRY RUN] Would click Comment submit button.');
            }

            return true;
        } catch (err) {
            logger.error('Error posting comment:', err);
            return false;
        }
    }
}

module.exports = new Commenter();
