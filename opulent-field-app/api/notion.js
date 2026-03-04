// api/notion.js - Vercel serverless function
// Place this file at: opulent-field-app/api/notion.js

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
    if (req.method === 'OPTIONS') return res.status(200).end();
  
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const { endpoint } = req.query;
  
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
  
    const notionUrl = `https://api.notion.com/v1/${endpoint}`;
  
    try {
      const response = await fetch(notionUrl, {
        method: req.method,
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      });
  
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }