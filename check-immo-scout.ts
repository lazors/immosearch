import { chromium, Browser } from 'playwright';
import { fetch } from 'undici';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Command line argument parsing
const args = process.argv.slice(2);
const isInteractive = args.includes('--interactive') || args.includes('-i');
const exploreAllPages = args.includes('--explore-all') || args.includes('-e');
const showHelp = args.includes('--help') || args.includes('-h');
const runOnce = args.includes('--once') || args.includes('-o');

// Show help and exit if requested
if (showHelp) {
  console.log(`
🏠 ImmoSearch - Multi-Platform Real Estate Telegram Bot

Usage: npx tsx check-immo-scout.ts [options]

Options:
  -i, --interactive     Run in interactive mode to configure settings
  -e, --explore-all     Explore all pages of filter results (not just first page)
  --env <file>          Use custom environment file (default: .env)
  --env-file <file>     Same as --env
  -o, --once           Run once and exit (useful for testing)
  -h, --help           Show this help message

Examples:
  npx tsx check-immo-scout.ts
  npx tsx check-immo-scout.ts --interactive
  npx tsx check-immo-scout.ts --explore-all
  npx tsx check-immo-scout.ts --env .env.berlin
  npx tsx check-immo-scout.ts --interactive --explore-all --env .env.custom
  npx tsx check-immo-scout.ts --once --explore-all --env .env.test

Environment Variables:
  TELEGRAM_TOKEN        Your Telegram bot token (required)
  TELEGRAM_CHAT_IDS     Comma-separated chat IDs (required)
  IMMOSCOUT_FILTER_URL  Your ImmoScout24 filter URL (optional)
  KLEINANZEIGEN_FILTER_URL  Your Kleinanzeigen filter URL (optional)
  INSTANCE_NAME         Instance name for file naming (optional, default: 'default')
  DEBUG_TELEGRAM_ID     Debug chat ID for testing (optional)
  
Note: At least one of IMMOSCOUT_FILTER_URL or KLEINANZEIGEN_FILTER_URL must be provided.
`);
  process.exit(0);
}

// Parse custom env file argument
const envArgIndex = args.findIndex(
  (arg) => arg === '--env' || arg === '--env-file'
);
const customEnvFile =
  envArgIndex !== -1 && args[envArgIndex + 1] ? args[envArgIndex + 1] : null;

dotenv.config({ path: customEnvFile || '.env' });

// Log which environment file is being used
if (customEnvFile) {
  console.log(`🔧 Using custom environment file: ${customEnvFile}`);
} else {
  console.log('🔧 Using default environment file: .env');
}

// Function to validate chat IDs
function validateChatIds(input: string): boolean {
  const ids = input.split(',').map((id) => id.trim());
  return ids.every((id) => /^\d+$/.test(id));
}

// Function to validate URL
function validateUrl(input: string): boolean {
  try {
    new URL(input);
    return true;
  } catch {
    return false;
  }
}

