// src/server.js
import express from 'express';
import { Browser } from './browser.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const AUTH_KEY = process.env.API_SECRET || 'yash123';

// --- CRITICAL FIX: PREVENT SILENT CRASHES ---
process.on('uncaughtException', (err) => {
    console.error('[SERVER ERROR] Caught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[SERVER ERROR] Unhandled Rejection:', reason);
});
// ---------------------------------------------

// Middleware: Security
app.use((req, res, next) => {
    if (req.headers['x-api-key'] !== AUTH_KEY) return res.status(403).json({ error: 'Forbidden' });
    next();
});

/**
 * Refresh Endpoint
 * Supports HEAD for minimalist "ping" refresh and GET for status check
 */
app.all('/refresh', async (req, res) => {
    console.log(`[API] Manual refresh requested via ${req.method}`);
    
    try {
        // Re-run the Browser.init() to force a fresh page load and cookie sync
        await Browser.init();
        
        console.log('[API] Browser refreshed successfully.');

        if (req.method === 'HEAD') {
            return res.status(200).end();
        }

        res.json({ status: 'success', message: 'Browser tab reloaded and session verified.' });
    } catch (error) {
        console.error('[API] Refresh Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Prompt Endpoint
app.post('/ask', async (req, res) => {
    console.log('[API] Ask request received');
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

        const answer = await Browser.ask(prompt);
        res.json({ status: 'success', answer });

    } catch (error) {
        console.error('[API] Ask Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`MobAI Minimal running on port ${PORT}`);
    console.log('Server is active. Starting Browser...');
    
    // Start browser in background
    Browser.init().catch(e => console.error('[Browser] Startup Error:', e.message));
});