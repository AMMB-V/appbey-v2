from typing import Optional, List
import datetime
from pydantic import BaseModel

class BeybladePartOut(BaseModel):
    id: int
    code: Optional[str] = None
    name: str
    category: str
    system: str = "BX"
    type_attr: str = "Attack"
    weight_grams: float = 0.0
    attack_stat: int = 50
    defense_stat: int = 50
    stamina_stat: int = 50
    dash_stat: int = 50
    tier: str = "A"
    image_url: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True

class BladerDeckCreate(BaseModel):
    name: str = "Deck Competitivo"
    description: Optional[str] = None
    is_public: bool = True
    slot1_name: Optional[str] = None
    slot1_blade_id: Optional[int] = None
    slot1_ratchet_id: Optional[int] = None
    slot1_bit_id: Optional[int] = None
    slot2_name: Optional[str] = None
    slot2_blade_id: Optional[int] = None
    slot2_ratchet_id: Optional[int] = None
    slot2_bit_id: Optional[int] = None
    slot3_name: Optional[str] = None
    slot3_blade_id: Optional[int] = None
    slot3_ratchet_id: Optional[int] = None
    slot3_bit_id: Optional[int] = None

class BladerDeckOut(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    is_public: bool
    slot1_name: Optional[str] = None
    slot2_name: Optional[str] = None
    slot3_name: Optional[str] = None
    total_weight: float = 0.0
    created_at: datetime.datetime
    blade1: Optional[BeybladePartOut] = None
    ratchet1: Optional[BeybladePartOut] = None
    bit1: Optional[BeybladePartOut] = None
    blade2: Optional[BeybladePartOut] = None
    ratchet2: Optional[BeybladePartOut] = None
    bit2: Optional[BeybladePartOut] = None
    blade3: Optional[BeybladePartOut] = None
    ratchet3: Optional[BeybladePartOut] = None
    bit3: Optional[BeybladePartOut] = None

    class Config:
        from_attributes = True
