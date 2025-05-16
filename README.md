# ImmoScout24 Automated Listing Checker

An automated tool that monitors ImmoScout24 for new real estate listings based on your saved search filters and sends notifications to Telegram.

## Features

- 🔍 Monitors your saved ImmoScout24 search filters
- 📱 Sends instant notifications to Telegram when new listings are found
- 🤖 Simulates human-like behavior to avoid detection
- 🔄 Configurable check intervals
- 🛡️ Robust error handling and retry mechanisms
- 📊 Keeps track of seen listings to avoid duplicates

## Prerequisites

- Node.js (v14 or higher)
- A Telegram bot token
- A saved search filter URL from ImmoScout24

## Setup

1. Clone this repository:

```bash
git clone <your-repo-url>
cd immosearch
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```env
IMMOSCOUT_FILTER_URL=your_saved_search_url_here
TELEGRAM_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_IDS=chat_id1,chat_id2
```

### Getting Required Information

1. **ImmoScout24 Filter URL**:

   - Go to ImmoScout24 and set up your search filters
   - Save the search
   - Copy the URL of your saved search

2. **Telegram Bot Setup**:
   - Create a new bot using [@BotFather](https://t.me/botfather) on Telegram
   - Get the bot token
   - Start a chat with your bot
   - Get your chat ID (you can use [@userinfobot](https://t.me/userinfobot))
   - Add the chat ID to the `TELEGRAM_CHAT_IDS` environment variable

## Usage

1. Start the checker:

```bash
npm start
```

The script will:

- Check for new listings every 5-8 minutes (configurable)
- Send notifications to your Telegram chat when new listings are found
- Keep track of seen listings to avoid duplicates

## Launch Command

To run the script, use one of the following commands:

```bash
# Using npm
npm start

```

### Running TypeScript File Directly

To run the TypeScript file directly without compilation, you'll need to:

1. Install ts-node globally:

```bash
npm install -g ts-node typescript
```

2. Install required dependencies:

```bash
npm install playwright undici dotenv
```

3. Run the script:

```bash
ts-node check-immo-scout.ts
```

Make sure you have all dependencies installed and your `.env` file configured before running the script.

## Configuration

You can modify the following settings in the code:

- `MIN_INTERVAL`: Minimum time between checks (default: 5 minutes)
- `MAX_INTERVAL`: Maximum time between checks (default: 8 minutes)
- `MAX_SEEN_IDS`: Number of recent listings to keep track of (default: 100)
- `MAX_RETRIES`: Number of retry attempts for failed checks (default: 3)

## Debug Mode

To enable debug mode, set `DEBUG = true` in the code. This will:

- Reduce check intervals to 10 seconds
- Reduce human-like behavior delays
- Send notifications only to the first chat ID in the list

## Stopping the Script

Press `Ctrl+C` to stop the script. The script will perform a clean shutdown:

- Close the browser instance
- Save the current state
- Exit gracefully

## Troubleshooting

1. **No listings found**:

   - Verify your filter URL is correct
   - Check if ImmoScout24 is accessible
   - Ensure your search criteria are not too restrictive

2. **Telegram notifications not working**:

   - Verify your bot token is correct
   - Ensure you've started a chat with your bot
   - Check if the chat ID is correct

3. **Script crashes**:
   - Check the console output for error messages
   - Verify all environment variables are set correctly
   - Ensure you have a stable internet connection

## License

[Your chosen license]

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
