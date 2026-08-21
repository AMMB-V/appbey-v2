from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.websocket_manager import ws_manager

router = APIRouter(tags=["WebSockets"])

@router.websocket("/ws/global")
async def websocket_global_endpoint(websocket: WebSocket):
    await ws_manager.connect_global(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_global(websocket)

@router.websocket("/ws/tournaments/{tournament_id}")
async def websocket_tournament_endpoint(websocket: WebSocket, tournament_id: int):
    await ws_manager.connect_tournament(tournament_id, websocket)
    try:
        while True:
            # Echo or process incoming ping
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_tournament(tournament_id, websocket)
