from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API REST de Comercio Electrónico con Vestidores Virtuales AR y Asistencia IA para FashionStore",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuración de CORS para permitir conexiones desde Angular, móviles y web en la nube
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir las rutas de la API v1
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["General"])
def root():
    return {
        "message": "Bienvenido a la API REST de FashionStore",
        "docs": "/docs",
        "version": settings.VERSION,
        "status": "online"
    }


@app.get("/health", tags=["General"])
def health_check():
    return {"status": "ok"}
