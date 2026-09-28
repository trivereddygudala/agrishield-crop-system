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
                # Handle range comparisons like {"$lt": val}, {"$gt": val}, {"$in": [...]}
                rec_val = rec.get(k)
                if "$in" in v:
                    if rec_val not in v["$in"]:
                        return False
                if "$lt" in v:
                    if rec_val is None or not (rec_val < v["$lt"]):
                        return False
                if "$gt" in v:
                    if rec_val is None or not (rec_val > v["$gt"]):
                        return False
                if "$lte" in v:
                    if rec_val is None or not (rec_val <= v["$lte"]):
                        return False
                if "$gte" in v:
                    if rec_val is None or not (rec_val >= v["$gte"]):
                        return False
            else:
                if rec.get(k) != v:
                    return False
        return True

    async def find_one(self, query, session=None, **kwargs):
        cursor = self.find(query)
        return cursor.data[0] if cursor.data else None

    async def insert_one(self, record, session=None, **kwargs):
        import copy
        record_copy = copy.deepcopy(record)
        if getattr(self, "unique_keys", None):
            for u_keys in self.unique_keys:
                u_query = {k: record_copy.get(k) for k in u_keys}
                if any(self._matches(r, u_query) for r in self.records):
                    from pymongo.errors import DuplicateKeyError
                    raise DuplicateKeyError(f"E11000 duplicate key error on index: {u_keys}")
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

    async def update_one(self, query, update_dict, upsert=False, session=None, **kwargs):
        rec = await self.find_one(query)
        if rec:
            if "$set" in update_dict:
                for k, v in update_dict["$set"].items():
                    rec[k] = v
            if "$inc" in update_dict:
                for k, v in update_dict["$inc"].items():
                    rec[k] = rec.get(k, 0) + v
        elif not rec and upsert:
            new_rec = dict(query)
            if "$set" in update_dict:
                for k, v in update_dict["$set"].items():
                    new_rec[k] = v
            if "$inc" in update_dict:
                for k, v in update_dict["$inc"].items():
                    new_rec[k] = v
            self.records.append(new_rec)
            return new_rec
        return rec

    async def find_one_and_update(self, query, update_dict, return_document=True, upsert=False, session=None, **kwargs):
        rec = await self.find_one(query)
        if rec:
            if "$set" in update_dict:
                for k, v in update_dict["$set"].items():
                    rec[k] = v
            if "$inc" in update_dict:
                for k, v in update_dict["$inc"].items():
                    rec[k] = rec.get(k, 0) + v
            return rec
        elif not rec and upsert:
            new_rec = dict(query)
            if "$set" in update_dict:
                for k, v in update_dict["$set"].items():
                    new_rec[k] = v
            if "$inc" in update_dict:
                for k, v in update_dict["$inc"].items():
                    new_rec[k] = v
            self.records.append(new_rec)
            return new_rec
        return None

    async def delete_many(self, query, session=None, **kwargs):
        remaining = [r for r in self.records if not self._matches(r, query)]
        deleted_count = len(self.records) - len(remaining)
        self.records = remaining
        class DeleteResult:
            def __init__(self, count):
                self.deleted_count = count
        return DeleteResult(deleted_count)

    async def delete_one(self, query, session=None, **kwargs):
        rec = await self.find_one(query)
        if rec:
            self.records.remove(rec)
            return True
        return False

    async def count_documents(self, query, session=None, **kwargs):
        count = 0
        for rec in self.records:
            if self._matches(rec, query):
                count += 1
        return count

    async def create_index(self, *args, **kwargs):
        return "idx_created"

    async def bulk_write(self, ops, ordered=False, session=None, **kwargs):
        for op in ops:
            if hasattr(op, "_filter") and hasattr(op, "_doc"):
                q = getattr(op, "_filter", {})
                raw_u = getattr(op, "_doc", {})
                upsert = getattr(op, "_upsert", False)
                if "" in raw_u:
                    u = {"$set": raw_u[""]}
                else:
                    u = raw_u
                await self.update_one(q, u, upsert=upsert, session=session)
            elif hasattr(op, "_doc"):
                await self.insert_one(op._doc, session=session)
        return len(ops)

    def find(self, query=None, projection=None, session=None, *args, **kwargs):
        query = query or {}
        filtered = [rec for rec in self.records if self._matches(rec, query)]

        class Cursor:
            def __init__(self, data):
                self.data = data
            def sort(self, key, direction=-1):
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
            async def to_list(self, length=None):
                return self.data[:length] if length is not None else list(self.data)
                
        return Cursor(filtered)

class MockSession:
    def __init__(self, client=None):
        self.in_transaction = False
        self.client = client

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    def start_transaction(self):
        class TransactionContext:
            async def __aenter__(self_inner):
                return self
            async def __aexit__(self_inner, exc_type, exc_val, exc_tb):
                pass
        return TransactionContext()

    async def commit_transaction(self):
        if self.client and getattr(self.client, "fail_with_unknown_commit", False):
            self.client.fail_with_unknown_commit = False
            from pymongo.errors import OperationFailure
            exc = OperationFailure("Mock commit network timeout / primary stepdown", code=112)
            exc._error_labels = ["UnknownTransactionCommitResult"]
            raise exc

    async def abort_transaction(self):
        pass

class MockClient:
    def __init__(self, db):
        self._db = db
        self.fail_with_unknown_commit = False

    async def start_session(self):
        return MockSession(self)

    def __getitem__(self, name):
        return self._db

class MockDatabase:
    def __init__(self):
        self.users = MockCollection()
        self.predictions = MockCollection()
        self.devices = MockCollection()
        self.telemetry = MockCollection()
        self.notifications = MockCollection()
        self.equipment_bookings = MockCollection()
        self.equipment_catalog = MockCollection()
        self.equipment_locks = MockCollection()
        self.idempotency_records = MockCollection()
        self.idempotency_records.unique_keys = [("key", "user_id")]
        self._client = MockClient(self)

    @property
    def client(self):
        return self._client

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(f"'MockDatabase' object has no attribute '{name}'")
        col = MockCollection()
        setattr(self, name, col)
        return col

    def __getitem__(self, name):
        return getattr(self, name)
