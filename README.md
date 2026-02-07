# LinkedIn Greetings Pro 🎉

An automated LinkedIn bot that sends personalized birthday and work anniversary greetings to your connections. Features a modern web dashboard for easy control and monitoring.

## ✨ Features

- **Automated Greetings**: Automatically sends messages for birthdays and work anniversaries
- **Smart Engagement**: Likes and comments on anniversary posts
- **Web Dashboard**: Modern, real-time web interface for control and monitoring
- **Session Management**: Persistent LinkedIn login sessions
- **Live Logs**: Real-time log streaming with typewriter effect
- **Configurable Delays**: Customizable timing to appear human-like
- **DRY RUN Mode**: Test the bot without making actual changes
- **Progress Tracking**: Monitor processed profiles, likes, and comments

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **Chrome Browser** installed on your system

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

### First Run

1. Start the web server:
   ```bash
   npm start
   # or
   node server.js
   ```

2. The dashboard will automatically open at `http://localhost:3001`

3. **Login to LinkedIn**:
   - Expand the "🔐 Session" section
   - Click "Login to LinkedIn"
   - A Chrome window will open
   - Log in to LinkedIn manually
   - The session will be saved automatically

4. **Start the Bot**:
   - Click the "▶ START BOT" button in the header
   - Watch the live logs for real-time updates

## 🎮 Usage

### Main Controls

- **START/STOP Button**: Located in the header, controls the bot's execution
- **Session Section**: Manage LinkedIn login status
- **Progress Section**: View statistics (profiles processed, likes, comments)
- **Configuration Section**: Adjust bot behavior and timing

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| **DRY RUN Mode** | Simulates actions without clicking | OFF |
| **Action Delay** | Time before each click (min-max) | 5000-10000ms |
| **Between Cards Delay** | Time between processing cards | 10000-15000ms |
| **Max Cards** | Number of cards to process (0 = infinite) | 10 |

### How It Works

1. The bot navigates to LinkedIn's "Catch Up" feed
2. Scans for birthday and work anniversary cards
3. For each card:
   - **Birthdays**: Sends a pre-filled birthday message
   - **Anniversaries**: Sends message, likes the post, and adds a comment
4. Tracks processed profiles to avoid duplicates
5. Uses human-like delays to avoid detection

## 📂 Project Structure

```
LINKED IN COM/
├── server.js              # Express + Socket.IO server
├── robust_bot.js          # Main bot logic
├── package.json           # Dependencies
├── public/                # Web dashboard
│   ├── index.html         # Dashboard UI
│   └── style.css          # Styling
├── lib/
│   ├── robust_bot_wrapper.js  # Bot process manager
│   ├── actions/               # Bot action modules
│   │   ├── inspector.js
│   │   ├── interactor.js
│   │   ├── navigator.js
│   │   ├── liker.js
│   │   └── commenter.js
│   └── core/                  # Core utilities
│       ├── config.js          # Configuration
│       ├── logger.js          # Logging
│       └── storage.js         # Data persistence
├── data/                      # Processed profiles (auto-created)
├── logs/                      # Log files (auto-created)
└── user_data/                 # LinkedIn session (auto-created)
```

## 🛠️ Advanced Configuration

### Editing Bot Behavior

The bot's behavior can be customized by editing `lib/core/config.js`:

```javascript
module.exports = {
    DRY_RUN: false,              // Enable/disable test mode
    MAX_CARDS: 10,               // Cards per run
    ACTION_DELAY: { min: 5000, max: 10000 },
    BETWEEN_CARDS_DELAY: { min: 10000, max: 15000 },
    SCROLL_VARIANCE: 500,
    // ... selectors and strings
};
```

### Custom Selectors

If LinkedIn's UI changes, update the selectors in `lib/core/config.js`:
- `PROFILE_CARD`: Main card selector
- `MESSAGE_BUTTON`: Message button
- `LIKE_BUTTON`: Like button
- `COMMENT_BUTTON`: Comment button

## ⚠️ Important Warnings

> **LinkedIn Automation Policy**: This bot automates LinkedIn interactions. Use at your own risk. LinkedIn's terms of service prohibit automation, and excessive use may result in account restrictions.

**Best Practices:**
- Use conservative delays (5-15 seconds)
- Limit to 10-20 cards per day
- Run during business hours
- Monitor for LinkedIn detection warnings
- Test with DRY RUN first

## 🐛 Troubleshooting

### Port Already in Use
If port 3001 is busy, the server will auto-increment to 3002, 3003, etc.

### Bot Stops Immediately
- Check if you're logged in (Session section)
- Verify Chrome is installed
- Check logs for error messages

### No Cards Found
- Ensure you're on LinkedIn's "Catch Up" page
- Wait for the page to load completely
- Check if you have birthday/anniversary notifications

### Login Browser Won't Open
- Close all Chrome instances
- Delete `user_data/` folder
- Try logging in again

## 📊 Data Storage

- **Processed Profiles**: Stored in `data/processed_profiles.json`
- **Login Session**: Stored in `user_data/` (Chrome profile data)
- **Logs**: Stored in `logs/` directory

## 🔒 Privacy & Security

- **Session Data**: Keep `user_data/` private (excluded from git)
- **Processed Data**: Contains profile names and timestamps
- **No Passwords Stored**: Uses Playwright's persistent context

## 📝 License

This project is for educational purposes only. Use responsibly and in accordance with LinkedIn's terms of service.

## 🤝 Contributing

This is a personal automation project. Feel free to fork and customize for your needs.

## 📧 Support

For issues or questions, check the live logs in the dashboard for detailed error messages.

---

**Made with ❤️ for automating LinkedIn greetings**
