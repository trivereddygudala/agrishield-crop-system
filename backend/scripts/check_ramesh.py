import os, sys
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
backend_dir = os.path.join(root_dir, 'backend')
for p in [root_dir, backend_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)
from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))
from pymongo import MongoClient
from app.core.security import verify_password

uri = os.getenv('MONGODB_URI')
client = MongoClient(uri, serverSelectionTimeoutMS=5000)

for dbname in ['crop_disease_db', 'crop_disease_system']:
    db = client[dbname]
    for coll in ['users']:
        if coll in db.list_collection_names():
            u = db[coll].find_one({'name': {'$regex': 'ramesh', '$options': 'i'}})
            if u:
                h = u.get('password_hash') or u.get('hashed_password')
                print(f'{dbname}.{coll}: found ramesh! name={u.get("name")}, email={u.get("email")}, role={u.get("role")}, verify={verify_password("Ramesh1@1234", h)}')
            else:
                print(f'{dbname}.{coll}: ramesh not found')
