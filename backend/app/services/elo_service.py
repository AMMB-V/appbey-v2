import math
from sqlalchemy.orm import Session
from app.models.user import User

class EloService:
    K_FACTOR = 32

    @staticmethod
    def calculate_expected_score(rating_a: int, rating_b: int) -> float:
        return 1.0 / (1.0 + math.pow(10, (rating_b - rating_a) / 400.0))

    @classmethod
    def update_ratings_after_match(cls, db: Session, user_a_id: int, user_b_id: int, winner_id: int):
        user_a = db.query(User).filter(User.id == user_a_id).first()
        user_b = db.query(User).filter(User.id == user_b_id).first()

        if not user_a or not user_b:
            return

        expected_a = cls.calculate_expected_score(user_a.elo_rating, user_b.elo_rating)
        expected_b = cls.calculate_expected_score(user_b.elo_rating, user_a.elo_rating)

        if winner_id == user_a_id:
            actual_a, actual_b = 1.0, 0.0
        elif winner_id == user_b_id:
            actual_a, actual_b = 0.0, 1.0
        else:
            actual_a, actual_b = 0.5, 0.5

        delta_a = round(cls.K_FACTOR * (actual_a - expected_a))
        delta_b = round(cls.K_FACTOR * (actual_b - expected_b))

        user_a.elo_rating = max(100, user_a.elo_rating + delta_a)
        user_b.elo_rating = max(100, user_b.elo_rating + delta_b)
        db.commit()
