import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class BeybladePart(Base):
    __tablename__ = "beyblade_parts"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), index=True)
    name = Column(String(100), index=True, nullable=False)
    category = Column(String(20), nullable=False)  # blade, ratchet, bit
    system = Column(String(20), default="BX")  # BX, UX, CX
    type_attr = Column(String(20), default="Attack")  # Attack, Defense, Stamina, Balance
    weight_grams = Column(Float, default=0.0)
    attack_stat = Column(Integer, default=50)
    defense_stat = Column(Integer, default=50)
    stamina_stat = Column(Integer, default=50)
    dash_stat = Column(Integer, default=50)
    tier = Column(String(5), default="A")  # S, A, B, C
    image_url = Column(String(255), nullable=True)
    description = Column(String(500), nullable=True)

class BladerDeck(Base):
    __tablename__ = "blader_decks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), default="Deck Competitivo")
    description = Column(String(255), nullable=True)
    is_public = Column(Boolean, default=True)

    # Slot 1
    slot1_name = Column(String(100), default="Phoenix Wing 9-60 GF")
    slot1_blade_id = Column(Integer, ForeignKey("beyblade_parts.id", ondelete="SET NULL"), nullable=True)
    slot1_ratchet_id = Column(Integer, ForeignKey("beyblade_parts.id", ondelete="SET NULL"), nullable=True)
    slot1_bit_id = Column(Integer, ForeignKey("beyblade_parts.id", ondelete="SET NULL"), nullable=True)

    # Slot 2
    slot2_name = Column(String(100), default="Wizard Rod 5-70 DB")
    slot2_blade_id = Column(Integer, ForeignKey("beyblade_parts.id", ondelete="SET NULL"), nullable=True)
    slot2_ratchet_id = Column(Integer, ForeignKey("beyblade_parts.id", ondelete="SET NULL"), nullable=True)
    slot2_bit_id = Column(Integer, ForeignKey("beyblade_parts.id", ondelete="SET NULL"), nullable=True)

    # Slot 3
    slot3_name = Column(String(100), default="Dran Buster 1-60 F")
    slot3_blade_id = Column(Integer, ForeignKey("beyblade_parts.id", ondelete="SET NULL"), nullable=True)
    slot3_ratchet_id = Column(Integer, ForeignKey("beyblade_parts.id", ondelete="SET NULL"), nullable=True)
    slot3_bit_id = Column(Integer, ForeignKey("beyblade_parts.id", ondelete="SET NULL"), nullable=True)

    total_weight = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="decks")
    blade1 = relationship("BeybladePart", foreign_keys=[slot1_blade_id])
    ratchet1 = relationship("BeybladePart", foreign_keys=[slot1_ratchet_id])
    bit1 = relationship("BeybladePart", foreign_keys=[slot1_bit_id])
    
    blade2 = relationship("BeybladePart", foreign_keys=[slot2_blade_id])
    ratchet2 = relationship("BeybladePart", foreign_keys=[slot2_ratchet_id])
    bit2 = relationship("BeybladePart", foreign_keys=[slot2_bit_id])
    
    blade3 = relationship("BeybladePart", foreign_keys=[slot3_blade_id])
    ratchet3 = relationship("BeybladePart", foreign_keys=[slot3_ratchet_id])
    bit3 = relationship("BeybladePart", foreign_keys=[slot3_bit_id])
