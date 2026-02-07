/**
 * liker.js - Like detection and clicking functionality
 */

const config = require('../core/config');
const logger = require('../core/logger');
const interactor = require('./interactor');

class Liker {
    /**
     * Check if the post on this card is already liked
     * @param {ElementHandle} card - The profile card element
     * @returns {Promise<boolean>} - true if already liked
     */
    async isAlreadyLiked(card) {
        try {
            // Check for the "active" like SVG (blue filled thumbs up)
            const activeLike = await card.$(config.SELECTORS.LIKE_BUTTON_ACTIVE);
            if (activeLike) {
                logger.debug('Found active like button (already liked).');
                return true;
            }

            // Check for the "inactive" like SVG (outline thumbs up)
            const inactiveLike = await card.$(config.SELECTORS.LIKE_BUTTON_INACTIVE);
            if (inactiveLike) {
                logger.debug('Found inactive like button (not liked yet).');
                return false;
            }

            // Fallback: if neither found, assume not processed
            logger.warn('Could not determine like state, assuming not liked.');
            return false;
        } catch (err) {
            logger.error('Error checking like state:', err);
            return false;
        }
    }

    /**
     * Click the like button on a card
     * @param {ElementHandle} card - The profile card element
     * @param {Page} page - Playwright page object
     * @returns {Promise<boolean>} - true if click succeeded
     */
    async clickLike(card, page) {
        try {
            // Find the reaction button container
            const reactionBtn = await card.$(config.SELECTORS.REACTION_BUTTON);
            if (!reactionBtn) {
                logger.warn('Reaction button not found on card.');
                return false;
            }

            // Human-like delay before clicking
            await interactor.delay(config.ACTION_DELAY.min, config.ACTION_DELAY.max);

            logger.action('Clicking Like button...');

            if (!config.DRY_RUN) {
                await reactionBtn.click();
                await interactor.delay(1000, 2000); // Wait for animation
            } else {
                logger.debug('[DRY RUN] Would click Like button.');
            }

            return true;
        } catch (err) {
            logger.error('Error clicking like:', err);
            return false;
        }
    }
}

module.exports = new Liker();
