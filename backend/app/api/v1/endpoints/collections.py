from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime, timezone
from app.dependencies import get_current_user
from app.models.user import User
from app.models.library import Collection, CollectionMembership, LibraryItem
from app.schemas.library import CollectionCreate, CollectionUpdate, CollectionResponse
from app.schemas.workspace import CollectionItemCreate

router = APIRouter()

async def _owned_collection(collection_id: str, user_id: str):
    try:
        collection = await Collection.get(ObjectId(collection_id))
    except (TypeError, ValueError):
        collection = None
    if not collection or collection.user_id != user_id:
        return None
    return collection

@router.post("", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    data: CollectionCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a new personal or public collection."""
    col = Collection(
        user_id=str(current_user.id),
        name=data.name,
        description=data.description,
        is_public=data.is_public,
    )
    await col.insert()
    return CollectionResponse(
        id=str(col.id),
        user_id=col.user_id,
        name=col.name,
        description=col.description,
        is_public=col.is_public,
        item_count=0,
        created_at=col.created_at,
        updated_at=col.updated_at,
    )


@router.get("", response_model=List[CollectionResponse])
async def list_collections(
    current_user: User = Depends(get_current_user),
):
    """List all collections belonging to the current user."""
    cols = await Collection.find({"user_id": str(current_user.id)}).sort("-created_at").to_list()
    res = []
    for c in cols:
        count = await CollectionMembership.find({"collection_id": str(c.id)}).count()
        res.append(
            CollectionResponse(
                id=str(c.id),
                user_id=c.user_id,
                name=c.name,
                description=c.description,
                is_public=c.is_public,
                item_count=count,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
        )
    return res


@router.patch("/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: str,
    data: CollectionUpdate,
    current_user: User = Depends(get_current_user),
):
    col = await _owned_collection(collection_id, str(current_user.id))
    if not col:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(col, key, value)
    col.updated_at = datetime.now(timezone.utc)
    await col.save()
    count = await CollectionMembership.find({"collection_id": str(col.id)}).count()
    return CollectionResponse(
        id=str(col.id),
        user_id=col.user_id,
        name=col.name,
        description=col.description,
        is_public=col.is_public,
        item_count=count,
        created_at=col.created_at,
        updated_at=col.updated_at,
    )


@router.get("/{collection_id}/items")
async def list_collection_items(
    collection_id: str,
    current_user: User = Depends(get_current_user),
):
    col = await _owned_collection(collection_id, str(current_user.id))
    if not col:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    memberships = await CollectionMembership.find({"collection_id": str(col.id)}).sort("sort_order").to_list()
    items = []
    for membership in memberships:
        item = await LibraryItem.get(membership.library_item_id)
        if item and item.user_id == str(current_user.id):
            items.append({
                "id": str(item.id),
                "title": item.title,
                "author": item.author,
                "file_type": item.file_type,
                "reading_progress": item.reading_progress,
            })
    return items


@router.post("/{collection_id}/items", status_code=status.HTTP_201_CREATED)
async def add_collection_item(
    collection_id: str,
    data: CollectionItemCreate,
    current_user: User = Depends(get_current_user),
):
    col = await _owned_collection(collection_id, str(current_user.id))
    if not col:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    item_id = data.library_item_id
    try:
        item = await LibraryItem.get(ObjectId(item_id))
    except (TypeError, ValueError):
        item = None
    if not item or item.user_id != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Library item not found")
    collection_id = str(col.id)
    membership = await CollectionMembership.find_one({
        "collection_id": collection_id,
        "library_item_id": str(item.id),
    })
    if not membership:
        membership = CollectionMembership(collection_id=collection_id, library_item_id=str(item.id))
        await membership.insert()
    return {"collection_id": collection_id, "library_item_id": str(item.id)}


@router.delete("/{collection_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_collection_item(
    collection_id: str,
    item_id: str,
    current_user: User = Depends(get_current_user),
):
    col = await _owned_collection(collection_id, str(current_user.id))
    if not col:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    membership = await CollectionMembership.find_one({
        "collection_id": str(col.id),
        "library_item_id": item_id,
    })
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection item not found")
    await membership.delete()

@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a collection and its memberships."""
    col = await _owned_collection(collection_id, str(current_user.id))
    if not col:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    await CollectionMembership.find({"collection_id": collection_id}).delete()
    await col.delete()
    return None
