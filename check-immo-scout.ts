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
    `data/seenListings.${INSTANCE_NAME}.json`
  );
  const DEBUG_LOG_FILE = path.resolve(
    __dirname,
    `data/debug.${INSTANCE_NAME}.log`
  );
  const MAX_SEEN_IDS = 100;
  const REMOVE_COUNT = 70;

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

  async function getBrowser(): Promise<Browser> {
    if (!browserInstance) {
      console.log('🚀 Launching new browser instance...');
      browserInstance = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--window-size=1920,1080',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--lang=en-US,en',
        ],
      });
    }
    return browserInstance;
  }

  async function initializePage() {
    if (!pageInstance) {
      const browser = await getBrowser();
      pageInstance = await browser.newPage();

      // Set a realistic user agent
      await pageInstance.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      });

      // Set a realistic viewport
      await pageInstance.setViewportSize({ width: 1920, height: 1080 });

      // Add random mouse movements to appear more human-like
      await pageInstance.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      });
    }
    return pageInstance;
  }

  // Debug logging function
  function logDebug(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${INSTANCE_NAME}] ${message}\n`;
    fs.appendFileSync(DEBUG_LOG_FILE, logMessage);
    console.log(`[${INSTANCE_NAME}] ${message}`);
  }

  function loadSeenListings(): Map<string, any> {
    if (!fs.existsSync(SEEN_FILE)) {
      logDebug('📁 No seen listings file found, starting fresh');
      return new Map();
    }
    try {
      const data = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf-8'));
      logDebug(
        `📁 Loaded ${
          Object.keys(data).length
        } listings from seenListings.${INSTANCE_NAME}.json`
      );
      return new Map(Object.entries(data));
    } catch (error) {
      logDebug(`❌ Error loading seen listings: ${error}`);
      return new Map();
    }
  }

  function saveSeenListings(listings: Map<string, any>) {
    try {
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
      fs.writeFileSync(SEEN_FILE, JSON.stringify(listingsToSave, null, 2));

      logDebug(
        `\n✅ Saved ${keptListings.length} listings to seenListings.${INSTANCE_NAME}.json`
      );
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
      const stats = fs.statSync(SEEN_FILE);
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

  // Function to check for CAPTCHA
  async function isCaptchaPresent(page: any): Promise<boolean> {
    try {
      // Check for common CAPTCHA elements
      const captchaSelectors = [
        'iframe[src*="captcha"]',
        'iframe[src*="recaptcha"]',
        'div[class*="captcha"]',
        'div[class*="recaptcha"]',
        'form[action*="captcha"]',
        'form[action*="recaptcha"]',
      ];

      for (const selector of captchaSelectors) {
        const element = await page.$(selector);
        if (element) {
          logDebug('⚠️ CAPTCHA detected on the page');
          return true;
        }
      }

      // Check for CAPTCHA-related text
      const pageContent = await page.content();
      const captchaKeywords = [
        'captcha',
        'recaptcha',
        'verify you are human',
        'robot check',
      ];
      if (
        captchaKeywords.some((keyword) =>
          pageContent.toLowerCase().includes(keyword)
        )
      ) {
        logDebug('⚠️ CAPTCHA-related text detected on the page');
        return true;
      }

      return false;
    } catch (error) {
      logDebug(`❌ Error checking for CAPTCHA: ${error}`);
      return false;
    }
  }

  // Function to handle CAPTCHA situation
  async function handleCaptcha(page: any): Promise<boolean> {
    logDebug('🔄 Handling CAPTCHA situation...');

    // Take a screenshot for debugging
    const screenshotPath = path.join(__dirname, 'captcha-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    logDebug(`📸 Captured CAPTCHA screenshot at: ${screenshotPath}`);

    // Send notification about CAPTCHA
    await sendTelegramMessage(
      '⚠️ CAPTCHA detected! Please check the screenshot and handle it manually.'
    );

    // Close the current page and browser instance
    if (pageInstance) {
      await pageInstance.close();
      pageInstance = null;
    }
    if (browserInstance) {
      await browserInstance.close();
      browserInstance = null;
    }

    return false;
  }

  // Modify the checkFilteredPage function to include CAPTCHA handling
  async function checkFilteredPage() {
    let retryCount = 0;
    const page = await initializePage();

    while (retryCount < MAX_RETRIES) {
      try {
        console.log('\n==========================================');
        console.log(
          `🔄 STARTING NEW CHECK CYCLE ${retryCount + 1}/${MAX_RETRIES}`
        );
        console.log('==========================================');

        // Force a fresh page load
        console.log('\n==========================================');
        console.log('🔄 REFRESHING PAGE');
        console.log('==========================================');

        await page.goto(FILTER_URL, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });

        // Check for CAPTCHA
        if (await isCaptchaPresent(page)) {
          const handled = await handleCaptcha(page);
          if (!handled) {
            retryCount++;
            if (retryCount === MAX_RETRIES) {
              throw new Error('Max retries reached after CAPTCHA detection');
            }
            console.log(
              `🔄 Retrying after CAPTCHA... (${retryCount}/${MAX_RETRIES})`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, INITIAL_RETRY_DELAY * Math.pow(2, retryCount))
            );
            continue;
          }
        }

        console.log('==========================================');
        console.log('✅ PAGE REFRESHED');
        console.log('==========================================\n');

        // Wait for the page to fully load
        await page.waitForLoadState('networkidle');
        await randomDelay(2000, 4000);

        // Perform human-like scrolling
        await humanLikeScroll(page);
        await randomDelay(1000, 2000);

        // Get all listing elements
        const listings = await page.$$('[data-testid="result-list-item"]');
        console.log(`📊 Found ${listings.length} listings on the page`);

        // Load seen listings
        const seen = loadSeenListings();
        const newListings: string[] = [];

        console.log(`📚 Loaded ${seen.size} seen listings from JSON`);
        console.log('🔍 Checking for new listings...');

        // Process each listing
        for (const listing of listings) {
          try {
            const id = await listing.getAttribute('data-id');
            if (!id) continue;

            if (!seen.has(id)) {
              const title = await listing.$eval(
                '[data-testid="result-list-item-title"]',
                (el: Element) => el.textContent?.trim() || ''
              );
              const price = await listing.$eval(
                '[data-testid="result-list-item-price"]',
                (el: Element) => el.textContent?.trim() || ''
              );
              const location = await listing.$eval(
                '[data-testid="result-list-item-location"]',
                (el: Element) => el.textContent?.trim() || ''
              );
              const url = await listing.$eval(
                'a',
                (el: HTMLAnchorElement) => el.href
              );

              const message = `
🏠 New Listing Found!
📌 Title: ${title}
💰 Price: ${price}
📍 Location: ${location}
🔗 URL: ${url}
              `;

              await sendTelegramMessage(message);
              newListings.push(id);
              seen.set(id, { timestamp: new Date().toISOString(), url });
            }
          } catch (error) {
            console.error('❌ Error processing listing:', error);
          }
        }

        // Save updated seen listings
        saveSeenListings(seen);

        console.log(
          `\n✅ Check completed. Found ${newListings.length} new listings.`
        );
        return true;
      } catch (error) {
        console.error('❌ Error during page check:', error);
        retryCount++;
        if (retryCount === MAX_RETRIES) {
          throw error;
        }
        console.log(`🔄 Retrying... (${retryCount}/${MAX_RETRIES})`);
        await new Promise((resolve) =>
          setTimeout(resolve, INITIAL_RETRY_DELAY * Math.pow(2, retryCount))
        );
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