// Function to get configuration
async function getConfiguration() {
  let telegramChatIds: string[] = [];
  let immoscoutFilterUrl: string = '';
  let kleinanzeigenFilterUrl: string = '';

  if (isInteractive) {
    console.log('🔧 Interactive mode enabled');

    // Get Telegram Chat IDs
    const chatIdAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'chatIds',
        message: 'Enter Telegram Chat ID(s) (e.g., 123456789,987654321):',
        validate: (input: string) =>
          validateChatIds(input) || 'Please enter valid numeric chat ID(s)',
        default: process.env.TELEGRAM_CHAT_IDS || '',
      },
    ]);
    telegramChatIds = chatIdAnswer.chatIds
      .split(',')
      .map((id: string) => id.trim());

    // Get ImmoScout Filter URL
    const immoscoutAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'filterUrl',
        message: 'Enter ImmoScout24 filter URL (leave empty to skip):',
        validate: (input: string) =>
          !input ||
          validateUrl(input) ||
          'Please enter a valid URL or leave empty',
        default: process.env.IMMOSCOUT_FILTER_URL || '',
      },
    ]);
    immoscoutFilterUrl = immoscoutAnswer.filterUrl;

    // Get Kleinanzeigen Filter URL
    const kleinanzeigenAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'filterUrl',
        message: 'Enter Kleinanzeigen filter URL (leave empty to skip):',
        validate: (input: string) =>
          !input ||
          validateUrl(input) ||
          'Please enter a valid URL or leave empty',
        default: process.env.KLEINANZEIGEN_FILTER_URL || '',
      },
    ]);
    kleinanzeigenFilterUrl = kleinanzeigenAnswer.filterUrl;
  } else {
    // Use environment variables
    telegramChatIds =
      process.env.TELEGRAM_CHAT_IDS?.split(',').map((id) => id.trim()) || [];
    immoscoutFilterUrl = process.env.IMMOSCOUT_FILTER_URL || '';
    kleinanzeigenFilterUrl = process.env.KLEINANZEIGEN_FILTER_URL || '';
  }

  // Validate required values
  if (!immoscoutFilterUrl && !kleinanzeigenFilterUrl) {
    console.error(
      '❌ At least one filter URL (ImmoScout24 or Kleinanzeigen) is required'
    );
    process.exit(1);
  }

  if (telegramChatIds.length === 0) {
    console.error('❌ At least one Telegram Chat ID is required');
    process.exit(1);
  }

  return {
    telegramChatIds,
    immoscoutFilterUrl,
    kleinanzeigenFilterUrl,
  };
}

