import uuid
from datetime import date
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.saas import Tenant, Plan, Suscripcion
from app.models.sucursal import Sucursal


class SubscriptionService:
    """
    Servicio de control y aplicación de reglas de negocio para Suscripciones SaaS (RN03, RN04, RN05, RF07, RF59).
    """

    @staticmethod
    def get_active_subscription(tenant_id: uuid.UUID, db: Session) -> Optional[Suscripcion]:
        return (
            db.query(Suscripcion)
            .join(Plan, Suscripcion.plan_id == Plan.id)
            .filter(
                Suscripcion.tenant_id == tenant_id,
                Suscripcion.estado == "ACTIVA"
            )
            .first()
        )

    @staticmethod
    def verificar_limite_sucursales(tenant_id: uuid.UUID, db: Session) -> None:
        """
        RN04 / RF07: El número de sucursales activas no puede superar el límite del plan.
        Plan Básico: máximo 2 sucursales.
        Plan Profesional: máximo 10 sucursales.
        """
        sub = SubscriptionService.get_active_subscription(tenant_id, db)
        if not sub or not sub.plan:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="La empresa no cuenta con un plan de suscripción activo."
            )

        max_permitidas = sub.plan.max_sucursales
        activas_actuales = (
            db.query(func.count(Sucursal.id))
            .filter(
                Sucursal.tenant_id == tenant_id,
                Sucursal.activo == True
            )
            .scalar() or 0
        )

        if activas_actuales >= max_permitidas:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Límite de sucursales alcanzado ({activas_actuales}/{max_permitidas}). "
                    f"El plan '{sub.plan.nombre}' permite un máximo de {max_permitidas} sucursales activas (RN04). "
                    "Actualice a un plan superior para registrar más sucursales."
                )
            )

    @staticmethod
    def exigir_reportes_ia(tenant_id: uuid.UUID, db: Session) -> None:
        """
        RN23 / RF59 / CU28: El acceso al módulo de Reportes con IA (Gemini NLP)
        está reservado exclusivamente para planes con 'permite_reportes_ia = True' (Profesional).
        """
        sub = SubscriptionService.get_active_subscription(tenant_id, db)
        if not sub or not sub.plan or not sub.plan.permite_reportes_ia:
            plan_nom = sub.plan.nombre if (sub and sub.plan) else "Ninguno"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Acceso denegado a Reportes con Inteligencia Artificial. "
                    f"Tu plan actual ('{plan_nom}') no incluye esta característica. "
                    "Se requiere el Plan 'Profesional' para consultar métricas con IA (RN23)."
                )
            )
