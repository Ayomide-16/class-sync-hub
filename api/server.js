import { createServerEntry } from '../dist/server/index.js';

const server = createServerEntry();

export default async (req, res) => {
  try {
    // Construct the full URL for the Web Request
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['host'];
    const url = new URL(req.url, `${protocol}://${host}`);
    
    // Convert Node.js request to Web Request
    const request = new Request(url.href, {
      method: req.method,
      headers: req.headers,
      // Pass the body for non-GET requests
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
      // duplex is required when passing a stream as body in some environments
      duplex: 'half'
    });

    const response = await server.fetch(request);
    
    // Copy response headers to Node.js response
    response.headers.forEach((value, key) => {
      // Avoid setting content-encoding as Vercel handles compression
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    });
    
    res.status(response.status);
    
    // Send the response body as a buffer to handle both text and binary data
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));

  } catch (error) {
    console.error('Server error:', error);
    // Provide more detail in the error response for debugging
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack
    });
  }
};
