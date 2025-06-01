# ImmoSearch

A TypeScript-based automation tool that monitors **ImmoScout24** and **Kleinanzeigen** for new real estate listings and sends notifications to Telegram.

## Features

- 🏠 **Multi-Platform Support**: Monitors both ImmoScout24 and Kleinanzeigen
- 🔍 Monitors listings based on your saved search filters
- 📱 Sends new listings directly to your Telegram chat
- 🤖 Simulates human-like behavior to avoid detection
- 🔄 Runs continuously with configurable check intervals
- 🍪 Handles cookie consent automatically for both platforms
- 📝 Keeps track of seen listings separately for each platform
- 🔧 Interactive mode for easy configuration
- 🌐 Flexible configuration - use one or both platforms

## Prerequisites

- Node.js (v20.9.0 or higher)
- npm (v10.1.0 or higher)
- A Telegram bot token
- At least one saved search filter URL from ImmoScout24 or Kleinanzeigen

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

3. Create a `.env` file in the project root. Copy from `.env.example` and configure:

   ```env
   # Required: Telegram Configuration
   TELEGRAM_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_IDS=your_chat_id1,your_chat_id2

   # Platform Configuration (at least one required)
   IMMOSCOUT_FILTER_URL=your_immoscout_filter_url
   KLEINANZEIGEN_FILTER_URL=your_kleinanzeigen_filter_url

   # Optional
   INSTANCE_NAME=default
   DEBUG_TELEGRAM_ID=your_debug_chat_id
   ```

## Environment Variables

### Required Variables

| Variable            | Description                                | Example                 |
| ------------------- | ------------------------------------------ | ----------------------- |
| `TELEGRAM_TOKEN`    | Your Telegram bot token from @BotFather    | `1234567890:ABC-DEF...` |
| `TELEGRAM_CHAT_IDS` | Comma-separated chat IDs for notifications | `123456789,987654321`   |

### Platform Configuration (At least one required)

| Variable                   | Description                     | Example                                                |
| -------------------------- | ------------------------------- | ------------------------------------------------------ |
| `IMMOSCOUT_FILTER_URL`     | ImmoScout24 search filter URL   | `https://www.immobilienscout24.de/Suche/de/berlin/...` |
| `KLEINANZEIGEN_FILTER_URL` | Kleinanzeigen search filter URL | `https://www.kleinanzeigen.de/s-wohnung-mieten/...`    |

### Optional Variables

| Variable            | Description                   | Default   |
| ------------------- | ----------------------------- | --------- |
| `INSTANCE_NAME`     | Instance name for file naming | `default` |
| `DEBUG_TELEGRAM_ID` | Debug chat ID for testing     | _(none)_  |

## Getting Your Filter URLs

### ImmoScout24

