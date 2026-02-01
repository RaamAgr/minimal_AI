import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Store } from './store.js';

puppeteer.use(StealthPlugin());

let browser = null;
let page = null;
let requestCount = 0;

// --- SMART CACHING SYSTEM ---
let cachedSession = null; 
let lastCloudUpdate = 0;
const CLOUD_UPDATE_INTERVAL = 6 * 60 * 60 * 1000; // 6 Hours

const MAX_REQUESTS = 20;
const TIMEOUT_MS = 60000; 
const MAX_RETRIES = 5;
const CHATGPT_URL = 'https://chatgpt.com/?temporary-chat=true'; 
const isMac = process.platform === 'darwin';

export const Browser = {
    isReady: () => !!page && !page.isClosed(),

    async init() {
        if (browser) await Browser.close();

        console.log(`[Browser] Launching in ${isMac ? 'MAC (Ghost)' : 'SERVER'} mode...`);
        
        const launchOptions = {
            headless: true, // Ghost Mode
            defaultViewport: { width: 1280, height: 800 },
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        };

        if (isMac) {
            launchOptions.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        } else {
            launchOptions.args.push('--single-process', '--no-zygote', '--disable-gpu');
        }

        browser = await puppeteer.launch(launchOptions);
        page = await browser.newPage();

        // 1. SMART LOAD: Only hit Cloud if RAM is empty
        if (!cachedSession) {
            console.log('[Browser] Fetching session from Cloud...');
            cachedSession = await Store.load();
            lastCloudUpdate = Date.now(); // Reset timer on load
        } else {
            console.log('[Browser] Using Cached Session (RAM).');
        }

        // 2. Apply Identity
        if (cachedSession) {
            if (cachedSession.userAgent) await page.setUserAgent(cachedSession.userAgent);
            
            if (cachedSession.cookies) {
                console.log(`[Browser] Restoring ${cachedSession.cookies.length} cookies...`);
                await page.setCookie(...cachedSession.cookies);
            }
        }

        // 3. Navigate
        console.log('[Browser] Initializing ChatGPT...');
        try {
            await page.goto(CHATGPT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        } catch (e) {
            console.log('[Browser] Navigation timeout (continuing)...');
        }

        // 4. Inject Storage
        if (cachedSession && cachedSession.localStorage) {
            console.log('[Browser] Injecting LocalStorage...');
            await page.evaluate((data) => {
                const ls = JSON.parse(data);
                localStorage.clear();
                for (const key in ls) localStorage.setItem(key, ls[key]);
            }, cachedSession.localStorage);
            await page.reload({ waitUntil: 'domcontentloaded' });
        }
    },

    async ask(prompt) {
        requestCount++;
        if (requestCount > MAX_REQUESTS) {
            requestCount = 0;
            await Browser.init();
        }

        if (!page || page.isClosed()) await Browser.init();

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[Browser] Request Attempt ${attempt}/${MAX_RETRIES}...`);

                // Force Refresh (Clean State)
                await page.goto(CHATGPT_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

                const performAsk = async () => {
                    const inputSelector = '#prompt-textarea';
                    try {
                        await page.waitForSelector(inputSelector, { timeout: 20000 });
                    } catch(e) {
                        throw new Error("Input box not found (Possible Login Issue)");
                    }
                    
                    await new Promise(r => setTimeout(r, 1500));
                    
                    await page.focus(inputSelector);
                    await page.keyboard.type(prompt, { delay: 10 });
                    await page.keyboard.press('Enter');

                    return await waitForStability();
                };

                return await Promise.race([
                    performAsk(),
                    new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT')), TIMEOUT_MS))
                ]);

            } catch (err) {
                console.error(`[Browser] Error: ${err.message}`);
                if (attempt === MAX_RETRIES) throw err;
                await Browser.init();
            }
        }
    },

    async close() {
        if (browser) await browser.close();
        browser = null; page = null;
    }
};

// --- HELPER FUNCTIONS ---

async function waitForStability() {
    const bubbleSelector = 'div[data-message-author-role="assistant"]';
    await page.waitForSelector(bubbleSelector, { timeout: 15000 });
    
    let lastText = '';
    let stableCount = 0;

    for (let i = 0; i < 200; i++) {
        const currentText = await page.evaluate((sel) => {
            const els = document.querySelectorAll(sel);
            return els.length ? els[els.length - 1].innerText : '';
        }, bubbleSelector);

        if (currentText && currentText === lastText && !currentText.includes('Thinking')) {
            stableCount++;
            if (stableCount > 4) {
                // SMART SAVE TRIGGER
                checkAndSaveSession();
                return currentText;
            }
        } else {
            stableCount = 0;
        }
        
        lastText = currentText;
        await new Promise(r => setTimeout(r, 500));
    }
    return lastText;
}

// --- INTELLIGENT SAVER ---
async function checkAndSaveSession() {
    const now = Date.now();
    const timeSinceLastSave = now - lastCloudUpdate;

    // Only save if 6 hours (in ms) have passed
    if (timeSinceLastSave > CLOUD_UPDATE_INTERVAL) {
        console.log(`[Browser] 6 Hours passed. Syncing fresh session to Cloud...`);
        try {
            const cookies = await page.cookies();
            
            // Update RAM Cache first
            if (cachedSession) {
                cachedSession.cookies = cookies;
                cachedSession.updatedAt = now;
            }

            // Upload to Cloud
            await Store.save(cachedSession);
            lastCloudUpdate = now; // Reset timer
            console.log('[Browser] Cloud Sync Complete.');
        } catch (e) {
            console.error('[Browser] Background Sync Failed (Will retry next request).');
        }
    }
}