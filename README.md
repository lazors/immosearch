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

### Explore All Pages Mode

By default, the bot only checks the first page of your filter results. To explore ALL pages of your filter (useful for comprehensive searches), use the explore all pages flag:

```bash
npx tsx check-immo-scout.ts --explore-all
```

or

```bash
npx tsx check-immo-scout.ts -e
```

You can also combine it with interactive mode:

```bash
npx tsx check-immo-scout.ts --interactive --explore-all
```

**Note:** Explore all pages mode will:

- Navigate through every page of your filter results
- Check the pagination button status to determine when to stop
- Take longer to complete but finds listings from all pages
- Add a "page" field to tracked listings for better organization

### Using Different Environment Files

You can specify a custom environment file using the `--env` or `--env-file` flag:

```bash
npx tsx check-immo-scout.ts --env .env.production
```

```bash
npx tsx check-immo-scout.ts --env-file .env.staging
```

This is useful for:
- **Multiple instances**: Different configurations for different searches
- **Different environments**: Separate configs for testing vs production
- **Multiple locations**: Different filter URLs for different cities

#### Example Environment Files:

**.env.berlin** (for Berlin apartments):
```env
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_CHAT_IDS=123456789
IMMOSCOUT_FILTER_URL=https://www.immobilienscout24.de/Suche/de/berlin/...
INSTANCE_NAME=berlin
```

**.env.munich** (for Munich apartments):
```env
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_CHAT_IDS=987654321
IMMOSCOUT_FILTER_URL=https://www.immobilienscout24.de/Suche/de/muenchen/...
INSTANCE_NAME=munich
```

Then run them separately:
```bash
npx tsx check-immo-scout.ts --env .env.berlin
npx tsx check-immo-scout.ts --env .env.munich --explore-all
```

### Combining Flags

You can combine multiple flags:

```bash
npx tsx check-immo-scout.ts --interactive --explore-all --env .env.custom
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
