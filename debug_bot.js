const LinkedInBot = require('./lib/linkedin_bot');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, 'user_data');
const bot = new LinkedInBot(USER_DATA_DIR);

// Forward logs to console
bot.on('log', (data) => {
    console.log(`[BOT] ${data.message}`);
});

console.log('Starting Debug Bot...');
bot.start({
    minDelay: 5000,
    maxDelay: 10000
});

// Run for 60 seconds then exit
setTimeout(async () => {
    console.log('Debug session finished. Stopping...');
    await bot.stop();
    process.exit(0);
}, 60000);
