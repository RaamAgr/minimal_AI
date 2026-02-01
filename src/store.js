// src/store.js
import axios from 'axios';

// FORCE AXIOS TO NOT CRASH ON 404
axios.defaults.validateStatus = function (status) {
    return status < 500; 
};

export const Store = {
    async load() {
        try {
            const url = process.env.REMOTE_STORE_URL;
            const key = process.env.REMOTE_STORE_KEY;

            if (!url || !key) {
                console.error('[Store] Missing Environment Variables!');
                return null;
            }

            console.log('[Store] Fetching session from cloud...');
            const response = await axios.get(url, {
                headers: {
                    'X-Master-Key': key,
                    'X-Bin-Meta': 'false' // <--- CRITICAL FIX: Tells JSONBin to give raw data
                }
            });

            if (response.status !== 200) {
                console.error(`[Store] Fetch failed: ${response.status} - ${response.statusText}`);
                return null;
            }

            // EXTRACT DATA SAFELY
            let data = response.data;
            
            // If JSONBin still wraps it in "record", unwrap it
            if (data && data.record) {
                data = data.record;
            }

            if (!data || !data.cookies) {
                console.error('[Store] Downloaded data is empty or missing cookies.');
                return null;
            }

            console.log(`[Store] Success! Found ${data.cookies.length} cookies.`);
            return data;

        } catch (error) {
            console.error('[Store] Load Error:', error.message);
            return null;
        }
    },

    async save(data) {
        try {
            const url = process.env.REMOTE_STORE_URL;
            const key = process.env.REMOTE_STORE_KEY;

            if (!url || !key) return;

            // JSONBin requires PUT to update existing bin
            await axios.put(url, data, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': key
                }
            });
            console.log('[Store] Session synced to cloud.');
        } catch (error) {
            console.error('[Store] Save Error:', error.message);
        }
    }
};