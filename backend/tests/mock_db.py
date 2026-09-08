from bson import ObjectId
from datetime import datetime, timezone

class MockCollection:
    def __init__(self):
        self.records = []

    def _matches(self, rec, query):
        for k, v in query.items():
            if k.startswith("$"):
                if k == "$or":
                    match_or = False
                    for term in v:
                        for field, matcher in term.items():
                            val_str = str(rec.get(field, "")).lower()
                            if isinstance(matcher, dict):
                                regex_val = matcher.get("$regex", "").lower()
                                if regex_val in val_str:
                                    match_or = True
                            else:
                                if str(matcher).lower() == val_str or str(matcher).lower() in val_str:
                                    match_or = True
                    if not match_or:
                        return False
            elif k == "_id":
                if str(rec.get("_id")) != str(v):
                    return False
            elif k == "email":
                if str(rec.get("email", "")).lower() != str(v).lower():
                    return False
            elif isinstance(v, dict):
                pass
            else:
                if rec.get(k) != v:
                    return False
        return True

    async def find_one(self, query):
        cursor = self.find(query)
        return cursor.data[0] if cursor.data else None

    async def insert_one(self, record):
        import copy
        record_copy = copy.deepcopy(record)
        if "_id" not in record_copy:
            inserted_id = ObjectId()
            record_copy["_id"] = inserted_id
            record["_id"] = inserted_id
        else:
            inserted_id = record_copy["_id"]
        self.records.append(record_copy)
        
        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertResult(inserted_id)

    async def update_one(self, query, update_dict, upsert=False, **kwargs):
        rec = await self.find_one(query)
        if rec and "$set" in update_dict:
            for k, v in update_dict["$set"].items():
                rec[k] = v
        elif not rec and upsert and "$set" in update_dict:
            new_rec = dict(query)
            for k, v in update_dict["$set"].items():
                new_rec[k] = v
            self.records.append(new_rec)
            return new_rec
        return rec

    async def delete_many(self, query):
        self.records = []
        return True

    async def delete_one(self, query):
        rec = await self.find_one(query)
        if rec:
            self.records.remove(rec)
            return True
        return False

    async def count_documents(self, query):
        count = 0
        for rec in self.records:
            if self._matches(rec, query):
                count += 1
        return count

    def find(self, query):
        filtered = [rec for rec in self.records if self._matches(rec, query)]

        class Cursor:
            def __init__(self, data):
                self.data = data
            def sort(self, key, direction=-1):
                # Sort by created_at descending by default
                try:
                    self.data = sorted(self.data, key=lambda x: x.get(key, datetime.now(timezone.utc)), reverse=(direction == -1))
                except Exception:
                    pass
                return self
            def skip(self, num):
                self.data = self.data[num:]
                return self
            def limit(self, num):
                self.data = self.data[:num]
                return self
            async def to_list(self, length):
                return self.data[:length]
                
        return Cursor(filtered)

class MockDatabase:
    def __init__(self):
        self.users = MockCollection()
        self.predictions = MockCollection()
        self.devices = MockCollection()
        self.telemetry = MockCollection()
        self.notifications = MockCollection()

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(f"'MockDatabase' object has no attribute '{name}'")
        col = MockCollection()
        setattr(self, name, col)
        return col

    def __getitem__(self, name):
        return getattr(self, name)
