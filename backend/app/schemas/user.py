from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserProfile(BaseModel):
    id: str
    email: str
    username: str
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime
    last_login_at: Optional[datetime] = None

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None

