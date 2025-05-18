# ImmoSearch

A TypeScript-based automation tool that monitors ImmoScout24 for new real estate listings and sends notifications to Telegram.

## Features

- 🔍 Monitors ImmoScout24 listings based on your saved search filters
- 📱 Sends new listings directly to your Telegram chat
- 🤖 Simulates human-like behavior to avoid detection
- 🔄 Runs continuously with configurable check intervals
- 🍪 Handles cookie consent automatically
- 📝 Keeps track of seen listings to avoid duplicates
- 🔧 Interactive mode for easy configuration

## Prerequisites

- Node.js (v20.9.0 or higher)
- npm (v10.1.0 or higher)
- A Telegram bot token
- A saved search filter URL from ImmoScout24

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/immosearch.git
   cd immosearch
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root with the following variables:

   ```env
   TELEGRAM_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_IDS=your_chat_id1,your_chat_id2
   IMMOSCOUT_FILTER_URL=your_immoscout_filter_url
   DEBUG_TELEGRAM_ID=your_debug_chat_id  # Optional: for debug mode
   ```

## Usage

### Interactive Mode

Run the script in interactive mode to configure it on the fly:

```bash
npx tsx check-immo-scout.ts --interactive
```

or

```bash
npx tsx check-immo-scout.ts -i
```

### Non-Interactive Mode

Run the script using environment variables:

```bash
npx tsx check-immo-scout.ts
```

## Configuration

### Environment Variables

- `TELEGRAM_TOKEN`: Your Telegram bot token
- `TELEGRAM_CHAT_IDS`: Comma-separated list of Telegram chat IDs
- `IMMOSCOUT_FILTER_URL`: Your saved ImmoScout24 search filter URL

### Check Intervals

- Normal mode: Checks every 5-8 minutes
- Debug mode: Checks every 10 seconds

## Features in Detail

### Human-like Behavior

- Random delays between actions
- Natural mouse movements
- Smooth scrolling
- Realistic browser fingerprint

### Listing Management

- Tracks up to 100 seen listings
- Automatically removes old listings
- Prevents duplicate notifications

### Error Handling

- Automatic retries on failure
- Detailed error logging
- Screenshot capture for debugging

## Development

The project uses:

- TypeScript for type safety
- ES Modules for modern JavaScript
- Playwright for browser automation
- Inquirer for interactive CLI
- Undici for HTTP requests

## License

ISC
