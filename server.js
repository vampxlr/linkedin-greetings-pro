const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const open = require('open');
const RobustBotWrapper = require('./lib/robust_bot_wrapper');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3001;
const CONFIG_PATH = path.join(__dirname, 'lib/core/config.js');

app.use(express.static('public'));
app.use(express.json());

// Initialize Bot Wrapper
const bot = new RobustBotWrapper();

// Subscribe bot events to socket
bot.on('log', (data) => io.emit('log', data));
bot.on('stats', (data) => io.emit('stats', data));
bot.on('status', (status) => io.emit('status', status));

// ============ BOT CONTROL APIs ============

app.post('/api/start', async (req, res) => {
    try {
        await bot.start();
        res.json({ success: true, message: 'Bot started.' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        await bot.stop();
        res.json({ success: true, message: 'Stop signal sent.' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json({
        isRunning: bot.isRunning,
        hasSession: bot.hasSession()
    });
});

// ============ CONFIG APIs ============

app.get('/api/config', (req, res) => {
    try {
        // Clear require cache to get fresh config
        delete require.cache[require.resolve('./lib/core/config')];
        const config = require('./lib/core/config');
        res.json({
            success: true,
            config: {
                DRY_RUN: config.DRY_RUN,
                MAX_CARDS: config.MAX_CARDS,
                ACTION_DELAY: config.ACTION_DELAY,
                BETWEEN_CARDS_DELAY: config.BETWEEN_CARDS_DELAY,
                SCROLL_VARIANCE: config.SCROLL_VARIANCE
            }
        });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.post('/api/config', async (req, res) => {
    try {
        const updates = req.body;

        // Read current config file
        let configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');

        // Update values
        if (updates.DRY_RUN !== undefined) {
            configContent = configContent.replace(
                /DRY_RUN:\s*(true|false)/,
                `DRY_RUN: ${updates.DRY_RUN}`
            );
        }

        if (updates.MAX_CARDS !== undefined) {
            configContent = configContent.replace(
                /MAX_CARDS:\s*\d+/,
                `MAX_CARDS: ${updates.MAX_CARDS}`
            );
        }

        if (updates.ACTION_DELAY) {
            configContent = configContent.replace(
                /ACTION_DELAY:\s*\{\s*min:\s*\d+,\s*max:\s*\d+\s*\}/,
                `ACTION_DELAY: { min: ${updates.ACTION_DELAY.min}, max: ${updates.ACTION_DELAY.max} }`
            );
        }

        if (updates.BETWEEN_CARDS_DELAY) {
            configContent = configContent.replace(
                /BETWEEN_CARDS_DELAY:\s*\{\s*min:\s*\d+,\s*max:\s*\d+\s*\}/,
                `BETWEEN_CARDS_DELAY: { min: ${updates.BETWEEN_CARDS_DELAY.min}, max: ${updates.BETWEEN_CARDS_DELAY.max} }`
            );
        }

        // Write back
        fs.writeFileSync(CONFIG_PATH, configContent);

        // Clear cache
        delete require.cache[require.resolve('./lib/core/config')];

        res.json({ success: true, message: 'Config updated.' });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ============ LOGIN/SESSION APIs ============

app.get('/api/login-status', async (req, res) => {
    try {
        const info = await bot.getLoginInfo();
        res.json({ success: true, ...info });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        const result = await bot.logout();
        res.json(result);
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        // This is non-blocking - opens browser and returns immediately
        res.json({ success: true, message: 'Opening browser for login...' });
        bot.openLoginBrowser();
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.post('/api/cancel-login', async (req, res) => {
    try {
        await bot.closeLoginBrowser();
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ============ STATS API ============

app.get('/api/processed-stats', (req, res) => {
    try {
        const stats = bot.getProcessedStats();
        res.json({ success: true, ...stats });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ============ SOCKET CONNECTION ============

io.on('connection', (socket) => {
    socket.emit('status', bot.isRunning ? 'running' : 'stopped');

    // Send initial stats
    const stats = bot.getProcessedStats();
    socket.emit('processed-stats', stats);
});

// ============ SERVER STARTUP ============

async function startServer(startPort) {
    let port = startPort;
    let serverRunning = false;

    console.log(`Attempting to start server on port ${port}...`);

    while (!serverRunning) {
        try {
            await new Promise((resolve, reject) => {
                const s = server.listen(port);

                s.once('listening', () => {
                    serverRunning = true;
                    resolve();
                });

                s.once('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        console.log(`Port ${port} is busy, trying ${port + 1}...`);
                        port++;
                        s.close();
                        resolve();
                    } else {
                        reject(err);
                    }
                });
            });
        } catch (err) {
            console.error('Failed to start server:', err);
            process.exit(1);
        }
    }

    const url = `http://localhost:${port}`;
    console.log(`\n==================================================`);
    console.log(`   LinkedIn Greetings Pro - Dashboard`);
    console.log(`   Server running at: ${url}`);
    console.log(`==================================================\n`);

    try {
        await open(url);
    } catch (e) {
        console.log('Could not open browser automatically. Please open the URL manually.');
    }
}

startServer(PORT);
