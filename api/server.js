import * as serverModule from '../dist/server/index.js';

// TanStack Start/Vinxi can export the server entry in different ways depending on the target.
// We try the default export first, then createServerEntry.
const server = serverModule.default || 
  (typeof serverModule.createServerEntry === 'function' ? serverModule.createServerEntry() : serverModule.createServerEntry);

export default async (req, res) => {
  try {
    if (!server || typeof server.fetch !== 'function') {
      console.error('Server module exports:', Object.keys(serverModule));
      throw new Error('Could not find a valid server entry with a fetch method.');
    }

    // Construct the full URL for the Web Request
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['host'];
    const url = new URL(req.url, `${protocol}://${host}`);
    
    // Convert Node.js request to Web Request
    const request = new Request(url.href, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
      duplex: 'half'
    });

    // Cloudflare-style worker entries expect (request, env, context)
    // We pass process.env as the 'env' object to satisfy dependencies on env variables
    const response = await server.fetch(request, process.env, {
      waitUntil: () => {},
      passThroughOnException: () => {}
    });
    
    // Copy response headers
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    });
    
    res.status(response.status);
    
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack,
      hint: 'Check if all environment variables are set in Vercel Dashboard'
    });
  }
};
