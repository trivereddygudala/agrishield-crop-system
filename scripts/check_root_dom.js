const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE_DIR = path.join(os.tmpdir(), "temp_chrome_profile_" + Date.now());

const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9224',
    `--user-data-dir=${PROFILE_DIR}`,
    '--disable-gpu',
    'http://127.0.0.1:3000/'
]);

setTimeout(() => {
    http.get('http://127.0.0.1:9224/json', (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            const tabs = JSON.parse(data);
            const appTab = tabs.find(t => t.url && t.url.includes('3000')) || tabs[0];
            const ws = new globalThis.WebSocket(appTab.webSocketDebuggerUrl);
            ws.onopen = () => {
                ws.send(JSON.stringify({ 
                    id: 1, 
                    method: 'Runtime.evaluate', 
                    params: { expression: 'document.getElementById("root").innerHTML' } 
                }));
            };
            ws.onmessage = (event) => {
                const evt = JSON.parse(event.data);
                if (evt.id === 1) {
                    const html = (evt.result && evt.result.result && evt.result.result.value) || '';
                    console.log('Root HTML length:', html.length);
                    console.log('Root HTML preview:', html.slice(0, 300));
                    chrome.kill();
                    try { fs.rmSync(PROFILE_DIR, { recursive: true, force: true }); } catch (_) {}
                    process.exit(0);
                }
            };
        });
    });
}, 3000);

