const https = require('https');

function makeJiraClient(cfg) {
  const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString('base64');

  function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, cfg.baseUrl);
      const options = {
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(url, options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(body ? JSON.parse(body) : {});
            } catch {
              resolve(body);
            }
            return;
          }
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        });
      });

      req.on('error', reject);
      if (data != null) req.write(JSON.stringify(data));
      req.end();
    });
  }

  return { request };
}

module.exports = { makeJiraClient };


