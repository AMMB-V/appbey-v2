from typing import Dict, List
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger("appbey_ws")

class ConnectionManager:
    def __init__(self):
        self.tournament_rooms: Dict[int, List[WebSocket]] = {}
        self.user_sockets: Dict[int, List[WebSocket]] = {}
        self.global_sockets: List[WebSocket] = []

    async def connect_global(self, websocket: WebSocket):
        await websocket.accept()
        self.global_sockets.append(websocket)

    def disconnect_global(self, websocket: WebSocket):
        if websocket in self.global_sockets:
            self.global_sockets.remove(websocket)

    async def connect_tournament(self, tournament_id: int, websocket: WebSocket):
        await websocket.accept()
        if tournament_id not in self.tournament_rooms:
            self.tournament_rooms[tournament_id] = []
        self.tournament_rooms[tournament_id].append(websocket)

    def disconnect_tournament(self, tournament_id: int, websocket: WebSocket):
        if tournament_id in self.tournament_rooms and websocket in self.tournament_rooms[tournament_id]:
            self.tournament_rooms[tournament_id].remove(websocket)

    async def broadcast_tournament(self, tournament_id: int, event_type: str, data: dict):
        payload = json.dumps({"event": event_type, "tournament_id": tournament_id, "data": data})
        if tournament_id in self.tournament_rooms:
            dead_sockets = []
            for ws in self.tournament_rooms[tournament_id]:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead_sockets.append(ws)
            for ws in dead_sockets:
                self.tournament_rooms[tournament_id].remove(ws)
        
        dead_globals = []
        for ws in self.global_sockets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead_globals.append(ws)
        for ws in dead_globals:
            self.global_sockets.remove(ws)

ws_manager = ConnectionManager()
