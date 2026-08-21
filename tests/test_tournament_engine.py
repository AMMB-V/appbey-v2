import sys
import unittest
from pathlib import Path

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.database import engine, Base, SessionLocal
from app.models.user import User
from app.models.tournament import Tournament, TournamentParticipant, TournamentMatch
from app.services.tournament_engine import TournamentEngine
from app.services.seed_data import seed_database
from app.services.auth_service import hash_password

class TestTournamentEngine(unittest.TestCase):
    def setUp(self):
        Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()
        seed_database(self.db)

    def tearDown(self):
        self.db.close()

    def test_seed_data_loaded(self):
        users = self.db.query(User).all()
        self.assertGreaterEqual(len(users), 10)
        
        t = self.db.query(Tournament).filter(Tournament.slug == "copa-nacional-beyblade-x-panama-2026").first()
        self.assertIsNotNone(t)
        self.assertEqual(t.battle_type, "3on3_deck")
        self.assertEqual(t.match_target_points, 4)

    def test_record_match_game_xtreme_finish(self):
        # Match 1 is in progress
        match = self.db.query(TournamentMatch).filter(TournamentMatch.id == 1).first()
        initial_score_a = match.score_a

        # Record an Xtreme Finish (+3 points) for Player A
        updated = TournamentEngine.record_match_game(
            db=self.db,
            match_id=match.id,
            finish_type="xtreme_finish_3p",
            awarded_to="player_a",
            notes="Impacto Xtreme Dash letal"
        )
        self.assertEqual(updated.score_a, initial_score_a + 3)
        # Score is now >= 4, match should be finished
        self.assertEqual(updated.status, "finished")
        self.assertEqual(updated.winner_id, match.player_a_id)

    def test_swiss_pairing_progression(self):
        t = self.db.query(Tournament).filter(Tournament.slug == "copa-nacional-beyblade-x-panama-2026").first()
        # Trigger next round
        initial_round = t.current_round
        next_r = TournamentEngine.generate_next_swiss_round(self.db, t)
        self.assertEqual(next_r, initial_round + 1)
        
        round_matches = self.db.query(TournamentMatch).filter(
            TournamentMatch.tournament_id == t.id,
            TournamentMatch.round_number == next_r
        ).all()
        self.assertGreater(len(round_matches), 0)

if __name__ == "__main__":
    unittest.main()
