import math
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.tournament import Tournament, TournamentParticipant, TournamentMatch, MatchGame
from app.models.user import User
from app.services.elo_service import EloService
from app.services.wallet_service import WalletService

class TournamentEngine:
    @staticmethod
    def generate_single_elimination_bracket(db: Session, tournament: Tournament):
        participants = db.query(TournamentParticipant).filter(
            TournamentParticipant.tournament_id == tournament.id,
            TournamentParticipant.checked_in == True
        ).order_by(TournamentParticipant.seed.asc()).all()

        n = len(participants)
        if n < 2:
            raise HTTPException(status_code=400, detail="Se requieren al menos 2 participantes confirmados (checked-in)")

        bracket_size = 1
        while bracket_size < n:
            bracket_size *= 2

        total_rounds = int(math.log2(bracket_size))
        tournament.total_rounds = total_rounds
        tournament.current_round = 1
        tournament.status = "in_progress"

        part_map = {i: participants[i] for i in range(n)}
        matches_count = bracket_size // 2
        for pos in range(matches_count):
            p1_idx = pos
            p2_idx = bracket_size - 1 - pos
            
            p1 = part_map.get(p1_idx)
            p2 = part_map.get(p2_idx)

            p1_id = p1.user_id if p1 else None
            p2_id = p2.user_id if p2 else None
            is_bye = (p1_id is None) or (p2_id is None)
            winner_id = p1_id if (p2_id is None and p1_id) else (p2_id if (p1_id is None and p2_id) else None)
            match_status = "finished" if is_bye else "pending"

            match = TournamentMatch(
                tournament_id=tournament.id,
                round_number=1,
                stage="Round 1",
                bracket_position=pos + 1,
                station_number=(pos % 4) + 1,
                player_a_id=p1_id,
                player_b_id=p2_id,
                winner_id=winner_id,
                status=match_status,
                is_bye=is_bye
            )
            db.add(match)
        
        db.commit()

    @staticmethod
    def generate_next_swiss_round(db: Session, tournament: Tournament) -> int:
        participants = db.query(TournamentParticipant).filter(
            TournamentParticipant.tournament_id == tournament.id,
            TournamentParticipant.checked_in == True
        ).all()

        if len(participants) < 2:
            raise HTTPException(status_code=400, detail="Participantes insuficientes para ronda Suiza")

        next_round = tournament.current_round + 1
        if next_round > tournament.total_rounds:
            tournament.status = "completed"
            TournamentEngine.finalize_tournament_rankings(db, tournament)
            db.commit()
            return tournament.current_round

        past_matches = db.query(TournamentMatch).filter(
            TournamentMatch.tournament_id == tournament.id
        ).all()
        played_pairs = set()
        for m in past_matches:
            if m.player_a_id and m.player_b_id:
                played_pairs.add((min(m.player_a_id, m.player_b_id), max(m.player_a_id, m.player_b_id)))

        participants.sort(key=lambda p: (p.swiss_points, p.buchholz, (p.points_scored - p.points_conceded)), reverse=True)

        unpaired = list(participants)
        pairings: List[Tuple[Optional[TournamentParticipant], Optional[TournamentParticipant]]] = []

        while len(unpaired) > 1:
            p1 = unpaired.pop(0)
            found_opponent = None
            for idx, p2 in enumerate(unpaired):
                pair_key = (min(p1.user_id, p2.user_id), max(p1.user_id, p2.user_id))
                if pair_key not in played_pairs:
                    found_opponent = unpaired.pop(idx)
                    break
            
            if not found_opponent:
                found_opponent = unpaired.pop(0)

            pairings.append((p1, found_opponent))

        if unpaired:
            p_bye = unpaired.pop(0)
            pairings.append((p_bye, None))

        for idx, (pa, pb) in enumerate(pairings):
            is_bye = (pb is None)
            match = TournamentMatch(
                tournament_id=tournament.id,
                round_number=next_round,
                stage="swiss",
                bracket_position=idx + 1,
                station_number=(idx % 4) + 1,
                player_a_id=pa.user_id if pa else None,
                player_b_id=pb.user_id if pb else None,
                score_a=tournament.match_target_points if is_bye else 0,
                score_b=0,
                winner_id=pa.user_id if is_bye else None,
                status="finished" if is_bye else "pending",
                is_bye=is_bye
            )
            if is_bye and pa:
                pa.swiss_points += 3
                pa.matches_won += 1
                pa.matches_played += 1
            db.add(match)

        tournament.current_round = next_round
        tournament.status = "in_progress"
        db.commit()
        return next_round

    @staticmethod
    def record_match_game(db: Session, match_id: int, finish_type: str, awarded_to: str, notes: str = None) -> TournamentMatch:
        match = db.query(TournamentMatch).filter(TournamentMatch.id == match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail="Match no encontrado")

        points_table = {
            "spin_finish_1p": 1,
            "over_finish_2p": 2,
            "burst_finish_2p": 2,
            "xtreme_finish_3p": 3,
            "penalty_1p": 1,
            "draw_0p": 0
        }
        pts = points_table.get(finish_type, 1)

        game_order = len(match.games) + 1
        game = MatchGame(
            match_id=match.id,
            game_order=game_order,
            finish_type=finish_type,
            awarded_to=awarded_to,
            points=pts,
            notes=notes
        )
        db.add(game)

        if awarded_to == "player_a":
            match.score_a += pts
        elif awarded_to == "player_b":
            match.score_b += pts

        target = match.tournament.match_target_points
        if match.score_a >= target or match.score_b >= target:
            match.status = "finished"
            if match.score_a > match.score_b:
                match.winner_id = match.player_a_id
            elif match.score_b > match.score_a:
                match.winner_id = match.player_b_id

            TournamentEngine.update_participant_stats_after_match(db, match)
            if match.player_a_id and match.player_b_id and match.winner_id:
                EloService.update_ratings_after_match(db, match.player_a_id, match.player_b_id, match.winner_id)

            if match.tournament.format == "single_elim":
                TournamentEngine.advance_single_elimination(db, match)
        else:
            match.status = "in_progress"

        db.commit()
        db.refresh(match)
        return match

    @staticmethod
    def update_participant_stats_after_match(db: Session, match: TournamentMatch):
        t_id = match.tournament_id
        pa_part = db.query(TournamentParticipant).filter(
            TournamentParticipant.tournament_id == t_id,
            TournamentParticipant.user_id == match.player_a_id
        ).first()
        pb_part = db.query(TournamentParticipant).filter(
            TournamentParticipant.tournament_id == t_id,
            TournamentParticipant.user_id == match.player_b_id
        ).first()

        if pa_part:
            pa_part.matches_played += 1
            pa_part.points_scored += match.score_a
            pa_part.points_conceded += match.score_b
            if match.winner_id == pa_part.user_id:
                pa_part.matches_won += 1
                pa_part.swiss_points += 3
            elif match.winner_id is None:
                pa_part.matches_drawn += 1
                pa_part.swiss_points += 1
            else:
                pa_part.matches_lost += 1

        if pb_part:
            pb_part.matches_played += 1
            pb_part.points_scored += match.score_b
            pb_part.points_conceded += match.score_a
            if match.winner_id == pb_part.user_id:
                pb_part.matches_won += 1
                pb_part.swiss_points += 3
            elif match.winner_id is None:
                pb_part.matches_drawn += 1
                pb_part.swiss_points += 1
            else:
                pb_part.matches_lost += 1

        all_parts = db.query(TournamentParticipant).filter(TournamentParticipant.tournament_id == t_id).all()
        part_by_user = {p.user_id: p for p in all_parts}
        
        matches = db.query(TournamentMatch).filter(TournamentMatch.tournament_id == t_id, TournamentMatch.status == "finished").all()
        opponents = {p.user_id: [] for p in all_parts}
        for m in matches:
            if m.player_a_id and m.player_b_id:
                opponents[m.player_a_id].append(m.player_b_id)
                opponents[m.player_b_id].append(m.player_a_id)

        for p in all_parts:
            opp_list = opponents.get(p.user_id, [])
            p.buchholz = sum(part_by_user[opp_id].swiss_points for opp_id in opp_list if opp_id in part_by_user)

    @staticmethod
    def advance_single_elimination(db: Session, match: TournamentMatch):
        tournament = match.tournament
        next_round_num = match.round_number + 1
        if next_round_num > tournament.total_rounds:
            tournament.status = "completed"
            tournament.winner_user_id = match.winner_id
            tournament.runner_up_user_id = match.player_b_id if match.winner_id == match.player_a_id else match.player_a_id
            TournamentEngine.distribute_prizes(db, tournament)
            return

        next_pos = (match.bracket_position + 1) // 2
        is_slot_a = (match.bracket_position % 2 == 1)

        next_match = db.query(TournamentMatch).filter(
            TournamentMatch.tournament_id == tournament.id,
            TournamentMatch.round_number == next_round_num,
            TournamentMatch.bracket_position == next_pos
        ).first()

        if not next_match:
            next_match = TournamentMatch(
                tournament_id=tournament.id,
                round_number=next_round_num,
                stage="Round " + str(next_round_num),
                bracket_position=next_pos,
                station_number=(next_pos % 4) + 1,
                status="pending"
            )
            db.add(next_match)

        if is_slot_a:
            next_match.player_a_id = match.winner_id
        else:
            next_match.player_b_id = match.winner_id

        if next_match.player_a_id and next_match.player_b_id:
            next_match.status = "pending"

    @staticmethod
    def finalize_tournament_rankings(db: Session, tournament: Tournament):
        parts = db.query(TournamentParticipant).filter(TournamentParticipant.tournament_id == tournament.id).all()
        parts.sort(key=lambda p: (p.swiss_points, p.buchholz, (p.points_scored - p.points_conceded)), reverse=True)
        
        for idx, p in enumerate(parts):
            p.final_rank = idx + 1
        
        if len(parts) >= 1:
            tournament.winner_user_id = parts[0].user_id
        if len(parts) >= 2:
            tournament.runner_up_user_id = parts[1].user_id
        if len(parts) >= 3:
            tournament.third_place_user_id = parts[2].user_id

        TournamentEngine.distribute_prizes(db, tournament)

    @staticmethod
    def distribute_prizes(db: Session, tournament: Tournament):
        pool = tournament.prize_pool_ap
        if pool <= 0:
            return

        p1_reward = int(pool * 0.60)
        p2_reward = int(pool * 0.25)
        p3_reward = int(pool * 0.15)

        if tournament.winner_user_id:
            WalletService.credit(db, tournament.winner_user_id, p1_reward, "tournament_prize", f"1er Lugar: {tournament.title}", str(tournament.id))
        if tournament.runner_up_user_id:
            WalletService.credit(db, tournament.runner_up_user_id, p2_reward, "tournament_prize", f"2do Lugar: {tournament.title}", str(tournament.id))
        if tournament.third_place_user_id:
            WalletService.credit(db, tournament.third_place_user_id, p3_reward, "tournament_prize", f"3er Lugar: {tournament.title}", str(tournament.id))
