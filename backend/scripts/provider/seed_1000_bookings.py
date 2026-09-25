import os, sys
from pymongo import MongoClient, UpdateOne
from datetime import datetime

uri = 'mongodb+srv://trivereddygudala_db_user:65lzhEkdcOgMITc5@agrishield-db.cn2tf7s.mongodb.net/?appName=agrishield-db'
client = MongoClient(uri, serverSelectionTimeoutMS=10000)
db = client['agrishield_db']

machines = [
    {'title': 'Mahindra 575 DI 45HP Tractor', 'cat': 'tractor', 'rate': 800, 'op': 'Rotavator / Secondary Tillage'},
    {'title': 'DJI Agras T40 40L Spray Drone', 'cat': 'drone', 'rate': 650, 'op': 'Pesticide & Foliar Nano Urea Spray'},
    {'title': 'Kubota DC-68G Combine Harvester', 'cat': 'harvester', 'rate': 2200, 'op': 'Paddy Combine Harvesting'},
    {'title': 'John Deere 5050D 50HP Tractor', 'cat': 'tractor', 'rate': 900, 'op': 'Disc Plough / Deep Ploughing'},
    {'title': 'Laser Guided Land Leveler', 'cat': 'tractor', 'rate': 1100, 'op': 'Laser Land Leveling'},
    {'title': 'Portable 8HP Diesel Water Pump', 'cat': 'irrigation', 'rate': 350, 'op': 'High-Volume Field Irrigation'},
    {'title': 'Automatic 9-Row Seed Drill', 'cat': 'tractor', 'rate': 750, 'op': 'Automatic Seed Sowing & Fertilization'},
    {'title': 'Heavy Crop Stubble Mulcher', 'cat': 'tractor', 'rate': 950, 'op': 'Mulcher / Stubble Shredding'}
]
villages = ['Pasupugallu', 'Mundlamuru', 'Chimakurthy', 'Singarayakonda', 'Kandukur', 'Addanki']

ops = []
now_iso = datetime.now().isoformat()
for i in range(1, 1001):
    m = machines[i % len(machines)]
    v = villages[i % len(villages)]
    acres = (i % 8) + 1.5
    total_cost = int(acres * m['rate'])
    b_id = f'BK-TEST-{i:04d}'
    
    b = {
        'id': b_id,
        'bookingId': b_id,
        'equipmentId': f'EQ-MACH-{i % len(machines) + 1}',
        'equipmentTitle': m['title'],
        'title': m['title'],
        'category': m['cat'],
        'providerName': 'Ramesh Farm Services',
        'providerPhone': '+91 98765 43210',
        'provider_phone': '+91 98765 43210',
        'farmerName': 'farmer1',
        'farmerPhone': '+91 91234 56789',
        'phone': '+91 91234 56789',
        'village': v,
        'mandal': 'Mundlamuru',
        'district': 'Prakasam',
        'state': 'Andhra Pradesh',
        'bookingDate': '2026-09-26',
        'date': '2026-09-26',
        'timeSlot': 'Early Morning (6:00 AM - 10:00 AM)' if (i % 2 == 0) else 'Full Day (8:00 AM - 5:00 PM)',
        'unitMode': 'acres',
        'acres': acres,
        'operation': m['op'],
        'totalCost': total_cost,
        'includeOperator': True,
        'includeDiesel': True,
        'paymentMode': 'Cash after field work',
        'status': 'confirmed' if i == 1 else 'pending',
        'createdAt': now_iso,
        'updatedAt': now_iso
    }
    ops.append(UpdateOne({'id': b_id}, {'$set': b}, upsert=True))

res = db.equipment_bookings.bulk_write(ops, ordered=False)
total = db.equipment_bookings.count_documents({'id': {'$regex': '^BK-TEST-'}})
ramesh_total = db.equipment_bookings.count_documents({
    'id': {'$regex': '^BK-TEST-'},
    '$or': [
        {'providerPhone': {'$regex': '9876543210'}},
        {'providerName': {'$regex': 'Ramesh', '$options': 'i'}}
    ]
})
print(f'Bulk write success! Upserted: {res.upserted_count}, Modified: {res.modified_count}')
print(f'Total BK-TEST bookings in agrishield_db: {total} / 1000')
print(f'Total bookings for Provider Ramesh: {ramesh_total} / 1000')
