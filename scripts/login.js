// scripts/login.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Store } from '../src/store.js';
import readline from 'readline';

puppeteer.use(StealthPlugin());

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

(async () => {
    console.log('--- LOCAL LOGIN TOOL ---');
    console.log('This will open Chrome. Log in to ChatGPT, then press ENTER here.');

    if (!process.env.REMOTE_STORE_URL) {
        console.error('Error: REMOTE_STORE_URL not set in environment.');
        process.exit(1);
    }

    const browser = await puppeteer.launch({ 
        headless: false, // Show browser
        defaultViewport: null 
    });
    
    const page = await browser.newPage();
    await page.goto('https://chatgpt.com/auth/login');

    await new Promise(resolve => rl.question('Press ENTER after you see the chat interface > ', resolve));

    console.log('Saving cookies...');
    const cookies = await page.cookies();
    
    await Store.save({ cookies, updatedAt: Date.now() });
    
    console.log('SUCCESS: Session uploaded to remote store.');
    await browser.close();
    process.exit(0);
})();
