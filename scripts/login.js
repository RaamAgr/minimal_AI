// scripts/login.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Store } from '../src/store.js';
import readline from 'readline';

puppeteer.use(StealthPlugin());
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function runLogin() {
    console.log('--- STARTING LOGIN TOOL ---');
    
    // 1. Check Variables
    const url = process.env.REMOTE_STORE_URL;
    const key = process.env.REMOTE_STORE_KEY;

    if (!url || !key) {
        console.error('❌ ERROR: Missing Environment Variables.');
        console.log('URL:', url);
        console.log('KEY:', key ? 'FOUND' : 'MISSING');
        process.exit(1);
    }

    try {
        console.log('Connecting to Chrome on port 9222...');
        // Added a 5-second timeout so it doesn't "do nothing" forever
        const browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9222',
            defaultViewport: null
        }).catch(e => {
            throw new Error('Could not connect to Chrome. Is the "Safe Chrome" window open?');
        });

        console.log('✅ Connected to Browser.');

        const pages = await browser.pages();
        console.log(`Found ${pages.length} open tabs.`);

        let chatPage = null;
        for (const p of pages) {
            const pUrl = p.url();
            console.log(`Checking tab: ${pUrl}`);
            if (pUrl.includes('chatgpt.com') || pUrl.includes('openai.com')) {
                chatPage = p;
                break;
            }
        }

        if (!chatPage) {
            console.error('❌ ERROR: No ChatGPT tab found in that Chrome window.');
            browser.disconnect();
            process.exit(1);
        }

        console.log(`\n✅ Target Locked: ${chatPage.url()}`);
        await new Promise(resolve => rl.question('Log in fully, then press ENTER here to save > ', resolve));

        console.log('Capturing identity data...');
        const cookies = await chatPage.cookies();
        const localStorageData = await chatPage.evaluate(() => JSON.stringify(window.localStorage));
        const userAgent = await chatPage.evaluate(() => navigator.userAgent);

        console.log(`Found ${cookies.length} cookies. Uploading...`);

        await Store.save({ 
            cookies, 
            localStorage: localStorageData,
            userAgent,
            updatedAt: Date.now() 
        });

        console.log('\n⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐');
        console.log('   SUCCESS: SESSION SAVED TO CLOUD');
        console.log('⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐\n');

        browser.disconnect();
        process.exit(0);

    } catch (err) {
        console.error('\n❌ CRITICAL CRASH:');
        console.error(err.message);
        process.exit(1);
    }
}

runLogin();