import sys
import unittest
from pathlib import Path

backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestAppBeyAPI(unittest.TestCase):
    def test_01_login_success(self):
        res = client.post("/api/v1/auth/login", json={
            "email": "byjankraftyt@gmail.com",
            "password": "123456"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["user"]["username"], "byjankraftyt")

    def test_02_get_tournaments(self):
        res = client.get("/api/v1/tournaments")
        self.assertEqual(res.status_code, 200)
        tournaments = res.json()
        self.assertGreaterEqual(len(tournaments), 2)
        # Verify formats present
        formats = [t["format"] for t in tournaments]
        self.assertIn("swiss", formats)
        self.assertIn("single_elim", formats)

    def test_03_get_beyblade_parts_and_tierlist(self):
        res = client.get("/api/v1/beyblades/parts")
        self.assertEqual(res.status_code, 200)
        parts = res.json()
        self.assertGreaterEqual(len(parts), 20)
        s_tiers = [p for p in parts if p["tier"] == "S"]
        self.assertGreater(len(s_tiers), 0)

    def test_04_get_rankings_and_hall_of_fame(self):
        res_rank = client.get("/api/v1/rankings/leaderboard")
        self.assertEqual(res_rank.status_code, 200)
        leaderboard = res_rank.json()
        self.assertGreater(len(leaderboard), 0)

        res_hof = client.get("/api/v1/rankings/hall-of-fame")
        self.assertEqual(res_hof.status_code, 200)
        hof = res_hof.json()
        self.assertGreater(len(hof), 0)

    def test_05_authenticated_wallet_and_claim(self):
        login_res = client.post("/api/v1/auth/login", json={
            "email": "byjankraftyt@gmail.com",
            "password": "123456"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        wallet_res = client.get("/api/v1/wallets/me", headers=headers)
        self.assertEqual(wallet_res.status_code, 200)
        self.assertGreaterEqual(wallet_res.json()["balance"], 100)

        claim_res = client.post("/api/v1/wallets/daily-reward", headers=headers)
        self.assertEqual(claim_res.status_code, 200)

if __name__ == "__main__":
    unittest.main()
