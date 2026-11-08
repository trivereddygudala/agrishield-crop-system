import sys

with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

prefix = """import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

"""

if 'sys.stdout.reconfigure' not in content:
    content = prefix + content

content = content.replace(
    'print(f"\\n🌐 [mDNS] Auto-Discovery Broadcasting on IP: {ip} as agrishield-api.local")',
    'print(f"\\n[mDNS] Auto-Discovery Broadcasting on IP: {ip} as agrishield-api.local")'
)
content = content.replace(
    'print(f"\\n⚠️  [WARNING] mDNS Broadcaster skipped: {e}")',
    'print(f"\\n[WARNING] mDNS Broadcaster skipped: {e}")'
)

with open('backend/app/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated backend/app/main.py successfully!")

