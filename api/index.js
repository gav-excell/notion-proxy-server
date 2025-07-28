const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Note: The paths are now relative to the /api route
app.post('/api/get-databases', async (req, res) => {
    const { notionToken } = req.body;
    if (!notionToken) {
        return res.status(400).json({ error: 'Notion token is required.' });
    }
    try {
        const notion = new Client({ auth: notionToken });
        const response = await notion.search({ filter: { value: 'database', property: 'object' } });
        const databases = response.results.map(db => ({
            id: db.id,
            title: db.title[0]?.plain_text || 'Untitled Database',
        }));
        res.json(databases);
    } catch (error) {
        console.error('Error fetching databases:', error.body);
        res.status(500).json({ error: 'Failed to fetch databases from Notion.' });
    }
});

app.post('/api/get-posts', async (req, res) => {
    const { notionToken, databaseId } = req.body;
    if (!notionToken || !databaseId) {
        return res.status(400).json({ error: 'Notion token and Database ID are required.' });
    }
    const notion = new Client({ auth: notionToken });
    try {
        const response = await notion.databases.query({
            database_id: databaseId,
            sorts: [{ property: 'Scheduled Date', direction: 'ascending' }],
        });
        const posts = response.results.map(page => {
            const properties = page.properties;
            const getProp = (name, type, subType = 'plain_text') => {
                 if (!properties[name]) return null;
                 if (type === 'title' || type === 'rich_text') return properties[name][type][0]?.[subType] || '';
                 if (type === 'url') return properties[name].url;
                 if (type === 'date') return properties[name].date?.start;
                 return null;
            }
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
        res.status(500).json({ error: 'Failed to fetch posts from Notion.' });
    }
});

module.exports = app;
