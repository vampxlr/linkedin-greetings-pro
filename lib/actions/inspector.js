const config = require('../core/config');
const logger = require('../core/logger');

class Inspector {

    /**
     * Checks if we have already interacted with this card/profile.
     * Looks for "Message sent" text or specific success SVGs.
     */
    async isAlreadyProcessed(page, cardElement) {
        try {
            // Scope queries to the card if possible, otherwise page-level
            const processedIndicator = await cardElement.$(config.SELECTORS.SUCCESS_SIGNAL);
            if (processedIndicator) {
                logger.debug('Found success signal SVG on card.');
                return true;
            }

            const messageSentText = await cardElement.$(config.SELECTORS.MESSAGE_SENT_TEXT);
            if (messageSentText) {
                logger.debug('Found "Message sent" text on card.');
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error in isAlreadyProcessed:', error);
            return false;
        }
    }

    /**
     * Checks the messaging overlay for recent messages from "Me".
     * Returns true if we sent a message recently (duplicate danger).
     */
    async hasRecentMessage(page) {
        try {
            // Wait briefly for overlay to load messages
            try {
                await page.waitForSelector(config.SELECTORS.MESSAGE_LIST, { timeout: 3000 });
            } catch (e) {
                // No message list found, maybe empty or just started
                logger.debug('No message list found in overlay.');
                return false;
            }

            // Get all messages sent by "Me"
            const myMessages = await page.$$(config.SELECTORS.MY_MESSAGE);

            if (myMessages.length > 0) {
                // Check the content of the last message? 
                // For now, if WE sent the last message, assume we already greeted.
                // A more robust check would scan the text for "Happy Birthday" etc.
                const lastMessage = myMessages[myMessages.length - 1];
                const text = await lastMessage.innerText();

                logger.debug(`Found previous message from user: "${text.substring(0, 30)}..."`);

                // If the last message contains our greeting keywords, it's a duplicate.
                const lowerText = text.toLowerCase();
                if (lowerText.includes(config.STRINGS.BIRTHDAY) ||
                    lowerText.includes(config.STRINGS.ANNIVERSARY) ||
                    lowerText.includes("congrats")) {
                    return true;
                }

                // Optional: Check timestamp if available (harder to parse)
            }

            return false;
        } catch (error) {
            logger.error('Error checking recent messages:', error);
            return false; // Fail safe: assume no message to avoid blocking valid ones? Or opposite?
        }
    }
}

module.exports = new Inspector();
