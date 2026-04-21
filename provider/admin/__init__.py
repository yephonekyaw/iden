from fastapi import APIRouter

from admin.clients.routes import router as clients_router

router = APIRouter(prefix="/admin", tags=["admin"])
router.include_router(clients_router)
