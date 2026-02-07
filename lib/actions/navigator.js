const config = require('../core/config');
const logger = require('../core/logger');

class Navigator {

    /**
     * Navigates to the main Catch Up page.
     */
    async goToCatchUp(page) {
        const catchUpUrl = 'https://www.linkedin.com/mynetwork/catch-up/all/';
        if (!page.url().includes('mynetwork/catch-up')) {
            logger.info('Navigating to Catch Up URL...');
            await page.goto(catchUpUrl);
            await page.waitForLoadState('domcontentloaded');
        } else {
            logger.info('Already on Catch Up page.');
        }
    }

    /**
     * Safely returns to the Catch Up page after visiting a profile or update.
     * Tries "Back" button first, then falls back to direct URL navigation.
     */
    async returnToCatchUp(page) {
        logger.info('Returning to Catch Up list...');

        try {
            // Try browser "Back" first as it's most human-like and preserves scroll position usually
            await page.goBack();
            await page.waitForLoadState('domcontentloaded');

            // Give it a moment to settle
            await page.waitForTimeout(2000);

            // Verify we are actually back
            if (!page.url().includes('mynetwork/catch-up')) {
                logger.warn('Back button failed to return to Catch Up. Forcing URL navigation.');
                await this.goToCatchUp(page);
            }
        } catch (error) {
            logger.error('Error navigating back:', error);
            await this.goToCatchUp(page);
        }
    }
}

module.exports = new Navigator();
