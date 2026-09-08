const { spawn } = require('child_process');
const http = require('http');

const PORT = 3000;

console.log('\x1b[35m[TUNNEL]\x1b[0m Starting tunnel service on port ' + PORT + ' (no fallback)...');

// Spawn ngrok directly without cascading fallbacks
const ngrok = spawn('npx', ['ngrok', 'http', PORT.toString()], { shell: true });

// Check Ngrok local API for the public URL
const checkInterval = setInterval(() => {
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                const publicTunnel = json.tunnels.find(t => t.proto === 'https');
                if (publicTunnel) {
                    clearInterval(checkInterval);
                    console.log('');
                    console.log('\x1b[32m╔════════════════════════════════════════════════════════╗\x1b[0m');
                    console.log('\x1b[32m║          ⚡  AGRISHIELD NGROK TUNNEL ONLINE            ║\x1b[0m');
                    console.log('\x1b[32m╚════════════════════════════════════════════════════════╝\x1b[0m');
                    console.log(`\x1b[32m  🔗 Public URL : ${publicTunnel.public_url}\x1b[0m`);
                    console.log(`\x1b[36m  💻 Local URL  : http://localhost:${PORT}\x1b[0m`);
                    console.log('\x1b[32m══════════════════════════════════════════════════════════\x1b[0m');
                    console.log('');
                }
            } catch (e) {}
        });
    }).on('error', () => {
        // Ngrok starting up
    });
}, 1000);

setTimeout(() => {
    clearInterval(checkInterval);
}, 15000);

ngrok.stdout?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`\x1b[35m[TUNNEL]\x1b[0m ${msg}`);
});

ngrok.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`\x1b[33m[TUNNEL]\x1b[0m ${msg}`);
});

ngrok.on('error', (err) => {
    console.error(`\x1b[31m[TUNNEL] Ngrok encountered error: ${err.message}\x1b[0m`);
});

ngrok.on('close', (code) => {
    console.log(`\x1b[33m[TUNNEL] Ngrok closed (code ${code}).\x1b[0m`);
});
