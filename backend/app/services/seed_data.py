import datetime
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.wallet import Wallet, Transaction
from app.models.beyblade import BeybladePart, BladerDeck
from app.models.tournament import Tournament, TournamentParticipant, TournamentMatch, MatchGame
from app.models.ranking import Season, SeasonRanking, HallOfFame
from app.models.social import Notification, CommunityPost, PostComment
from app.services.auth_service import hash_password

def seed_database(db: Session):
    if db.query(User).first():
        return

    print("Seeding AppBey 2.0 initial database...")

    # 1. Users
    admin = User(
        username="byjankraftyt",
        email="byjankraftyt@gmail.com",
        password_hash=hash_password("123456"),
        display_name="Jan Kraft (Admin)",
        role="admin",
        country="PA",
        avatar_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
        bio="Organizador Oficial de Torneos Beyblade X en Panama y fundador de UC x AppBey.",
        favorite_combo="Phoenix Wing 9-60 GF",
        elo_rating=1850
    )
    
    organizer = User(
        username="blader_master",
        email="organizer@appbey.app",
        password_hash=hash_password("123456"),
        display_name="Carlos 'Xtreme' Vega",
        role="organizer",
        country="MX",
        avatar_url="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
        bio="Juez oficial y organizador de la liga competitiva de Beyblade Xtreme.",
        favorite_combo="Wizard Rod 5-70 DB",
        elo_rating=1720
    )

    referee = User(
        username="referee_alex",
        email="referee@appbey.app",
        password_hash=hash_password("123456"),
        display_name="Arbitro Alex",
        role="referee",
        country="PA",
        avatar_url="https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&auto=format&fit=crop&q=80",
        bio="Arbitro certificado WBO y Takara Tomy para combates 3on3 Xtreme Stadium.",
        favorite_combo="Dran Buster 1-60 F",
        elo_rating=1450
    )

    bladers = [
        User(username="ryu_blader", email="ryu@appbey.app", password_hash=hash_password("123456"), display_name="Ryu Kusanagi", role="blader", country="PA", elo_rating=1680, avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80", favorite_combo="Shark Edge 3-60 LF"),
        User(username="valkyrie_pro", email="valk@appbey.app", password_hash=hash_password("123456"), display_name="Sofia 'Valkyrie' Gomez", role="blader", country="CL", elo_rating=1620, avatar_url="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80", favorite_combo="Cobalt Dragoon 1-60 E"),
        User(username="dran_legend", email="dran@appbey.app", password_hash=hash_password("123456"), display_name="Mateo Morales", role="blader", country="MX", elo_rating=1590, avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80", favorite_combo="Tyranno Beat 4-70 Q"),
        User(username="storm_blader", email="storm@appbey.app", password_hash=hash_password("123456"), display_name="Gabriel Mendez", role="blader", country="PE", elo_rating=1510, avatar_url="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80", favorite_combo="Hells Chain 5-60 HT"),
        User(username="pegasus_fire", email="pegasus@appbey.app", password_hash=hash_password("123456"), display_name="Lucas Rossi", role="blader", country="AR", elo_rating=1480, avatar_url="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80", favorite_combo="Unicorn Sting 5-60 GP"),
        User(username="viper_fang", email="viper@appbey.app", password_hash=hash_password("123456"), display_name="Diego Santos", role="blader", country="CO", elo_rating=1420, avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80", favorite_combo="Viper Tail 5-80 O"),
        User(username="phoenix_queen", email="phoenix@appbey.app", password_hash=hash_password("123456"), display_name="Elena Castillo", role="blader", country="PA", elo_rating=1650, avatar_url="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80", favorite_combo="Phoenix Wing 9-60 GF"),
        User(username="knight_shield", email="knight@appbey.app", password_hash=hash_password("123456"), display_name="Victor Bravo", role="blader", country="PA", elo_rating=1380, avatar_url="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80", favorite_combo="Knight Shield 3-80 N")
    ]

    all_users = [admin, organizer, referee] + bladers
    for u in all_users:
        db.add(u)
    db.commit()

    # Wallets
    for u in all_users:
        w = Wallet(user_id=u.id, balance=1200 if u.role in ["admin", "organizer"] else 500)
        db.add(w)
        db.commit()
        tx = Transaction(wallet_id=w.id, amount=w.balance, tx_type="signup_bonus", reason="Saldo inicial y bienvenida AppBey 2.0")
        db.add(tx)
    db.commit()

    # 2. Parts Catalog
    blades = [
        BeybladePart(code="BX-23", name="Phoenix Wing", category="blade", system="BX", type_attr="Attack", weight_grams=38.2, attack_stat=95, defense_stat=70, stamina_stat=65, dash_stat=90, tier="S", description="Blade pesada de metal pintado con tremendo poder de smash y Xtreme Dash."),
        BeybladePart(code="UX-03", name="Wizard Rod", category="blade", system="UX", type_attr="Stamina", weight_grams=35.5, attack_stat=40, defense_stat=85, stamina_stat=98, dash_stat=55, tier="S", description="El rey indiscutible de la resistencia y estabilidad centrifuga exterior."),
        BeybladePart(code="UX-01", name="Dran Buster", category="blade", system="UX", type_attr="Attack", weight_grams=35.0, attack_stat=98, defense_stat=30, stamina_stat=40, dash_stat=95, tier="S", description="Espada descomunal de un solo impacto letal para conseguir One-Hit KOs y Burst Finish."),
        BeybladePart(code="BX-14", name="Shark Edge", category="blade", system="BX", type_attr="Attack", weight_grams=34.8, attack_stat=92, defense_stat=35, stamina_stat=45, dash_stat=90, tier="A", description="Upper attack demoledor capaz de lanzar rivales fuera del estadio en el primer choque."),
        BeybladePart(code="BX-21", name="Hells Chain", category="blade", system="BX", type_attr="Balance", weight_grams=33.5, attack_stat=70, defense_stat=80, stamina_stat=80, dash_stat=70, tier="A", description="Excelente combinacion de defensa angular y contraataque equilibrado."),
        BeybladePart(code="UX-02", name="Hells Hammer", category="blade", system="UX", type_attr="Balance", weight_grams=33.2, attack_stat=78, defense_stat=68, stamina_stat=75, dash_stat=75, tier="A", description="Ataque descendente martillo ideal para desestabilizar Beys defensivos."),
        BeybladePart(code="BX-31", name="Tyranno Beat", category="blade", system="BX", type_attr="Attack", weight_grams=37.5, attack_stat=90, defense_stat=60, stamina_stat=55, dash_stat=85, tier="A", description="Mandibula demoledora con masa concentrada para golpes de choque masivos."),
        BeybladePart(code="BX-26", name="Unicorn Sting", category="blade", system="BX", type_attr="Balance", weight_grams=33.8, attack_stat=72, defense_stat=76, stamina_stat=78, dash_stat=70, tier="B", description="Forma asimetrica que permite alternar ataque con un cuerno y defensa lisa."),
        BeybladePart(code="BX-16", name="Viper Tail", category="blade", system="BX", type_attr="Stamina", weight_grams=34.0, attack_stat=65, defense_stat=60, stamina_stat=85, dash_stat=60, tier="B", description="Down-force blades que mantienen la postura de giro estable contra ataques."),
        BeybladePart(code="BX-04", name="Knight Shield", category="blade", system="BX", type_attr="Defense", weight_grams=32.8, attack_stat=40, defense_stat=88, stamina_stat=70, dash_stat=50, tier="C", description="Escudo clasico de absorcion de impactos frontales.")
    ]

    ratchets = [
        BeybladePart(code="R-960", name="9-60", category="ratchet", system="BX", type_attr="Balance", weight_grams=6.6, attack_stat=70, defense_stat=85, stamina_stat=90, dash_stat=80, tier="S", description="9 puntos de contacto que reducen el riesgo de Burst y optimizan el peso centrifugo."),
        BeybladePart(code="R-560", name="5-60", category="ratchet", system="BX", type_attr="Defense", weight_grams=6.4, attack_stat=75, defense_stat=80, stamina_stat=85, dash_stat=75, tier="S", description="Perfil bajo de 60mm con 5 salientes equilibrados, el favorito de torneos."),
        BeybladePart(code="R-360", name="3-60", category="ratchet", system="BX", type_attr="Attack", weight_grams=6.2, attack_stat=85, defense_stat=65, stamina_stat=75, dash_stat=85, tier="A", description="Ideal para alinear las cuchillas de ataque de 3 lados como Shark Edge y Dran Sword."),
        BeybladePart(code="R-160", name="1-60", category="ratchet", system="UX", type_attr="Attack", weight_grams=6.1, attack_stat=95, defense_stat=50, stamina_stat=50, dash_stat=90, tier="A", description="Un solo punto excentrico diseñado para Dran Buster y golpes de poder unico."),
        BeybladePart(code="R-570", name="5-70", category="ratchet", system="UX", type_attr="Stamina", weight_grams=6.7, attack_stat=60, defense_stat=85, stamina_stat=92, dash_stat=70, tier="A", description="Altura de 70mm optimizada para Wizard Rod y defensas altas."),
        BeybladePart(code="R-470", name="4-70", category="ratchet", system="BX", type_attr="Balance", weight_grams=6.5, attack_stat=70, defense_stat=75, stamina_stat=78, dash_stat=75, tier="B", description="4 alas de proteccion media."),
        BeybladePart(code="R-380", name="3-80", category="ratchet", system="BX", type_attr="Stamina", weight_grams=7.1, attack_stat=50, defense_stat=70, stamina_stat=80, dash_stat=60, tier="C", description="Altura de 80mm para resistir ataques rasantes.")
    ]

    bits = [
        BeybladePart(code="B-B", name="Ball (B)", category="bit", system="BX", type_attr="Stamina", weight_grams=2.2, attack_stat=30, defense_stat=80, stamina_stat=98, dash_stat=40, tier="S", description="Punta esferica con maxima inercia y resistencia a los choques."),
        BeybladePart(code="B-DB", name="Disc Ball (DB)", category="bit", system="UX", type_attr="Stamina", weight_grams=2.5, attack_stat=35, defense_stat=88, stamina_stat=99, dash_stat=45, tier="S", description="Disco estabilizador anti-inclinacion y resistencia superior."),
        BeybladePart(code="B-GF", name="Gear Flat (GF)", category="bit", system="BX", type_attr="Attack", weight_grams=2.4, attack_stat=98, defense_stat=30, stamina_stat=35, dash_stat=99, tier="S", description="Engranajes extendidos en la punta para Xtreme Dash supersonicos."),
        BeybladePart(code="B-LF", name="Low Flat (LF)", category="bit", system="BX", type_attr="Attack", weight_grams=2.2, attack_stat=95, defense_stat=35, stamina_stat=40, dash_stat=92, tier="A", description="Punta plana rebajada para trayectorias agresivas y upper hits."),
        BeybladePart(code="B-F", name="Flat (F)", category="bit", system="BX", type_attr="Attack", weight_grams=2.1, attack_stat=90, defense_stat=40, stamina_stat=45, dash_stat=88, tier="A", description="La punta clasica de ataque de alta velocidad."),
        BeybladePart(code="B-P", name="Point (P)", category="bit", system="BX", type_attr="Balance", weight_grams=2.3, attack_stat=70, defense_stat=70, stamina_stat=75, dash_stat=75, tier="A", description="Centro de resistencia con borde de ataque Xtreme."),
        BeybladePart(code="B-GP", name="Gear Point (GP)", category="bit", system="BX", type_attr="Balance", weight_grams=2.4, attack_stat=75, defense_stat=68, stamina_stat=72, dash_stat=85, tier="A", description="Version engranada de Point para aceleraciones repentinas."),
        BeybladePart(code="B-H", name="Hexa (H)", category="bit", system="UX", type_attr="Defense", weight_grams=2.6, attack_stat=45, defense_stat=94, stamina_stat=80, dash_stat=55, tier="A", description="Base hexagonal con alta resistencia al Burst y gran amortiguacion."),
        BeybladePart(code="B-O", name="Orb (O)", category="bit", system="BX", type_attr="Stamina", weight_grams=2.2, attack_stat=35, defense_stat=75, stamina_stat=90, dash_stat=45, tier="B", description="Punta esferica compacta para giro estable en el centro.")
    ]

    for p in blades + ratchets + bits:
        db.add(p)
    db.commit()

    # 3. Decks
    deck_admin = BladerDeck(
        user_id=admin.id,
        name="Deck Campeon Jan Kraft",
        description="Deck 3on3 optimizado para control de Xtreme Line y resistencia pura.",
        slot1_name="Phoenix Wing 9-60 GF",
        slot1_blade_id=blades[0].id,
        slot1_ratchet_id=ratchets[0].id,
        slot1_bit_id=bits[2].id,
        slot2_name="Wizard Rod 5-70 DB",
        slot2_blade_id=blades[1].id,
        slot2_ratchet_id=ratchets[4].id,
        slot2_bit_id=bits[1].id,
        slot3_name="Shark Edge 3-60 LF",
        slot3_blade_id=blades[3].id,
        slot3_ratchet_id=ratchets[2].id,
        slot3_bit_id=bits[3].id,
        total_weight=132.8
    )
    db.add(deck_admin)
    db.commit()

    # 4. Tournaments
    t1 = Tournament(
        slug="copa-nacional-beyblade-x-panama-2026",
        title="Gran Copa Nacional Beyblade X - Panama 2026",
        description="Torneo oficial clasificatorio al Campeonato Latinoamericano. Formato 3on3 Deck, Fase Suiza de 4 rondas + Top 8 Cut en Xtreme Stadium.",
        organizer_id=admin.id,
        format="swiss",
        battle_type="3on3_deck",
        match_target_points=4,
        stadium_type="Xtreme Stadium (BX-10)",
        max_participants=16,
        entry_fee_ap=50,
        prize_pool_ap=2500,
        status="in_progress",
        venue_name="Arena Beyblade Panama - Albrook Mall",
        venue_address="Albrook Mall, Pasillo del Koala, Local B-12",
        country="PA",
        start_date=datetime.datetime.utcnow(),
        current_round=1,
        total_rounds=4,
        is_official=True
    )
    db.add(t1)
    db.commit()

    t2 = Tournament(
        slug="torneo-relampago-xtreme-dash-mexico",
        title="Torneo Relampago Xtreme Dash CDMX",
        description="Torneo rapido de eliminacion directa 1on1 al mejor de 3 puntos.",
        organizer_id=organizer.id,
        format="single_elim",
        battle_type="1on1",
        match_target_points=3,
        stadium_type="Xtreme Stadium (BX-10)",
        max_participants=8,
        entry_fee_ap=30,
        prize_pool_ap=800,
        status="registration_open",
        venue_name="Frikiplaza Eje Central",
        venue_address="Eje Central Lazaro Cardenas 9, CDMX",
        country="MX",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=2),
        current_round=0,
        total_rounds=3,
        is_official=True
    )
    db.add(t2)
    db.commit()

    sample_bladers = [admin] + bladers[:7]
    for idx, u in enumerate(sample_bladers):
        part = TournamentParticipant(
            tournament_id=t1.id,
            user_id=u.id,
            seed=idx + 1,
            checked_in=True,
            checked_in_at=datetime.datetime.utcnow()
        )
        db.add(part)
    db.commit()

    matches = [
        TournamentMatch(
            tournament_id=t1.id,
            round_number=1,
            stage="swiss",
            bracket_position=1,
            station_number=1,
            player_a_id=sample_bladers[0].id,
            player_b_id=sample_bladers[1].id,
            score_a=3,
            score_b=2,
            referee_id=referee.id,
            status="in_progress"
        ),
        TournamentMatch(
            tournament_id=t1.id,
            round_number=1,
            stage="swiss",
            bracket_position=2,
            station_number=2,
            player_a_id=sample_bladers[2].id,
            player_b_id=sample_bladers[3].id,
            score_a=4,
            score_b=1,
            winner_id=sample_bladers[2].id,
            referee_id=referee.id,
            status="finished"
        ),
        TournamentMatch(
            tournament_id=t1.id,
            round_number=1,
            stage="swiss",
            bracket_position=3,
            station_number=3,
            player_a_id=sample_bladers[4].id,
            player_b_id=sample_bladers[5].id,
            score_a=0,
            score_b=0,
            status="calling"
        ),
        TournamentMatch(
            tournament_id=t1.id,
            round_number=1,
            stage="swiss",
            bracket_position=4,
            station_number=4,
            player_a_id=sample_bladers[6].id,
            player_b_id=sample_bladers[7].id,
            score_a=0,
            score_b=0,
            status="pending"
        )
    ]
    for m in matches:
        db.add(m)
    db.commit()

    g1 = MatchGame(match_id=matches[0].id, game_order=1, finish_type="spin_finish_1p", awarded_to="player_a", points=1, notes="Phoenix Wing desgasta a Shark Edge")
    g2 = MatchGame(match_id=matches[0].id, game_order=2, finish_type="over_finish_2p", awarded_to="player_b", points=2, notes="Shark Edge aprovecha Over Zone")
    g3 = MatchGame(match_id=matches[0].id, game_order=3, finish_type="over_finish_2p", awarded_to="player_a", points=2, notes="Phoenix Wing contraataca con Xtreme Dash")
    db.add(g1)
    db.add(g2)
    db.add(g3)

    g4 = MatchGame(match_id=matches[1].id, game_order=1, finish_type="spin_finish_1p", awarded_to="player_b", points=1)
    g5 = MatchGame(match_id=matches[1].id, game_order=2, finish_type="xtreme_finish_3p", awarded_to="player_a", points=3, notes="Valkyrie ejecuta un Xtreme Dash fulminante de 3 puntos!")
    g6 = MatchGame(match_id=matches[1].id, game_order=3, finish_type="spin_finish_1p", awarded_to="player_a", points=1)
    db.add(g4)
    db.add(g5)
    db.add(g6)
    db.commit()

    # 5. Season & Hall of Fame
    season = Season(
        name="Temporada 2026 - Circuito Latinoamericano X",
        is_active=True,
        description="Circuito anual clasificatorio al World Beyblade Championship"
    )
    db.add(season)
    db.commit()

    for u in all_users:
        calc_points = (u.elo_rating - 1000) * 3
        sr = SeasonRanking(
            season_id=season.id,
            user_id=u.id,
            points=calc_points,
            elo=u.elo_rating,
            tournaments_played=4,
            tournaments_won=2 if u.id == admin.id else 0,
            podium_finishes=3 if u.id in [admin.id, bladers[0].id] else 1,
            matches_won=8,
            matches_lost=2
        )
        db.add(sr)
    db.commit()

    hof1 = HallOfFame(
        year=2025,
        title="Campeon Latinoamericano Inaugural Beyblade X",
        user_id=admin.id,
        tournament_name="Pan-American Xtreme Open 2025",
        signature_deck="Phoenix Wing 9-60 GF / Wizard Rod 5-70 DB / Dran Buster 1-60 F",
        trophy_icon="trophy-gold",
        notes="Campeon invicto con un record de 12-0 en el torneo internacional."
    )
    hof2 = HallOfFame(
        year=2025,
        title="Maestro del Xtreme Dash",
        user_id=bladers[0].id,
        tournament_name="Copa de Otono Shark Attack",
        signature_deck="Shark Edge 3-60 LF / Cobalt Dragoon 1-60 E / Tyranno Beat 4-70 Q",
        trophy_icon="trophy-silver",
        notes="Record del mayor numero de Xtreme Finishes (18) en un solo fin de semana."
    )
    db.add(hof1)
    db.add(hof2)
    db.commit()

    # 6. Community Posts
    p1 = CommunityPost(
        user_id=admin.id,
        content="Bienvenidos a la nueva plataforma de **AppBey 2.0**. Hemos redisenado por completo el motor de torneos, constructor de decks y marcador de arbitraje tactil.",
        likes_count=24,
        comments_count=2
    )
    p2 = CommunityPost(
        user_id=bladers[1].id,
        content="Cual consideran que es el mejor Bit para Wizard Rod actualmente? He testeado Disc Ball (DB) vs Ball (B) y la estabilidad contra choques laterales es increible.",
        likes_count=18,
        comments_count=1
    )
    db.add(p1)
    db.add(p2)
    db.commit()

    c1 = PostComment(post_id=p1.id, user_id=bladers[0].id, content="Excelente actualizacion! El marcador tactil en tiempo real va a acelerar muchisimo los combates en mesa.")
    c2 = PostComment(post_id=p1.id, user_id=organizer.id, content="Listos para proyectar el bracket en las pantallas de la arena.")
    c3 = PostComment(post_id=p2.id, user_id=admin.id, content="Disc Ball 100% recomendado con 5-70 para prevenir rozamientos en el piso del estadio.")
    db.add(c1)
    db.add(c2)
    db.add(c3)
    db.commit()

    # 7. Notifications
    n1 = Notification(
        user_id=admin.id,
        notif_type="match_call",
        title="Llamado a Combate",
        message="Mesa 1: Jan Kraft vs Ryu Kusanagi esta en progreso.",
        link="#/tournaments/1"
    )
    db.add(n1)
    db.commit()

    print("AppBey 2.0 Database seeded successfully!")
