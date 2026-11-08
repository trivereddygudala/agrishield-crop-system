const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE_DIR = path.join(os.tmpdir(), "temp_chrome_profile_" + Date.now());

async function main() {
    console.log("[*] Launching headless Chrome with isolated profile...");
    const chrome = spawn(CHROME_PATH, [
        '--headless=new',
        '--remote-debugging-port=9223',
        `--user-data-dir=${PROFILE_DIR}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        'http://127.0.0.1:3000/'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    http.get('http://127.0.0.1:9223/json', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const tabs = JSON.parse(data);
                const appTab = tabs.find(t => t.url && t.url.includes('3000')) || tabs[0];
                console.log("[*] Target tab:", appTab.title, appTab.url);
                
                if (appTab && appTab.webSocketDebuggerUrl) {
                    const ws = new globalThis.WebSocket(appTab.webSocketDebuggerUrl);
                    ws.onopen = () => {
                        ws.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
                        ws.send(JSON.stringify({ id: 2, method: "Log.enable" }));
                        ws.send(JSON.stringify({ id: 3, method: "Console.enable" }));
                        ws.send(JSON.stringify({ id: 4, method: "Page.enable" }));
                    };
                    ws.onmessage = (event) => {
                        const evt = JSON.parse(event.data);
                        if (evt.method === 'Runtime.exceptionThrown') {
                            console.error("\n[🚨 JAVASCRIPT RUNTIME EXCEPTION CAUGHT!]:");
                            const details = evt.params.exceptionDetails;
                            console.error("Message:", details.text);
                            console.error("Exception:", details.exception ? details.exception.description : "None");
                            if (details.stackTrace) {
                                console.error("Stack trace:\n", details.stackTrace.callFrames.map(f => `  at ${f.functionName || '(anonymous)'} (${f.url}:${f.lineNumber}:${f.columnNumber})`).join('\n'));
                            }
                        }
                        if (evt.method === 'Runtime.consoleAPICalled') {
                            console.log(`[CONSOLE ${evt.params.type.toUpperCase()}]:`, evt.params.args.map(a => a.value || a.description).join(' '));
                        }
                    };
                    setTimeout(() => {
                        chrome.kill();
                        try { fs.rmSync(PROFILE_DIR, { recursive: true, force: true }); } catch (_) {}
                        process.exit(0);
                    }, 5000);
                }
            } catch (e) {
                console.error("Error parsing tabs:", e);
                chrome.kill();
                process.exit(1);
            }
        });
    }).on('error', err => {
        console.error("HTTP error to CDP:", err);
        chrome.kill();
        process.exit(1);
    });
}

main();