// Main function to run the application
async function main() {
  const config = await getConfiguration();

  // 🔗 Filter URLs
  const IMMOSCOUT_FILTER_URL = config.immoscoutFilterUrl;
  const KLEINANZEIGEN_FILTER_URL = config.kleinanzeigenFilterUrl;

  // 📬 Telegram setup
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
  const TELEGRAM_CHAT_IDS = config.telegramChatIds;

  // 📁 Tracking seen listings
  const INSTANCE_NAME = process.env.INSTANCE_NAME || 'default';
  const DEBUG_LOG_FILE = path.resolve(__dirname, `debug.${INSTANCE_NAME}.log`);
  const MAX_SEEN_IDS = 100;
  const REMOVE_COUNT = 70;

  // Create data directory if it doesn't exist
  const DATA_DIR = path.resolve(__dirname, 'data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  function getServiceSpecificFile(service: string): string {
    return path.join(DATA_DIR, `${service}_listings.${INSTANCE_NAME}.json`);
  }

  // 🔄 Retry configuration
  const MAX_RETRIES = 3;
  const INITIAL_RETRY_DELAY = 5000; // 5 seconds

  // Debug configuration
  const DEBUG = false;
  const DEBUG_TELEGRAM_ID = process.env.DEBUG_TELEGRAM_ID || '';

  // Check interval configuration (in milliseconds)
  const MIN_INTERVAL = DEBUG ? 10 * 1000 : 5 * 60 * 1000; // 10 seconds in debug, 5 minutes otherwise
  const MAX_INTERVAL = DEBUG ? 10 * 1000 : 8 * 60 * 1000; // 10 seconds in debug, 8 minutes otherwise

  // Human-like behavior configuration
  const HUMAN_LIKE = {
    minDelay: DEBUG ? 500 : 1000, // Reduced delays in debug mode
    maxDelay: DEBUG ? 1000 : 3000, // Reduced delays in debug mode
    scrollSteps: DEBUG ? 2 : 3, // Fewer scroll steps in debug mode
    mouseMovements: DEBUG ? 2 : 5, // Fewer mouse movements in debug mode
  };

  // Browser instance management
  let browserInstance: Browser | null = null;
  let pageInstance: any = null;

  async function getBrowser() {
    if (!browserInstance) {
      console.log('🚀 Launching new browser instance...');
      browserInstance = await chromium.launch({
        headless: false,
        slowMo: 50,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins',
          '--disable-site-isolation-trials',
          '--disable-setuid-sandbox',
          '--no-sandbox',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
        ],
      });
    }
    return browserInstance;
  }

  async function initializePage() {
    if (!pageInstance) {
      console.log('🌐 Creating new page...');
      const browser = await getBrowser();
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
        permissions: ['geolocation'],
        geolocation: { longitude: 13.404954, latitude: 52.520008 },
        colorScheme: 'light',
        reducedMotion: 'no-preference',
        forcedColors: 'none',
        acceptDownloads: true,
        javaScriptEnabled: true,
        extraHTTPHeaders: {
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
        },
      });

      pageInstance = await context.newPage();

      // Add error handling for page navigation
      pageInstance.on('error', (err: Error) => {
        console.error('❌ Page error:', err);
      });

      pageInstance.on('pageerror', (err: Error) => {
        console.error('❌ Page error:', err);
      });
    }
    return pageInstance;
  }

  // Debug logging function
  function logDebug(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(DEBUG_LOG_FILE, logMessage);
    console.log(message);
  }

  function loadSeenListings(service: string): Map<string, any> {
    const serviceFile = getServiceSpecificFile(service);
    if (!fs.existsSync(serviceFile)) {
      logDebug(
        `📁 No seen listings file found for ${service} instance ${INSTANCE_NAME}, starting fresh`
      );
      return new Map();
    }
    try {
      const data = JSON.parse(fs.readFileSync(serviceFile, 'utf-8'));
      logDebug(
        `📁 Loaded ${Object.keys(data).length} listings from ${serviceFile}`
      );
      return new Map(Object.entries(data));
    } catch (error) {
      logDebug(`❌ Error loading seen listings for ${service}: ${error}`);
      return new Map();
    }
  }

  function saveSeenListings(service: string, listings: Map<string, any>) {
    try {
      const serviceFile = getServiceSpecificFile(service);
      // Convert to array and sort by timestamp
      const allListings = Array.from(listings.entries());
      const sortedListings = allListings.sort((a, b) => {
        const timeA = new Date(a[1].timestamp).getTime();
        const timeB = new Date(b[1].timestamp).getTime();
        return timeB - timeA; // Sort in descending order (newest first)
      });

      // Log details about removed listings
      if (sortedListings.length > MAX_SEEN_IDS) {
        const removedListings = sortedListings.slice(
          MAX_SEEN_IDS - REMOVE_COUNT
        );
        logDebug(`\n🗑️ Removing old listings for ${service}:`);
        removedListings.forEach(([id, data]) => {
          const date = new Date(data.timestamp).toLocaleString();
          logDebug(`   - ID: ${id}, Seen: ${date}, URL: ${data.url}`);
        });
        logDebug(
          `\n📊 Summary: Removed ${removedListings.length} old listings for ${service}`
        );
      }

      // Keep only the newest MAX_SEEN_IDS
      const keptListings = sortedListings.slice(0, MAX_SEEN_IDS);
      const listingsToSave = Object.fromEntries(keptListings);
      fs.writeFileSync(serviceFile, JSON.stringify(listingsToSave, null, 2));

      logDebug(`\n✅ Saved ${keptListings.length} listings to ${serviceFile}`);
      if (keptListings.length > 0) {
        logDebug(
          `📅 Oldest kept listing: ${new Date(
            keptListings[keptListings.length - 1][1].timestamp
          ).toLocaleString()}`
        );
        logDebug(
          `📅 Newest kept listing: ${new Date(
            keptListings[0][1].timestamp
          ).toLocaleString()}`
        );
      }

      // Log file size
      const stats = fs.statSync(serviceFile);
      logDebug(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    } catch (error) {
      logDebug(`❌ Error saving seen listings for ${service}: ${error}`);
    }
  }

  async function sendTelegramMessage(message: string, specificChatId?: string) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

    // If specific chat ID is provided, only send to that chat
    const targetChatIds = specificChatId ? [specificChatId] : TELEGRAM_CHAT_IDS;

    for (const chatId of targetChatIds) {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
      console.log(`✅ Message sent to chat ${chatId}`);
    }
  }

  // 🕒 Random delay function
  async function randomDelay(
    min: number = HUMAN_LIKE.minDelay,
    max: number = HUMAN_LIKE.maxDelay
  ) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    if (DEBUG) console.log(`⏳ Waiting for ${delay}ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // 🖱️ Human-like mouse movement
  async function humanLikeMouseMovement(page: any) {
    for (let i = 0; i < HUMAN_LIKE.mouseMovements; i++) {
      const x = Math.floor(Math.random() * 1000);
      const y = Math.floor(Math.random() * 600);
      await page.mouse.move(x, y, { steps: 25 }); // Move in steps for more natural movement
      await randomDelay(100, 300);
    }
  }

  // 📜 Human-like scrolling
  async function humanLikeScroll(page: any) {
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
    const scrollStep = totalHeight / HUMAN_LIKE.scrollSteps;

    for (let i = 0; i < HUMAN_LIKE.scrollSteps; i++) {
      const scrollTo = Math.min(scrollStep * (i + 1), totalHeight);
      await page.evaluate((y: number) => {
        window.scrollTo({
          top: y,
          behavior: 'smooth',
        });
      }, scrollTo);
      await randomDelay(800, 2000);
    }
  }

  // 🏠 ImmoScout24 specific functions
  async function handleImmoScout24CookieConsent(page: any) {
    try {
      console.log('🍪 Looking for ImmoScout24 cookie consent button...');
      await page.waitForSelector('[data-testid="uc-accept-all-button"]', {
        timeout: 10000,
      });
      await randomDelay(500, 1500);
      await page.click('[data-testid="uc-accept-all-button"]');
      console.log('✅ Accepted ImmoScout24 cookies');
      await randomDelay();
    } catch (e) {
      console.log('⚠️ ImmoScout24 cookie button not found or already accepted');
    }
  }

  async function checkImmoScoutListings(page: any): Promise<string[]> {
    console.log('\n🏠 Checking ImmoScout24 listings...');
    const newListings: string[] = [];

    // Navigate to ImmoScout24
    console.log('🌐 Navigating to ImmoScout24...');
    await page.goto(IMMOSCOUT_FILTER_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await handleImmoScout24CookieConsent(page);

    // Wait for listings to load
    const listingSelector = '[data-testid$="-slide-0"]';
    console.log('⏳ Waiting for ImmoScout24 listings...');
    await page.waitForSelector(listingSelector, { timeout: 15000 });

    const listings = await page.$$(listingSelector);
    console.log(`📊 Found ${listings.length} ImmoScout24 listings`);

    if (listings.length === 0) {
      console.log('❌ No ImmoScout24 listings found!');
      return newListings;
    }

    const seen = loadSeenListings('immoscout');
    const newSeen = new Map(seen);

    // Process each listing
    for (const listing of listings) {
      try {
        const dataTestId = await listing.getAttribute('data-testid');
        if (!dataTestId) continue;

        const id = dataTestId.split('-')[0];
        const isNew = !seen.has(id);

        if (isNew) {
          console.log(`🆕 Found new ImmoScout24 listing: ${id}`);

          const link = await listing.$('xpath=ancestor::a');
          if (!link) continue;

          const href = await link.getAttribute('href');
          if (!href) continue;

          const fullUrl = href.startsWith('http')
            ? href
            : `https://www.immobilienscout24.de${href}`;

          newListings.push(fullUrl);

          const listingData = {
            id,
            url: fullUrl,
            timestamp: new Date().toISOString(),
            service: 'immoscout',
          };
          newSeen.set(id, listingData);
        }
      } catch (error) {
        console.error(`❌ Error processing ImmoScout24 listing:`, error);
        continue;
      }
    }

    saveSeenListings('immoscout', newSeen);
    console.log(`✅ Found ${newListings.length} new ImmoScout24 listings`);
    return newListings;
  }

  // 🏘️ Kleinanzeigen specific functions
  async function handleKleinanzeigenCookieConsent(page: any) {
    try {
      console.log('🍪 Looking for Kleinanzeigen cookie consent...');
      // Common cookie consent selectors for Kleinanzeigen
      const cookieSelectors = [
        '[data-testid="gdpr-accept-all"]',
        '.gdpr-cookie-layer__btn--accept-all',
        '#gdpr-consent-accept-all',
        'button[id*="accept"]',
        'button[class*="accept"]',
        '.cookie-consent button',
      ];

      for (const selector of cookieSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await randomDelay(500, 1500);
          await page.click(selector);
          console.log('✅ Accepted Kleinanzeigen cookies');
          await randomDelay();
          return;
        } catch (e) {
          continue;
        }
      }
      console.log(
        '⚠️ Kleinanzeigen cookie button not found or already accepted'
      );
    } catch (e) {
      console.log('⚠️ Error handling Kleinanzeigen cookies:', e);
    }
  }

  async function checkKleinanzeigenListings(page: any): Promise<string[]> {
    console.log('\n🏘️ Checking Kleinanzeigen listings...');
    const newListings: string[] = [];

    // Navigate to Kleinanzeigen
    console.log('🌐 Navigating to Kleinanzeigen...');
    await page.goto(KLEINANZEIGEN_FILTER_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await handleKleinanzeigenCookieConsent(page);

    // Wait for page to load
    await randomDelay(2000, 3000);

    // Possible selectors for Kleinanzeigen listings
    const listingSelectors = [
      'article[data-adid]',
      '.ad-listitem',
      '.aditem',
      '[data-adid]',
      '.adlist-item',
    ];

    let listings: any[] = [];
    let usedSelector = '';

    // Try different selectors to find listings
    for (const selector of listingSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        listings = await page.$$(selector);
        if (listings.length > 0) {
          usedSelector = selector;
          console.log(
            `📊 Found ${listings.length} Kleinanzeigen listings using selector: ${selector}`
          );
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (listings.length === 0) {
      console.log('❌ No Kleinanzeigen listings found!');
      console.log('📸 Taking screenshot for debugging...');
      await page.screenshot({ path: 'kleinanzeigen-no-listings.png' });
      return newListings;
    }

    const seen = loadSeenListings('kleinanzeigen');
    const newSeen = new Map(seen);

    // Process each listing
    for (const listing of listings) {
      try {
        // Try to get listing ID from data-adid attribute
        let id = await listing.getAttribute('data-adid');

        if (!id) {
          // Try to extract ID from link href
          const link = await listing.$('a');
          if (link) {
            const href = await link.getAttribute('href');
            if (href) {
              const idMatch = href.match(/\/(\d+)(?:-|$)/);
              if (idMatch) {
                id = idMatch[1];
              }
            }
          }
        }

        if (!id) {
          console.log('⚠️ Could not extract ID from Kleinanzeigen listing');
          continue;
        }

        const isNew = !seen.has(id);

        if (isNew) {
          console.log(`🆕 Found new Kleinanzeigen listing: ${id}`);

          // Find the link to the listing
          let link = await listing.$('a');
          if (!link) {
            // Try to find link in parent elements
            link = await listing.$('xpath=.//a');
          }

          if (!link) {
            console.log('⚠️ No link found for Kleinanzeigen listing');
            continue;
          }

          const href = await link.getAttribute('href');
          if (!href) {
            console.log('⚠️ No href found for Kleinanzeigen listing');
            continue;
          }

          const fullUrl = href.startsWith('http')
            ? href
            : `https://www.kleinanzeigen.de${href}`;

          newListings.push(fullUrl);

          const listingData = {
            id,
            url: fullUrl,
            timestamp: new Date().toISOString(),
            service: 'kleinanzeigen',
          };
          newSeen.set(id, listingData);
        }
      } catch (error) {
        console.error(`❌ Error processing Kleinanzeigen listing:`, error);
        continue;
      }
    }

    saveSeenListings('kleinanzeigen', newSeen);
    console.log(`✅ Found ${newListings.length} new Kleinanzeigen listings`);
    return newListings;
  }

  async function checkAllServices() {
    console.log('\n==========================================');
    console.log('🔄 STARTING NEW CHECK CYCLE');
    console.log('==========================================');

    const page = await initializePage();
    let allNewListings: { url: string; service: string }[] = [];

    // Check ImmoScout24 if URL is provided
    if (IMMOSCOUT_FILTER_URL) {
      try {
        const immoscoutListings = await checkImmoScoutListings(page);
        immoscoutListings.forEach((url) => {
          allNewListings.push({ url, service: 'ImmoScout24' });
        });
      } catch (error) {
        console.error('❌ Error checking ImmoScout24:', error);
      }
    }

    // Check Kleinanzeigen if URL is provided
    if (KLEINANZEIGEN_FILTER_URL) {
      try {
        const kleinanzeigenListings = await checkKleinanzeigenListings(page);
        kleinanzeigenListings.forEach((url) => {
          allNewListings.push({ url, service: 'Kleinanzeigen' });
        });
      } catch (error) {
        console.error('❌ Error checking Kleinanzeigen:', error);
      }
    }

    // Send new listings to Telegram
    if (allNewListings.length > 0) {
      console.log(
        `\n📤 Sending ${allNewListings.length} new listings to Telegram...`
      );

      // Send header message first
      const headerMessage = `🆕 Neue Wohnungen gefunden (${allNewListings.length} insgesamt):`;
      if (DEBUG) {
        await sendTelegramMessage(headerMessage, DEBUG_TELEGRAM_ID);
      } else {
        await sendTelegramMessage(headerMessage);
      }

      // Send each listing as a separate message
      for (let i = 0; i < allNewListings.length; i++) {
        const { url, service } = allNewListings[i];
        const serviceEmoji = service === 'ImmoScout24' ? '🏠' : '🏘️';
        const listingMessage = `${serviceEmoji} ${service} - Wohnung ${i + 1}/${
          allNewListings.length
        }:\n${url}`;

        if (DEBUG) {
          await sendTelegramMessage(listingMessage, DEBUG_TELEGRAM_ID);
        } else {
          await sendTelegramMessage(listingMessage);
        }

        // Add small delay between messages to avoid rate limits
        if (i < allNewListings.length - 1) {
          await randomDelay(500, 1000);
        }
      }

      console.log(
        `✅ Sent ${allNewListings.length} new listings to Telegram as separate messages`
      );
    } else {
      console.log('\n📭 No new listings found on any platform.');
    }
  }

  async function runPeriodicCheck() {
    const enabledServices = [];
    if (IMMOSCOUT_FILTER_URL) enabledServices.push('ImmoScout24');
    if (KLEINANZEIGEN_FILTER_URL) enabledServices.push('Kleinanzeigen');

    console.log('🔄 Starting autonomous check system...');
    console.log(`🏠 Enabled services: ${enabledServices.join(', ')}`);
    console.log(`⏰ Will check every ${DEBUG ? '10 seconds' : '5-8 minutes'}`);
    console.log('📱 New listings will be sent to Telegram');
    console.log('❌ Press Ctrl+C to stop the script\n');

    // Initialize browser and page once at the start
    await initializePage();

    while (true) {
      try {
        const currentTime = new Date().toLocaleString();
        console.log(`\n⏰ Starting check at ${currentTime}`);

        await checkAllServices();

        // Wait for the next check
        const waitTime = DEBUG
          ? 10000
          : Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL + 1)) +
            MIN_INTERVAL;
        console.log(`\n⏳ Next check in ${waitTime / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } catch (error) {
        console.error('❌ Check failed:', error);
        // Wait a bit before retrying after an error
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  // Browser cleanup function
  async function cleanup() {
    if (browserInstance) {
      console.log('🔄 Closing browser...');
      await browserInstance.close();
      browserInstance = null;
      pageInstance = null;
    }
  }

  // Handle process termination
  process.on('SIGINT', async () => {
    console.log('\n👋 Stopping autonomous check system...');
    await cleanup();
    console.log('✅ Cleanup complete. Goodbye!');
    process.exit(0);
  });

  // Start the check (either once or periodic)
  if (runOnce) {
    const enabledServices = [];
    if (IMMOSCOUT_FILTER_URL) enabledServices.push('ImmoScout24');
    if (KLEINANZEIGEN_FILTER_URL) enabledServices.push('Kleinanzeigen');

    console.log('🔄 Running single check...');
    console.log(`🏠 Enabled services: ${enabledServices.join(', ')}`);

    try {
      await checkAllServices();
      console.log('✅ Single check completed successfully!');
    } catch (error) {
      console.error('❌ Single check failed:', error);
    } finally {
      await cleanup();
      console.log('👋 Goodbye!');
      process.exit(0);
    }
  } else {
    // Start the periodic check
    runPeriodicCheck();
  }
}

// Run the main function
main().catch((error) => {
  console.error('❌ Application error:', error);
  process.exit(1);
});
