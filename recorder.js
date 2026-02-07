const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, 'user_data');
const RECORDING_DIR = path.join(__dirname, 'recordings');
const SESSION_ID = Date.now().toString();
const SESSION_DIR = path.join(RECORDING_DIR, SESSION_ID);

if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

console.log(`Recording session started: ${SESSION_ID}`);
console.log(`Logs will be saved to: ${SESSION_DIR}`);

// Stream for writing actions
const logFile = fs.createWriteStream(path.join(SESSION_DIR, 'actions.jsonl'), { flags: 'a' });

function saveLog(data) {
    const entry = JSON.stringify({ timestamp: new Date(), ...data });
    logFile.write(entry + '\n');
    console.log(`Recorded: ${data.type} on ${data.target || 'window'}`);
}

(async () => {
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        channel: 'chrome',
        viewport: null,
        args: ['--start-maximized']
    });

    const page = await context.newPage();

    // Helper to take full snapshots
    async function takeSnapshot(trigger) {
        const time = Date.now();
        console.log(`Capturing snapshot for: ${trigger}...`);
        try {
            await page.screenshot({ path: path.join(SESSION_DIR, `screen-${time}-${trigger}.png`) });
            const html = await page.content();
            fs.writeFileSync(path.join(SESSION_DIR, `dom-${time}-${trigger}.html`), html);
        } catch (err) {
            console.error('Snapshot error:', err.message);
        }
    }

    // Listen to console messages from the browser (Main Transport)
    page.on('console', async (msg) => {
        const text = msg.text();
        if (text.startsWith('RECORDER_ACTION:')) {
            try {
                const jsonStr = text.substring('RECORDER_ACTION:'.length);
                const data = JSON.parse(jsonStr);

                // Save log entry
                saveLog(data);

                // Take snapshot for significant interactions
                // User requested screenshots for: clicks, enter keys, url changes
                if (['click', 'keypress', 'navigation'].includes(data.type)) {
                    if (data.type === 'keypress' && data.key !== 'Enter') {
                        return;
                    }

                    // Pre-action snapshot
                    await takeSnapshot(data.type);

                    // Post-action snapshot logging (delayed)
                    if (data.type === 'click' || data.type === 'keypress') {
                        setTimeout(async () => {
                            try {
                                // Provide context check to ensure page is still valid
                                if (!page.isClosed()) {
                                    await takeSnapshot(data.type + '_post');
                                }
                            } catch (e) {
                                console.log('Post-action snapshot failed (page navigated?): ' + e.message);
                            }
                        }, 800);
                    }
                }

            } catch (e) {
                console.error('Failed to parse log:', e);
            }
        }
    });

    // Track detailed URL changes
    page.on('framenavigated', async (frame) => {
        if (frame === page.mainFrame()) {
            const url = frame.url();
            saveLog({ type: 'navigation', url: url });
            await takeSnapshot('navigation');
        }
    });

    await page.goto('https://www.linkedin.com/mynetwork/catch-up/all/');

    // Initial Snapshot of Landing Page
    await takeSnapshot('landing_page');

    // Inject scripts to track user actions
    await page.addInitScript(() => {

        function getSelector(el) {
            if (!el) return '';
            let label = el.innerText || el.getAttribute('aria-label') || '';
            label = label.replace(/\s+/g, ' ').trim().substring(0, 50);

            let val = el.tagName.toLowerCase();
            if (el.id) val += '#' + el.id;

            // Collect meaningful classes
            if (el.className && typeof el.className === 'string') {
                const classes = el.className.split(' ')
                    .filter(c => !c.startsWith('ember') && !c.includes('active') && !c.includes('hover') && c.length > 2);
                if (classes.length > 0) val += '.' + classes.join('.');
            }

            // Add attributes that might be unique selectors
            if (el.getAttribute('data-control-name')) val += `[data-control-name="${el.getAttribute('data-control-name')}"]`;

            if (label) val += `[text="${label}"]`;
            return val;
        }

        function safeLog(data) {
            console.log('RECORDER_ACTION:' + JSON.stringify(data));
        }

        // 1. Mouse Movement (Throttled)
        let lastMove = 0;
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - lastMove > 100) { // 10 times per second
                lastMove = now;
                safeLog({
                    type: 'mousemove',
                    x: e.clientX,
                    y: e.clientY,
                    target: getSelector(e.target)
                });
            }
        }, { passive: true });

        // 2. Interaction Tracking (PointerDown is more robust than mousedown)
        document.addEventListener('pointerdown', (e) => {
            if (!e.isPrimary) return; // Only primary pointer

            const target = e.target;
            const log = {
                type: 'click', // standardizing on 'click' for the log
                x: e.clientX,
                y: e.clientY,
                target: getSelector(target),
                tagName: target.tagName,
                outerHTML: target.outerHTML.substring(0, 200), // Log partial HTML
                href: target.closest('a') ? target.closest('a').href : '', // Check if inside link
                path: e.composedPath().map(el => getSelector(el)).slice(0, 5) // Log path to find parent
            };
            safeLog(log);
        }, true);

        // 3. Key Presses
        document.addEventListener('keydown', (e) => {
            const log = {
                type: 'keypress',
                key: e.key,
                target: getSelector(e.target)
            };
            safeLog(log);
        }, true);

        // 4. Scroll
        let lastScroll = 0;
        document.addEventListener('scroll', () => {
            const now = Date.now();
            if (now - lastScroll > 500) {
                lastScroll = now;
                safeLog({
                    type: 'scroll',
                    scrollY: window.scrollY,
                    x: 0, // Placeholder
                    y: 0
                });
            }
        }, { passive: true });

        console.log("RECORDER_V4_INITIALIZED");
    });

    console.log('Recorder v3 is ready. capturing EVERYTHING.');

})();
