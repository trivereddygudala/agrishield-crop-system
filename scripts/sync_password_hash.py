import bcrypt
from pymongo import MongoClient

atlas_uri = 'mongodb+srv://trivereddygudala_db_user:65lzhEkdcOgMITc5@agrishield-db.cn2tf7s.mongodb.net/?appName=agrishield-db'
client = MongoClient(atlas_uri)
db = client['agrishield_db']

def hash_pw(pw):
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

admin_hash = hash_pw('admin123')
farmer_hash = hash_pw('farmer123')

# Update admin users
res1 = db.users.update_many(
    {'$or': [{'email': 'admin@agrishield.ai'}, {'email': 'admin@agrishield.com'}, {'role': 'admin'}]},
    {'$set': {
        'password_hash': admin_hash,
        'hashed_password': admin_hash,
        'password': admin_hash,
        'login_attempts': 0,
        'locked_until': None
    }}
)

# Update farmer users
res2 = db.users.update_many(
    {'$or': [{'email': 'farmer1@agrishield.com'}, {'email': 'ramaya@agrishield.com'}, {'role': 'farmer'}]},
    {'$set': {
        'password_hash': farmer_hash,
        'hashed_password': farmer_hash,
        'password': farmer_hash,
        'login_attempts': 0,
        'locked_until': None
    }}
)

print(f"Updated {res1.modified_count} admin accounts and {res2.modified_count} farmer accounts.")
print("\nVerified Users in Atlas:")
for u in db.users.find({}, {'email': 1, 'role': 1, 'password_hash': 1}):
    print("  👤", u.get('email'), "| Role:", u.get('role'), "| Has password_hash:", bool(u.get('password_hash')))
