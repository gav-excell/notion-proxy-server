const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // Allow requests from any origin

// --- Root Endpoint ---
// A simple GET request handler to confirm the server is running.
app.get('/', (req, res) => {
    res.status(200).send('Notion API Proxy is running. Ready to receive POST requests.');
});

// --- API ENDPOINT 1: List Databases ---
// Fetches the list of databases a token has access to.
app.post('/api/get-databases', async (req, res) => {
    const { notionToken } = req.body;

    if (!notionToken) {
        return res.status(400).json({ error: 'Notion token is required.' });
    }

    try {
        const notion = new Client({ auth: notionToken });
        const response = await notion.search({
            filter: {
                value: 'database',
                property: 'object',
            },
        });

        const databases = response.results.map(db => ({
            id: db.id,
            title: db.title[0]?.plain_text || 'Untitled Database',
        }));

        res.json(databases);
    } catch (error) {
        console.error('Error fetching databases:', error.body);
        res.status(500).json({ error: 'Failed to fetch databases from Notion. Check your token and permissions.' });
    }
});

// --- API ENDPOINT 2: Get Posts from a Database ---
// Fetches all pages from a specific database.
app.post('/api/get-posts', async (req, res) => {
    const { notionToken, databaseId } = req.body;

    if (!notionToken || !databaseId) {
        return res.status(400).json({ error: 'Notion token and Database ID are required.' });
    }

    const notion = new Client({ auth: notionToken });

    try {
        const response = await notion.databases.query({
            database_id: databaseId,
            // Optional: Add a sort if you have an 'Order' or 'Date' property
            sorts: [
                {
                    property: 'Scheduled Date', // The name of your Date property
                    direction: 'ascending',
                },
            ],
        });

        // Map Notion's complex object to a simple one for our widget
        const posts = response.results.map(page => {
            const properties = page.properties;
            // Helper to safely get property values
            const getProp = (name, type, subType = 'plain_text') => {
                 if (!properties[name]) return null;
                 if (type === 'title' || type === 'rich_text') return properties[name][type][0]?.[subType] || '';
                 if (type === 'url') return properties[name].url;
                 if (type === 'date') return properties[name].date?.start;
                 return null;
            }

            // IMPORTANT: Your Notion database MUST have these property names.
            return {
                id: page.id,
                headline: getProp('Headline', 'title'),
                media: (getProp('Media', 'url') || '').split(',').map(u => u.trim()).filter(Boolean),
                caption: getProp('Caption', 'rich_text'),
                date: getProp('Scheduled Date', 'date'),
            };
        });

        res.json(posts);

    } catch (error) {
        console.error('Error fetching posts:', error.body);
        res.status(500).json({ error: 'Failed to fetch posts from Notion. Check database ID and ensure integration has access.' });
    }
});


// --- API ENDPOINT 3: Update Post Date ---
// Updates the date of a specific post (page) in Notion.
app.post('/api/update-post-date', async (req, res) => {
    const { notionToken, pageId, newDate } = req.body;

    if (!notionToken || !pageId || !newDate) {
        return res.status(400).json({ error: 'Token, Page ID, and new date are required.' });
    }

    const notion = new Client({ auth: notionToken });

    try {
        await notion.pages.update({
            page_id: pageId,
            properties: {
                // The key here MUST match the name of your date property in Notion
                'Scheduled Date': {
                    date: {
                        start: newDate,
                    },
                },
            },
        });
        res.json({ success: true, message: `Post ${pageId} updated to ${newDate}` });
    } catch (error) {
        console.error('Error updating post date:', error.body);
        res.status(500).json({ error: 'Failed to update post date in Notion.' });
    }
});


// Start the server
const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your Notion proxy server is listening on port ' + listener.address().port);
});

// --- package.json ---
// You will also need a package.json file to tell your server environment which libraries to install.
/*
{
  "name": "notion-proxy",
  "version": "1.0.0",
  "description": "A secure proxy for a Notion widget.",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@notionhq/client": "^2.2.13",
    "cors": "^2.8.5",
    "express": "^4.18.2"
  },
  "engines": {
    "node": "16.x"
  }
}
*/
