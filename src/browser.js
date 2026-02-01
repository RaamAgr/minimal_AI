// src/browser.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Store } from './store.js';

puppeteer.use(StealthPlugin());

let browser = null;
let page = null;
let requestCount = 0;
const MAX_REQUESTS = 20; // Restart after 20 prompts to clear RAM

const CHATGPT_URL = 'https://chatgpt.com/?temporary-chat=true'; // Force temp chat

export const Browser = {
    // Check if ready
    isReady: () => !!page && !page.isClosed(),

    // Initialize (Start or Restart)
    async init() {
        if (browser) await Browser.close();

        console.log('[Browser] Launching...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox', '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Critical for Docker
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process' // Minimal RAM usage
            ]
        });

        page = await browser.newPage();
        
        // 1. RAM SAVER: Block heavy resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media', 'other'].includes(type)) req.abort();
            else req.continue();
        });

        // 2. Load Session
        const session = await Store.load();
        if (session && session.cookies) {
            console.log(`[Browser] Restoring ${session.cookies.length} cookies...`);
            await page.setCookie(...session.cookies);
        }

        // 3. Go to ChatGPT
        console.log('[Browser] Navigating to ChatGPT...');
        try {
            await page.goto(CHATGPT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        } catch (e) {
            console.error('[Browser] Navigation timeout (continuing anyway)');
        }

        // 4. Verify Login
        const loggedIn = await page.$('#prompt-textarea');
        if (!loggedIn) {
            console.error('[Browser] CRITICAL: Not logged in. Run "npm run login" locally first.');
            throw new Error('Login Required');
        }

        console.log('[Browser] Ready!');
    },

    // Ask Question
    async ask(prompt) {
        requestCount++;
        if (requestCount > MAX_REQUESTS) {
            console.log('[Browser] Maintenance restart...');
            requestCount = 0;
            await Browser.init();
        }

        if (!page) await Browser.init();

        // Type prompt
        const inputSelector = '#prompt-textarea';
        await page.waitForSelector(inputSelector);
        await page.focus(inputSelector);
        await page.keyboard.type(prompt, { delay: 10 }); // Human jitter
        await page.keyboard.press('Enter');

        // Wait for response (Stability check)
        return await waitForStability();
    },

    // Close
    async close() {
        if (browser) await browser.close();
        browser = null;
        page = null;
    }
};

// Helper: Wait until text stops moving
async function waitForStability() {
    const bubbleSelector = 'div[data-message-author-role="assistant"]';
    let lastText = '';
    let stableCount = 0;
    
    // Wait for first bubble
    try { await page.waitForSelector(bubbleSelector, { timeout: 10000 }); } catch (e) { return "Error: No response started."; }

    // Poll every 500ms
    for (let i = 0; i < 200; i++) { // Max 100 seconds
        const currentText = await page.evaluate((sel) => {
            const els = document.querySelectorAll(sel);
            return els.length ? els[els.length - 1].innerText : '';
        }, bubbleSelector);

        if (currentText && currentText === lastText && currentText !== 'Thinking...') {
            stableCount++;
            if (stableCount > 3) { // Stable for 1.5s
                // Save session in background to keep it fresh
                saveSessionInBackground(); 
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

async function saveSessionInBackground() {
    try {
        const cookies = await page.cookies();
        await Store.save({ cookies, updatedAt: Date.now() });
    } catch (e) {}
}
