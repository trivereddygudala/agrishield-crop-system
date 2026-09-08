import bcrypt
from pymongo import MongoClient

atlas_uri = 'mongodb+srv://trivereddygudala_db_user:65lzhEkdcOgMITc5@agrishield-db.cn2tf7s.mongodb.net/?appName=agrishield-db'
client = MongoClient(atlas_uri)
db = client['agrishield_db']

def hash_pw(pw):
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

admin_hash = hash_pw('Admin@123')
farmer_hash = hash_pw('Farmer@123')

res1 = db.users.update_one(
    {'email': 'admin@agrishield.ai'},
    {'$set': {'password': admin_hash, 'hashed_password': admin_hash, 'login_attempts': 0, 'locked_until': None}}
)

res2 = db.users.update_one(
    {'email': 'farmer1@agrishield.com'},
    {'$set': {'password': farmer_hash, 'hashed_password': farmer_hash, 'login_attempts': 0, 'locked_until': None}}
)

print(f"Admin account updated ({res1.matched_count} found, {res1.modified_count} updated) -> Password: Admin@123")
print(f"Farmer account updated ({res2.matched_count} found, {res2.modified_count} updated) -> Password: Farmer@123")
