"""Tier-2 support resources: alerts, notifications, audit logs (contract §8)."""

import uuid
from datetime import datetime

from transitops.models.enums import AlertEntityType, AlertSeverity, AlertStatus, AlertType
from transitops.schemas.common import ORMModel


class AlertOut(ORMModel):
    id: uuid.UUID
    type: AlertType
    severity: AlertSeverity
    title: str
    entity_type: AlertEntityType
    entity_id: uuid.UUID
    status: AlertStatus
    created_at: datetime


class NotificationOut(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    is_read: bool
    created_at: datetime


class AuditLogOut(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    action: str
    entity_name: str
    entity_id: uuid.UUID
    payload: dict | None
    created_at: datetime
