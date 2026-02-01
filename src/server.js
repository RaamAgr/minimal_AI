// src/server.js
import express from 'express';
import { Browser } from './browser.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// --- CRITICAL FIX: PREVENT SILENT CRASHES ---
process.on('uncaughtException', (err) => {
    console.error('[SERVER ERROR] Caught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[SERVER ERROR] Unhandled Rejection:', reason);
});
// ---------------------------------------------

// AUTH MIDDLEWARE REMOVED - The API is now public.

/**
 * Refresh Endpoint
 * PUBLIC: No x-api-key required.
 */
app.all('/refresh', async (req, res) => {
    console.log(`[API] Public refresh requested via ${req.method}`);
    
    try {
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

/**
 * Ask Endpoint
 * PUBLIC: No x-api-key required.
 */
app.post('/ask', async (req, res) => {
    console.log('[API] Public Ask request received');
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
    
    Browser.init().catch(e => console.error('[Browser] Startup Error:', e.message));
});