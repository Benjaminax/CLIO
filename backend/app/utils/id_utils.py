from bson import ObjectId

def is_valid_object_id(id_str: str) -> bool:
    try:
        ObjectId(id_str)
        return True
    except Exception:
        return False

def to_object_id(id_str: str) -> ObjectId:
    return ObjectId(id_str)

