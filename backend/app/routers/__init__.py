from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.beyblades import router as beyblades_router
from app.routers.tournaments import router as tournaments_router
from app.routers.matches import router as matches_router
from app.routers.wallets import router as wallets_router
from app.routers.rankings import router as rankings_router
from app.routers.social import router as social_router
from app.routers.websockets import router as websockets_router

__all__ = [
    "auth_router",
    "users_router",
    "beyblades_router",
    "tournaments_router",
    "matches_router",
    "wallets_router",
    "rankings_router",
    "social_router",
    "websockets_router"
]
