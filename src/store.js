// src/store.js
const REMOTE_URL = process.env.REMOTE_STORE_URL; // e.g. https://my-json-store.com/data/chatgpt-session
const API_KEY = process.env.REMOTE_STORE_KEY;    // A secret key to protect your data

export const Store = {
    async load() {
        if (!REMOTE_URL) return null;
        try {
            const res = await fetch(REMOTE_URL, { 
                headers: { 'X-Auth-Key': API_KEY } 
            });
            if (!res.ok) return null;
            const json = await res.json();
            // Handle if the data is nested or direct
            return json.data ? JSON.parse(json.data) : json;
        } catch (e) {
            console.error('[Store] Load failed:', e.message);
            return null;
        }
    },

    async save(data) {
        if (!REMOTE_URL) return;
        try {
            await fetch(REMOTE_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Auth-Key': API_KEY 
                },
                body: JSON.stringify({ data: JSON.stringify(data) })
            });
            console.log('[Store] Session synced to cloud.');
        } catch (e) {
            console.error('[Store] Save failed:', e.message);
        }
    }
};
