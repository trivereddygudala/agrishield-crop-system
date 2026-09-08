import bcrypt
from pymongo import MongoClient

atlas_uri = 'mongodb+srv://trivereddygudala_db_user:65lzhEkdcOgMITc5@agrishield-db.cn2tf7s.mongodb.net/?appName=agrishield-db'
client = MongoClient(atlas_uri)
db = client['agrishield_db']

def hash_pw(pw):
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# Set clean easy password for admin: admin123
simple_admin_hash = hash_pw('admin123')
db.users.update_one(
    {'email': 'admin@agrishield.ai'},
    {'$set': {
        'password': simple_admin_hash,
        'hashed_password': simple_admin_hash,
        'login_attempts': 0,
        'locked_until': None,
        'username': 'admin'
    }}
)

# Also create an admin@agrishield.com alias
db.users.update_one(
    {'email': 'admin@agrishield.com'},
    {'$set': {
        'email': 'admin@agrishield.com',
        'username': 'admin2',
        'full_name': 'Admin User',
        'role': 'admin',
        'password': simple_admin_hash,
        'hashed_password': simple_admin_hash,
        'login_attempts': 0,
        'locked_until': None
    }},
    upsert=True
)

# Set clean easy password for farmer: farmer123
simple_farmer_hash = hash_pw('farmer123')
db.users.update_one(
    {'email': 'farmer1@agrishield.com'},
    {'$set': {
        'password': simple_farmer_hash,
        'hashed_password': simple_farmer_hash,
        'login_attempts': 0,
        'locked_until': None,
        'username': 'farmer'
    }}
)

print("✅ Passwords set to simple lowercase: 'admin123' and 'farmer123'")
