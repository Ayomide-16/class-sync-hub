import { createServerEntry } from '../dist/server/index.js';

const server = createServerEntry();

export default async (req, res) => {
  try {
    const response = await server.fetch(req);
    
    // Copy headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    res.status(response.status);
    res.send(await response.text());
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
