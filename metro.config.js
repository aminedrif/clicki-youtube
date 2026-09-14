const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 1. Allow Metro to resolve .wasm files for expo-sqlite web
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

const https = require('https');
const http = require('http');

// 2. Add COEP, COOP headers and proxy download endpoint for web
config.server = config.server || {};
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    if (req.url.startsWith('/api/proxy-download')) {
      try {
        const parsed = new URL(req.url, `http://${req.headers.host || 'localhost:8081'}`);
        const targetUrl = parsed.searchParams.get('url');
        const filename = parsed.searchParams.get('filename') || 'media.mp4';

        if (!targetUrl) {
          res.statusCode = 400;
          res.end('Missing url parameter');
          return;
        }

        const fetchRemote = (streamUrl, redirectCount = 0) => {
          if (redirectCount > 5) {
            res.statusCode = 502;
            res.end('Too many redirects');
            return;
          }

          const client = streamUrl.startsWith('https:') ? https : http;
          const remoteReq = client.get(streamUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': '*/*',
            }
          }, (remoteRes) => {
            if (remoteRes.statusCode >= 300 && remoteRes.statusCode < 400 && remoteRes.headers.location) {
              const redirectUrl = new URL(remoteRes.headers.location, streamUrl).href;
              fetchRemote(redirectUrl, redirectCount + 1);
              return;
            }

            res.writeHead(remoteRes.statusCode || 200, {
              'Content-Type': remoteRes.headers['content-type'] || 'video/mp4',
              'Content-Length': remoteRes.headers['content-length'] || '',
              'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': '*',
              'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition',
            });

            remoteRes.pipe(res);
          });

          remoteReq.on('error', (err) => {
            if (!res.headersSent) {
              res.statusCode = 502;
              res.end(err.message);
            }
          });
        };

        fetchRemote(targetUrl);
        return;
      } catch (err) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(err.message);
        }
        return;
      }
    }

    return middleware(req, res, next);
  };
};

module.exports = config;
