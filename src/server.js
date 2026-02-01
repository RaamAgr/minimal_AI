// src/server.js
import express from 'express';
import { Browser } from './browser.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const AUTH_KEY = process.env.API_SECRET || 'changeme';

// Queue Lock (Single Threaded)
let isBusy = false;

// Middleware: Auth & Busy Check
app.use((req, res, next) => {
    if (req.headers['x-api-key'] !== AUTH_KEY) return res.status(403).json({ error: 'Forbidden' });
    if (isBusy) return res.status(429).json({ error: 'Server busy. Try again in 10 seconds.' });
    next();
});

// Warmup on Start
(async () => {
    try {
        await Browser.init();
    } catch (e) {
        console.error('Initial startup failed (Waiting for request to retry):', e.message);
    }
})();

app.post('/ask', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'No prompt' });

    isBusy = true;
    try {
        // Ensure browser is alive
        if (!Browser.isReady()) {
            console.log('Browser was dead. Reviving...');
            await Browser.init();
        }

        const answer = await Browser.ask(prompt);
        res.json({ status: 'success', answer });

    } catch (error) {
        console.error('Processing Error:', error);
        // If critical error, force restart next time
        await Browser.close();
        res.status(500).json({ error: error.message });
    } finally {
        isBusy = false;
    }
});

app.listen(PORT, () => console.log(`MobAI Minimal running on port ${PORT}`));
