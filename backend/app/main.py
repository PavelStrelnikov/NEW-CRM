"""
Main FastAPI application entry point.
"""
from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db

# Create FastAPI application
app = FastAPI(
    title="CRM System API",
    description="CRM system for IT service companies managing CCTV, network, and IT equipment",
    version="1.0.0",
    debug=settings.DEBUG
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "CRM System API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint that verifies:
    - API is running
    - Database connection is working
    """
    try:
        # Test database connectivity
        result = db.execute(text("SELECT 1")).scalar()

        return {
            "status": "healthy",
            "database": "connected" if result == 1 else "error",
            "debug_mode": settings.DEBUG
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }


# Import and register API routers
from app.api import auth, clients, sites, contacts, locations, tickets, assets, reports, attachments, admin, projects, audit

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(clients.router, prefix="/api/v1/clients", tags=["Clients"])
app.include_router(sites.router, prefix="/api/v1", tags=["Sites"])
app.include_router(contacts.router, prefix="/api/v1", tags=["Contacts"])
app.include_router(locations.router, prefix="/api/v1", tags=["Locations"])
app.include_router(tickets.router, prefix="/api/v1", tags=["Tickets"])
app.include_router(assets.router, prefix="/api/v1", tags=["Assets"])
app.include_router(projects.router, prefix="/api/v1", tags=["Projects"])
app.include_router(reports.router, prefix="/api/v1", tags=["Reports"])
app.include_router(attachments.router, prefix="/api/v1", tags=["Attachments"])
app.include_router(admin.router, prefix="/api/v1", tags=["Admin"])
app.include_router(audit.router, prefix="/api/v1", tags=["Audit"])
