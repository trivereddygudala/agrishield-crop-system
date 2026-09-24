import sqlite3
import glob
import os
import json

conv_dir = r"C:\Users\trive\.gemini\antigravity-ide\conversations"
dbs = glob.glob(os.path.join(conv_dir, "*.db"))

print(f"Total DB files found: {len(dbs)}")

for p in sorted(dbs, key=os.path.getmtime, reverse=True)[:10]:
    fname = os.path.basename(p)
    size = os.path.getsize(p)
    try:
        conn = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        print(f"\nDB: {fname} (Size: {size} bytes)")
        print(f"  Tables: {tables}")
        for t in tables:
            cur.execute(f"SELECT count(*) FROM {t}")
            cnt = cur.fetchone()[0]
            print(f"    - Table '{t}': {cnt} rows")
            cur.execute(f"PRAGMA table_info({t})")
            cols = [c[1] for c in cur.fetchall()]
            print(f"      Columns: {cols[:6]}")
        conn.close()
    except Exception as e:
        print(f"DB: {fname} Error: {e}")
