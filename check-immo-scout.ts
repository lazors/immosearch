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

dotenv.config();

// Command line argument parsing
const args = process.argv.slice(2);
const isInteractive = args.includes('--interactive') || args.includes('-i');

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
  let filterUrl: string = '';

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
    const urlAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'filterUrl',
        message: 'Enter ImmoScout24 filter URL:',
        validate: (input: string) =>
          validateUrl(input) || 'Please enter a valid URL',
        default: process.env.IMMOSCOUT_FILTER_URL || '',
      },
    ]);
    filterUrl = urlAnswer.filterUrl;
  } else {
    // Use environment variables
    telegramChatIds =
      process.env.TELEGRAM_CHAT_IDS?.split(',').map((id) => id.trim()) || [];
    filterUrl = process.env.IMMOSCOUT_FILTER_URL || '';
  }

  // Validate required values
  if (!filterUrl) {
    console.error('❌ ImmoScout24 filter URL is required');
    process.exit(1);
  }

  if (telegramChatIds.length === 0) {
    console.error('❌ At least one Telegram Chat ID is required');
    process.exit(1);
  }

  return {
    telegramChatIds,
    filterUrl,
  };
}

// Main function to run the application
async function main() {
  const config = await getConfiguration();

  // 🔗 Your saved ImmoScout24 filter URL
  const FILTER_URL = config.filterUrl;

  // 📬 Telegram setup
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
  const TELEGRAM_CHAT_IDS = config.telegramChatIds;

  // 📁 Tracking seen listings
  const INSTANCE_NAME = process.env.INSTANCE_NAME || 'default';
  const SEEN_FILE = path.resolve(
    __dirname,
    `seenListings.${INSTANCE_NAME}.json`
  );
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

      // Initial page load
      console.log('🌐 Navigating to ImmoScout24...');
      await pageInstance.goto(FILTER_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Handle cookie consent
      try {
        console.log('🍪 Looking for cookie consent button...');
        await pageInstance.waitForSelector(
          '[data-testid="uc-accept-all-button"]',
          {
            timeout: 10000,
          }
        );
        await randomDelay(500, 1500);
        await pageInstance.click('[data-testid="uc-accept-all-button"]');
        console.log('✅ Accepted cookies');
        await randomDelay();
      } catch (e) {
        console.log('⚠️ Cookie button not found or already accepted');
      }
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

  function loadSeenListings(): Map<string, any> {
    const serviceFile = getServiceSpecificFile('immoscout');
    if (!fs.existsSync(serviceFile)) {
      logDebug(
        `📁 No seen listings file found for instance ${INSTANCE_NAME}, starting fresh`
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
      logDebug(`❌ Error loading seen listings: ${error}`);
      return new Map();
    }
  }

  function saveSeenListings(listings: Map<string, any>) {
    try {
      const serviceFile = getServiceSpecificFile('immoscout');
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
        logDebug('\n🗑️ Removing old listings:');
        removedListings.forEach(([id, data]) => {
          const date = new Date(data.timestamp).toLocaleString();
          logDebug(`   - ID: ${id}, Seen: ${date}, URL: ${data.url}`);
        });
        logDebug(
          `\n📊 Summary: Removed ${removedListings.length} old listings`
        );
      }

      // Keep only the newest MAX_SEEN_IDS
      const keptListings = sortedListings.slice(0, MAX_SEEN_IDS);
      const listingsToSave = Object.fromEntries(keptListings);
      fs.writeFileSync(serviceFile, JSON.stringify(listingsToSave, null, 2));

      logDebug(`\n✅ Saved ${keptListings.length} listings to ${serviceFile}`);
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

      // Log file size
      const stats = fs.statSync(serviceFile);
      logDebug(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    } catch (error) {
      logDebug(`❌ Error saving seen listings: ${error}`);
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

  async function checkFilteredPage() {
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
      try {
        console.log('\n==========================================');
        console.log(
          `🔄 STARTING NEW CHECK CYCLE ${retryCount + 1}/${MAX_RETRIES}`
        );
        console.log('==========================================');

        const page = await initializePage();

        // Force a fresh page load
        console.log('\n==========================================');
        console.log('🔄 REFRESHING PAGE');
        console.log('==========================================');

        try {
          // Use the existing page to navigate
          await page.goto(FILTER_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });

          console.log('==========================================');
          console.log('✅ PAGE REFRESHED');
          console.log('==========================================\n');

          // Wait for the page to fully load
          await page.waitForTimeout(2000);

          // ✅ Wait for listings
          console.log('🔍 Waiting for listings to load...');
          const listingSelector = '[data-testid$="-slide-0"]';

          // Wait for the "Suche speichern" button to be visible
          console.log(
            '⏳ Waiting for page to load (looking for "Suche speichern" button)...'
          );
          await page.waitForSelector('#saveSearchHeaderLink', {
            timeout: 15000,
          });
          console.log('✅ Page loaded successfully');

          // Wait for listings
          console.log('⏳ Waiting for listings...');
          await page.waitForSelector(listingSelector, { timeout: 15000 });
          console.log('✅ Listings container found');

          // Get all listing elements
          console.log('🔍 Finding all listings...');
          const listings = await page.$$(listingSelector);
          console.log(`📊 Found ${listings.length} listings on the page`);

          if (listings.length === 0) {
            console.error('❌ No listings found!');
            console.log('📸 Taking screenshot for debugging...');
            await page.screenshot({ path: 'no-listings.png' });
            throw new Error('No listings found on the page');
          }

          const seen = loadSeenListings();
          const newSeen = new Map(seen);
          const newListings: string[] = [];

          console.log(`📚 Loaded ${seen.size} seen listings from JSON`);
          console.log('🔍 Checking for new listings...');

          // Process each listing
          for (const listing of listings) {
            try {
              const dataTestId = await listing.getAttribute('data-testid');
              if (!dataTestId) {
                console.log('⚠️ Skipping listing without data-testid');
                continue;
              }

              const id = dataTestId.split('-')[0];
              console.log(`\n📝 Processing listing ID: ${id}`);

              const isNew = !seen.has(id);
              console.log(
                `🔍 Listing ${id} is ${isNew ? 'NEW' : 'already seen'}`
              );

              if (isNew) {
                console.log(`🆕 Found new listing: ${id}`);

                const link = await listing.$('xpath=ancestor::a');
                if (!link) {
                  console.log('⚠️ No link found for listing, skipping...');
                  continue;
                }

                const href = await link.getAttribute('href');
                if (!href) {
                  console.log('⚠️ No href found for listing, skipping...');
                  continue;
                }

                const fullUrl = href.startsWith('http')
                  ? href
                  : `https://www.immobilienscout24.de${href}`;

                newListings.push(fullUrl);

                const listingData = {
                  id,
                  url: fullUrl,
                  timestamp: new Date().toISOString(),
                };
                newSeen.set(id, listingData);
                console.log(
                  `✅ Added new listing to seen listings:`,
                  listingData
                );
              } else {
                const seenData = seen.get(id);
                console.log(
                  `⏭️ Skipping already seen listing: ${id} (seen at ${seenData?.timestamp})`
                );
              }
            } catch (error) {
              console.error(`❌ Error processing listing:`, error);
              continue;
            }
          }

          // Save updated seen listings
          console.log(
            `\n💾 Saving ${newSeen.size} listings to seenListings.json...`
          );
          saveSeenListings(newSeen);
          console.log('✅ Seen listings saved successfully');

          // Send new listings to Telegram
          if (newListings.length > 0) {
            console.log(
              `\n📤 Sending ${newListings.length} new listings to Telegram...`
            );
            const message = [
              '🆕 Neue Wohnungen gefunden:',
              '',
              ...newListings,
              '',
              'Viel Erfolg bei der Wohnungssuche! 🍀',
            ].join('\n');

            if (DEBUG) {
              await sendTelegramMessage(message, DEBUG_TELEGRAM_ID);
            } else {
              await sendTelegramMessage(message);
            }
            console.log(
              `✅ Sent ${newListings.length} new listings to Telegram`
            );
          } else {
            console.log('\n📭 No new listings found.');
          }

          break;
        } catch (error) {
          console.error('❌ Error during page check:', error);
          retryCount++;
          if (retryCount === MAX_RETRIES) {
            throw error;
          }
          console.log(`🔄 Retrying... (${retryCount}/${MAX_RETRIES})`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error('❌ Check failed:', error);
        throw error;
      }
    }
  }

  async function getRandomInterval() {
    const interval =
      Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL + 1)) +
      MIN_INTERVAL;
    return interval;
  }

  async function runPeriodicCheck() {
    console.log('🔄 Starting autonomous check system...');
    console.log(`⏰ Will check every ${DEBUG ? '10 seconds' : '5-8 minutes'}`);
    console.log('📱 New listings will be sent to Telegram');
    console.log('❌ Press Ctrl+C to stop the script\n');

    // Initialize browser and page once at the start
    await initializePage();

    while (true) {
      try {
        const currentTime = new Date().toLocaleString();
        console.log(`\n⏰ Starting check at ${currentTime}`);

        await checkFilteredPage();

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

  // Handle process termination
  process.on('SIGINT', async () => {
    console.log('\n👋 Stopping autonomous check system...');
    if (browserInstance) {
      console.log('🔄 Closing browser...');
      await browserInstance.close();
      browserInstance = null;
      pageInstance = null;
    }
    console.log('✅ Cleanup complete. Goodbye!');
    process.exit(0);
  });

  // Start the periodic check
  runPeriodicCheck();
}

// Run the main function
main().catch((error) => {
  console.error('❌ Application error:', error);
  process.exit(1);
});
