import os, sys
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
backend_dir = os.path.join(root_dir, 'backend')
for p in [root_dir, backend_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)
from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))
from pymongo import MongoClient
from app.core.security import hash_password, verify_password

uri = os.getenv('MONGODB_URI')
client = MongoClient(uri, serverSelectionTimeoutMS=5000)
db = client[os.getenv('DATABASE_NAME', 'crop_disease_db')]

ramesh_hash = hash_password('Ramesh1@1234')
farmer1_hash = hash_password('Farmer1@1234')

# Update Ramesh
res1 = db.users.update_one(
    {'name': 'ramesh'},
    {'$set': {
        'name': 'Ramesh',
        'hashed_password': ramesh_hash,
        'password_hash': ramesh_hash,
        'role': 'equipment_provider',
        'phone': '+91 98765 43210',
        'provider_profile': {
            'business_name': 'Ramesh Agri Equipment & Drone Hub',
            'hub_name': 'Ramesh Farm Services',
            'experience_years': 8,
            'rating': 4.9,
            'phone': '+91 98765 43210'
        }
    }}
)
print('Updated Ramesh:', res1.matched_count, res1.modified_count)

# Update Farmer1 to ensure password and details are clean
res2 = db.users.update_one(
    {'name': {'$in': ['Farmer1', 'farmer1']}},
    {'$set': {
        'name': 'Farmer1',
        'hashed_password': farmer1_hash,
        'password_hash': farmer1_hash,
        'role': 'farmer',
        'phone': '+91 91234 56789'
    }}
)
print('Updated Farmer1:', res2.matched_count, res2.modified_count)

# Verify both accounts
u1 = db.users.find_one({'name': 'Farmer1'})
u2 = db.users.find_one({'name': 'Ramesh'})
print('Farmer1:', u1.get('name'), u1.get('email'), u1.get('role'), u1.get('phone'))
print('Ramesh:', u2.get('name'), u2.get('email'), u2.get('role'), u2.get('phone'))
