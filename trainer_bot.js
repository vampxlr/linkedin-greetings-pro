const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = path.join(__dirname, 'user_data');
const LOG_FILE = path.join(__dirname, 'training_session.log');

function log(msg, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${type}] ${msg}`;
    console.log(entry);
    fs.appendFileSync(LOG_FILE, entry + '\n');
}

(async () => {
    log('Starting Trainer Bot Session...');
    log('Goal: Process 5 profiles (Message, Like, Comment).');

    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        channel: 'chrome',
        viewport: null,
        args: ['--start-maximized'],
        slowMo: 100 // Slow down to look human
    });

    const page = await context.newPage();

    try {
        log('Navigating to Catch Up page...');
        await page.goto('https://www.linkedin.com/mynetwork/catch-up/all/');
        await page.waitForTimeout(3000);

        // --- STEP 2: HUMAN-LIKE EXECUTION LOOP ---
        let processedCount = 0;
        const processedUrls = new Set();

        while (processedCount < 5) {
            log(`\n--- SEARCHING FOR TARGET ${processedCount + 1}/5 ---`);

            // 1. Scan for targets again (since the page refreshed/changed)
            const keywords = ['job update', 'birthday', 'work anniversary', 'started a new position'];
            let foundTarget = null;

            // Re-evaluate candidates
            const candidates = await page.getByText(/job update|birthday|anniversary|position/i).all();

            for (const candidate of candidates) {
                if (!await candidate.isVisible()) continue;

                const text = await candidate.innerText();
                if (text.length < 10 || text.length > 100) continue;

                // Find clickable ancestor
                let container = candidate;
                let url = '';
                let clickable = null;

                for (let i = 0; i < 5; i++) {
                    const tagName = await container.evaluate(el => el.tagName);
                    if (tagName === 'A') {
                        url = await container.getAttribute('href');
                        clickable = container;
                        break;
                    }
                    const parent = container.locator('..');
                    if (await parent.count() > 0) container = parent;
                    else break;
                }

                if (url && !processedUrls.has(url)) {
                    // Logic to ignore "generic" or irrelevant links 
                    // (Ensure it is a profile or activity link)
                    if (url.includes('linkedin.com/in/') || url.includes('/feed/update/') || url.startsWith('/')) {

                        let type = 'generic';
                        if (/birthday/i.test(text)) type = 'birthday';
                        else if (/anniversary/i.test(text)) type = 'anniversary';
                        else if (/job|position/i.test(text)) type = 'job';

                        foundTarget = { text, url, type, element: clickable };
                        break; // Process the first valid one we find
                    }
                }
            }

            if (!foundTarget) {
                log('No new targets found in view. Scrolling...');
                await page.evaluate(() => window.scrollBy(0, 500));
                await page.waitForTimeout(3000);
                // condition to exit if we scrolled too much
                continue;
            }

            // 2. Click and Navigate (Human-like)
            log(`Target found: "${foundTarget.text}" (${foundTarget.type})`);
            log('Action: Clicking card to navigate...');
            processedUrls.add(foundTarget.url); // Mark as processed so we don't loop

            await foundTarget.element.click();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(3000); // Wait for animation/load

            // 3. Process the Page
            const currentUrl = page.url();

            // BRANCH: MESSAGE (Overlay or Page)
            if (currentUrl.includes('messaging/compose') || currentUrl.includes('messaging/thread')) {
                log('Context: Direct Message');

                // DUPLICATE CHECK
                // precise selector for the LAST message bubble in the thread
                const lastMessage = page.locator('.msg-s-event-listitem__body').last();
                if (await lastMessage.isVisible()) {
                    const lastText = await lastMessage.innerText();
                    const isMe = await lastMessage.evaluate(el => el.closest('.msg-s-message-list__event').classList.contains('msg-s-message-list__event--mine'));

                    if (isMe) {
                        log(`Last message was sent by ME: "${lastText.substring(0, 30)}..."`);
                        // Check if it was recent or a greeting?
                        // For safety, if I sent the last message, I probably shouldn't send another greeting immediately.
                        log('Skipping to avoid double-greeting.');

                        // Close and return
                        const closeBtn = page.locator('button[aria-label="Dismiss"], button[aria-label="Close"]').first();
                        if (await closeBtn.isVisible()) await closeBtn.click();

                        processedCount++; // Counts as processed (skipped)
                        await returnToCatchUp(page);
                        continue;
                    }
                }

                // Send Logic (Pre-filled or Type)
                const sendBtn = page.locator('button.msg-form__send-button, button[type="submit"]').first();
                if (await sendBtn.isVisible() && await sendBtn.isEnabled()) {
                    log('Message pre-filled. Sending...');
                    await sendBtn.click();
                    log('Action: Sent.');
                } else {
                    const msgBox = page.locator('div[role="textbox"][contenteditable="true"]').first();
                    if (await msgBox.isVisible()) {
                        // Wait for auto-fill
                        await page.waitForTimeout(1500);
                        const content = await msgBox.innerText();
                        if (content && content.trim().length > 5) {
                            log(`Sending pre-filled: "${content.substring(0, 20)}..."`);
                            const sendBtn2 = page.locator('button.msg-form__send-button, button[type="submit"]').first();
                            if (await sendBtn2.isVisible()) await sendBtn2.click();
                            else await msgBox.press('Enter');
                        } else {
                            log('Box empty. Typing default...');
                            let msg = "Happy Birthday!";
                            if (foundTarget.type === 'anniversary') msg = "Happy Anniversary!";
                            else if (foundTarget.type === 'job') msg = "Congrats!";
                            await msgBox.fill(msg);
                            await page.waitForTimeout(500);
                            await msgBox.press('Enter');
                        }
                    }
                }

                // Close overlay
                await page.waitForTimeout(1000);
                const closeBtn = page.locator('button[aria-label="Dismiss"], button[aria-label="Close"]').first();
                if (await closeBtn.isVisible()) await closeBtn.click();

            } else {
                log('Context: Feed Log');
                // Feed Interaction (Like/Comment)
                // ... (Keep existing Like/Comment logic logic)

                // Like
                const likeBtn = page.getByRole('button', { name: 'React Like' }).first();
                if (await likeBtn.isVisible()) {
                    await likeBtn.click();
                    log('Action: Liked');
                }

                // Quick Comment
                const chips = await page.locator('button.comments-quick-comments__reply-button').all();
                if (chips.length > 0) {
                    await chips[0].click();
                    await page.waitForTimeout(500);
                    const submit = page.locator('button.comments-comment-box__submit-button--cr, button[type="submit"]').first();
                    if (await submit.isVisible()) await submit.click();
                    log('Action: Quick Commented');
                } else {
                    // Manual comment logic... (omitted for brevity, assume chip is primary for catch up)
                    log('No quick chips found. Skipping manual comment to be safe.');
                }
            }

            processedCount++;

            // 4. RETURN TO CATCH UP (Crucial for Algorithm)
            await returnToCatchUp(page);
        }

        log('\n--- SESSION COMPLETE ---');
    } catch (e) {
        log(`CRITICAL ERROR: ${e.message}`, 'ERROR');
    } finally {
        log('Closing browser in 10 seconds...');
        await page.waitForTimeout(10000);
        await context.close();
    }
})();

async function returnToCatchUp(page) {
    log('Navigating back to Catch Up list...');
    // Try browser "Back" first as it's most human-like
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Verify we are back, if not, force URL
    if (!page.url().includes('mynetwork/catch-up')) {
        log('Back button did not return to Catch Up. Forcing URL...');
        await page.goto('https://www.linkedin.com/mynetwork/catch-up/all/');
        await page.waitForTimeout(3000);
    }
}
