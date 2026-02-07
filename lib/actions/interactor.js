const config = require('../core/config');
const logger = require('../core/logger');

class Interactor {

    /**
     * specific helper to delay execution
     */
    async delay(min = 500, max = 1500) {
        const time = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, time));
    }

    /**
     * Simulates human-like mouse movement to a selector and clicks it.
     */
    async humanClick(page, selector) {
        try {
            const element = await page.$(selector);
            if (!element) {
                throw new Error(`Element not found: ${selector}`);
            }

            const box = await element.boundingBox();
            if (!box) {
                throw new Error(`Element is not visible: ${selector}`);
            }

            // Randomize target point within the element
            const x = box.x + (box.width * 0.2) + Math.random() * (box.width * 0.6);
            const y = box.y + (box.height * 0.2) + Math.random() * (box.height * 0.6);

            // Move mouse with steps (Playwright's move is linear, but we can add intermediate steps if needed)
            // For now, Playwright's default move with 'steps' is okay, but let's vary the speed
            await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 10) });

            // Hover briefly
            await this.delay(200, 600);

            // Click
            await page.mouse.down();
            await this.delay(50, 150);
            await page.mouse.up();

            logger.action(`Clicked: ${selector}`);
        } catch (error) {
            logger.error(`Failed to click ${selector}:`, error);
            throw error;
        }
    }

    /**
     * Type text like a human
     */
    async humanType(page, text) {
        for (const char of text) {
            await page.keyboard.type(char, { delay: Math.random() * 100 + 30 });
        }
    }

    /**
     * Scroll with random variance
     */
    async humanScroll(page) {
        const scrollAmount = 300 + Math.floor(Math.random() * config.SCROLL_VARIANCE);
        await page.mouse.wheel(0, scrollAmount);
        await this.delay(500, 1000);
    }
}

module.exports = new Interactor();