1. Go to [ImmoScout24](https://www.immobilienscout24.de)
2. Navigate to rental properties and set up your filters (location, price, size, etc.)
3. Copy the URL from your browser address bar
4. Use this as your `IMMOSCOUT_FILTER_URL`

### Kleinanzeigen

1. Go to [Kleinanzeigen](https://www.kleinanzeigen.de)
2. Navigate to "Immobilien" > "Mietwohnungen"
3. Set up your search filters (location, price, size, etc.)
4. Copy the URL from your browser address bar
5. Use this as your `KLEINANZEIGEN_FILTER_URL`

**Example URLs:**

```bash
# ImmoScout24 - Berlin apartments under €1500, 2+ rooms
IMMOSCOUT_FILTER_URL=https://www.immobilienscout24.de/Suche/de/berlin/berlin/wohnung-mieten?price=-1500&rooms=2-

# Kleinanzeigen - Wuppertal apartments under €700
KLEINANZEIGEN_FILTER_URL=https://www.kleinanzeigen.de/s-wohnung-mieten/wuppertal/preis::700/c203l1561r5+wohnung_mieten.swap_s:nein+options:wohnung_mieten.pets_allowed_b
```

## Usage

### Interactive Mode

Run the script in interactive mode to configure it on the fly:

```bash
npx tsx check-immo-scout.ts --interactive
```

The interactive mode will prompt you for:

- Telegram Chat IDs
- ImmoScout24 filter URL (optional)
- Kleinanzeigen filter URL (optional)

### Non-Interactive Mode

Run the script using environment variables:

```bash
npx tsx check-immo-scout.ts
```

### Single Test Run

Test your configuration with a single check:

```bash
npx tsx check-immo-scout.ts --once
```

### Using Different Environment Files

You can specify a custom environment file using the `--env` or `--env-file` flag:

```bash
npx tsx check-immo-scout.ts --env .env.production
```

This is useful for:

- **Multiple instances**: Different configurations for different searches
- **Different environments**: Separate configs for testing vs production
- **Multiple locations**: Different filter URLs for different cities

#### Example Environment Files:

**.env.berlin** (Both platforms for Berlin):

```env
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_CHAT_IDS=123456789
IMMOSCOUT_FILTER_URL=https://www.immobilienscout24.de/Suche/de/berlin/...
KLEINANZEIGEN_FILTER_URL=https://www.kleinanzeigen.de/s-wohnung-mieten/berlin/...
INSTANCE_NAME=berlin
```

**.env.munich** (ImmoScout24 only for Munich):

```env
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_CHAT_IDS=987654321
IMMOSCOUT_FILTER_URL=https://www.immobilienscout24.de/Suche/de/muenchen/...
INSTANCE_NAME=munich
```

**.env.hamburg** (Kleinanzeigen only for Hamburg):

```env
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_CHAT_IDS=456789123
KLEINANZEIGEN_FILTER_URL=https://www.kleinanzeigen.de/s-wohnung-mieten/hamburg/...
INSTANCE_NAME=hamburg
```

Then run them separately:

```bash
npx tsx check-immo-scout.ts --env .env.berlin
npx tsx check-immo-scout.ts --env .env.munich --once
```

### Command Line Options

| Option          | Short | Description                            |
| --------------- | ----- | -------------------------------------- |
| `--interactive` | `-i`  | Run in interactive mode                |
| `--once`        | `-o`  | Run once and exit (useful for testing) |
| `--env <file>`  |       | Use custom environment file            |
| `--help`        | `-h`  | Show help message                      |

### Combining Flags

You can combine multiple flags:

```bash
npx tsx check-immo-scout.ts --interactive --once --env .env.custom
```

## Platform Features

### ImmoScout24

- ✅ Automatic cookie consent handling
- ✅ Listing tracking with unique IDs
- ✅ Human-like browsing behavior
- ✅ Error handling and retries

### Kleinanzeigen

- ✅ Multiple selector strategies for robust scraping
- ✅ Automatic cookie consent handling
- ✅ ID extraction from various listing formats
- ✅ Error handling and fallback mechanisms

## Data Management

### Tracking Files

The bot creates separate tracking files for each platform:

- `data/immoscout_listings.{instance}.json` - ImmoScout24 listings
- `data/kleinanzeigen_listings.{instance}.json` - Kleinanzeigen listings

### Listing Management

- Tracks up to 100 seen listings per platform
- Automatically removes old listings
- Prevents duplicate notifications
- Each platform maintains separate tracking

## Telegram Notifications

### Message Format

New listings are sent with platform indicators:

- 🏠 **ImmoScout24** listings
- 🏘️ **Kleinanzeigen** listings

Example notification:

```
🆕 Neue Wohnungen gefunden (2 insgesamt):

🏠 ImmoScout24 - Wohnung 1/2:
https://www.immobilienscout24.de/expose/123456789

🏘️ Kleinanzeigen - Wohnung 2/2:
https://www.kleinanzeigen.de/s-anzeige/987654321

Viel Erfolg bei der Wohnungssuche! 🍀
```

## Configuration

### Check Intervals

- **Normal mode**: Checks every 5-8 minutes (randomized)
- **Debug mode**: Checks every 10 seconds

### Human-like Behavior

- Random delays between actions (1-3 seconds)
- Natural mouse movements
- Smooth scrolling
- Realistic browser fingerprint
- Randomized check intervals

## Getting Telegram Configuration

### Bot Token

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the instructions
3. Copy the provided token

### Chat ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. It will reply with your chat ID
3. For group chats, add the bot to the group first

## Multiple Instance Setup

You can run multiple instances simultaneously:

```bash
# Terminal 1 - Berlin monitoring
npx tsx check-immo-scout.ts --env .env.berlin

# Terminal 2 - Munich monitoring
npx tsx check-immo-scout.ts --env .env.munich

# Terminal 3 - Hamburg monitoring
npx tsx check-immo-scout.ts --env .env.hamburg
```

Each instance will:

- Use separate tracking files
- Send to different Telegram chats (if configured)
- Monitor different cities/platforms
- Run independently

## Error Handling

### Robust Error Management

- Automatic retries on failure (up to 3 attempts)
- Detailed error logging to `debug.{instance}.log`
- Screenshot capture for debugging failed scrapes
- Graceful handling of platform-specific errors
- Continues monitoring other platforms if one fails

### Debug Features

- Debug mode with faster check intervals
- Separate debug Telegram chat for testing
- Comprehensive logging of all actions
- Screenshot capture on errors

## Development

The project uses:

- **TypeScript** for type safety
- **ES Modules** for modern JavaScript
- **Playwright** for browser automation
- **Inquirer** for interactive CLI
- **Undici** for HTTP requests

### Project Structure

```
├── check-immo-scout.ts     # Main application
├── .env.example           # Environment configuration template
├── data/                  # Tracking files directory
│   ├── immoscout_listings.{instance}.json
│   └── kleinanzeigen_listings.{instance}.json
├── debug.{instance}.log   # Debug logs
└── package.json          # Dependencies
```

## Troubleshooting

### Common Issues

1. **No listings found**: Check your filter URLs are correct and accessible
2. **Cookie consent issues**: The bot handles this automatically, but some pages may have new consent forms
3. **Rate limiting**: The bot uses human-like delays, but you can increase intervals if needed
4. **Telegram not receiving messages**: Verify your bot token and chat IDs are correct

### Debug Mode

Enable debug logging by setting a `DEBUG_TELEGRAM_ID` and monitoring the debug log file.

## License

ISC
