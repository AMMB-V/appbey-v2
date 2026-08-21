"""
Migracion: reemplaza el ranking de ejemplo (auto-generado en el seed) por el
ranking REAL de la Temporada #1 (Asociacion Panameña de Beyblade), tomado de
la hoja "Ranking APBey", y deja lista la Temporada #2 con el ranking por ELO
vacio (a la espera del nuevo multiplicador).

Uso (una sola vez, contra la base de datos real / de produccion):
    cd backend
    python scripts/migrate_real_season.py

Es idempotente: si "Temporada #1" ya existe, no hace nada y avisa.
"""
import csv
import re
import secrets
import sys
import unicodedata
import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.wallet import Wallet, Transaction
from app.models.ranking import Season, SeasonRanking, HallOfFame
from app.services.auth_service import hash_password

CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "temporada1_ranking.csv"

T1_START = datetime.datetime(2025, 12, 27)
T1_END = datetime.datetime(2026, 6, 30)


def slugify(name: str) -> str:
    norm = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", norm).strip("_").lower()
    return slug or "blader"


def unique_username(db, base: str) -> str:
    candidate = base
    n = 1
    while db.query(User).filter(User.username == candidate).first():
        n += 1
        candidate = f"{base}{n}"
    return candidate


def get_or_create_blader(db, display_name: str) -> User:
    existing = db.query(User).filter(User.display_name.ilike(display_name)).first()
    if existing:
        return existing

    base = slugify(display_name)
    username = unique_username(db, base)
    email = f"{username}@appbey.pendiente"

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(secrets.token_urlsafe(16)),
        display_name=display_name,
        role="blader",
        country="PA",
        elo_rating=1200,
        is_active=True,
        is_verified=False,  # cuenta placeholder: el blader real la reclama despues
        bio="Blader de la Temporada #1 (cuenta pendiente de reclamar).",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    wallet = Wallet(user_id=user.id, balance=500)
    db.add(wallet)
    db.commit()
    db.add(Transaction(wallet_id=wallet.id, amount=wallet.balance, tx_type="signup_bonus", reason="Saldo inicial AppBey"))
    db.commit()
    return user


def ensure_columns():
    """create_all() no altera tablas ya existentes en SQLite: si la tabla
    season_rankings ya existe con el esquema viejo, hay que agregarle a mano
    las columnas nuevas (points_for, points_against, bonus_points, warnings,
    overall_rank) antes de insertar nada."""
    with engine.connect() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(season_rankings)")}
        new_columns = {
            "points_for": "INTEGER DEFAULT 0",
            "points_against": "INTEGER DEFAULT 0",
            "bonus_points": "INTEGER DEFAULT 0",
            "warnings": "INTEGER DEFAULT 0",
            "overall_rank": "INTEGER",
        }
        for col, coltype in new_columns.items():
            if col not in existing:
                print(f"   (esquema) agregando columna season_rankings.{col}")
                conn.exec_driver_sql(f"ALTER TABLE season_rankings ADD COLUMN {col} {coltype}")
        conn.commit()


def run():
    Base.metadata.create_all(bind=engine)
    ensure_columns()
    db = SessionLocal()
    try:
        if db.query(Season).filter(Season.name == "Temporada #1").first():
            print("Ya existe 'Temporada #1'. Migracion ya aplicada, no se hace nada.")
            return

        print("1) Borrando ranking y Hall of Fame auto-generados...")
        db.query(SeasonRanking).delete()
        db.query(HallOfFame).delete()
        db.query(Season).delete()
        db.commit()

        print("2) Reiniciando el ELO de todos los usuarios a 1200 (temporada nueva, sin multiplicador aun)...")
        db.query(User).update({User.elo_rating: 1200})
        db.commit()

        print("3) Creando Temporada #1 (historica, cerrada) y cargando el ranking real por puntos...")
        season1 = Season(
            name="Temporada #1",
            is_active=False,
            start_date=T1_START,
            end_date=T1_END,
            description="Asociacion Panameña de Beyblade - Ranking Nacional Individual, Categoria Open."
        )
        db.add(season1)
        db.commit()

        top_ranked_user = None
        with open(CSV_PATH, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                blader_name = row["blader"].strip()
                user = get_or_create_blader(db, blader_name)

                sr = SeasonRanking(
                    season_id=season1.id,
                    user_id=user.id,
                    points=int(row["total"]),
                    elo=1200,
                    tournaments_played=int(row["torneos"]),
                    tournaments_won=0,
                    podium_finishes=0,
                    matches_won=int(row["wins"]),
                    matches_lost=int(row["losses"]),
                    points_for=int(row["points_for"]),
                    points_against=int(row["points_against"]),
                    bonus_points=int(row["bonus"]),
                    warnings=int(row["warnings"]),
                    overall_rank=int(row["rank"]),
                )
                db.add(sr)
                if int(row["rank"]) == 1:
                    top_ranked_user = user
        db.commit()
        print("   Ranking real de la Temporada #1 cargado.")

        if top_ranked_user:
            db.add(HallOfFame(
                year=2026,
                title="Campeon Temporada #1 (Ranking por Puntos)",
                user_id=top_ranked_user.id,
                tournament_name="Temporada #1 - Ranking Nacional Individual, Categoria Open",
                notes="Primer lugar del ranking oficial por puntos de la Temporada #1."
            ))
            db.commit()
            print(f"   Hall of Fame: {top_ranked_user.display_name} como campeon de la Temporada #1.")

        print("4) Creando Temporada #2 (nueva, activa) con ranking por ELO vacio...")
        season2 = Season(
            name="Temporada #2",
            is_active=True,
            start_date=datetime.datetime.utcnow(),
            end_date=None,
            description="Nueva temporada. Ranking por ELO en blanco, pendiente del nuevo multiplicador."
        )
        db.add(season2)
        db.commit()
        print("   Temporada #2 creada sin filas de ranking (queda vacia hasta que se juegue).")

        print("\nListo. Resumen:")
        print(f"  - Temporada #1 (id={season1.id}): {len(list(csv.DictReader(open(CSV_PATH, encoding='utf-8'))))} bladers con datos reales.")
        print(f"  - Temporada #2 (id={season2.id}): activa, ranking ELO vacio.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
