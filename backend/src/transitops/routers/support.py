"""Tier-2: alerts, notifications, audit log (contract §8)."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from transitops.core.database import get_db
from transitops.core.errors import NotFound
from transitops.core.pagination import ListParams, apply_sort, list_params, paginate
from transitops.core.rbac import get_current_user, require_admin, require_compliance_write
from transitops.models.alert import Alert
from transitops.models.audit_log import AuditLog
from transitops.models.enums import AlertSeverity, AlertStatus, AlertType
from transitops.models.notification import Notification
from transitops.models.user import User
from transitops.schemas.common import Page
from transitops.schemas.support import AlertOut, AuditLogOut, NotificationOut

router = APIRouter(tags=["alerts & audit"])

ALERT_SORTABLE = {"created_at": Alert.created_at, "severity": Alert.severity, "type": Alert.type}
AUDIT_SORTABLE = {"created_at": AuditLog.created_at, "action": AuditLog.action}


@router.get("/alerts", response_model=Page[AlertOut])
def list_alerts(
    params: ListParams = Depends(list_params),
    status_: AlertStatus | None = Query(None, alias="status"),
    type_: AlertType | None = Query(None, alias="type"),
    severity: AlertSeverity | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Alert)
    if status_:
        stmt = stmt.where(Alert.status == status_)
    if type_:
        stmt = stmt.where(Alert.type == type_)
    if severity:
        stmt = stmt.where(Alert.severity == severity)
    if params.q:
        stmt = stmt.where(Alert.title.ilike(f"%{params.q.strip()}%"))
    stmt = apply_sort(stmt, params.sort, ALERT_SORTABLE, default="-created_at")
    return paginate(db, stmt, params)


@router.post("/alerts/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(
    alert_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_compliance_write),
):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise NotFound("Alert", alert_id)

    alert.status = AlertStatus.ACKNOWLEDGED
    db.commit()
    db.refresh(alert)
    return alert


@router.get("/notifications", response_model=Page[NotificationOut])
def list_notifications(
    params: ListParams = Depends(list_params),
    is_read: bool | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Always scoped to the caller — one user can never read another's notifications."""
    stmt = select(Notification).where(Notification.user_id == user.id)
    if is_read is not None:
        stmt = stmt.where(Notification.is_read == is_read)
    stmt = stmt.order_by(Notification.created_at.desc())
    return paginate(db, stmt, params)


@router.post("/notifications/read-all", status_code=200)
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    result = db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.commit()
    return {"marked_read": result.rowcount or 0}


@router.get("/audit-logs", response_model=Page[AuditLogOut])
def list_audit_logs(
    params: ListParams = Depends(list_params),
    action: str | None = None,
    entity_name: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity_name:
        stmt = stmt.where(AuditLog.entity_name == entity_name)
    stmt = apply_sort(stmt, params.sort, AUDIT_SORTABLE, default="-created_at")
    return paginate(db, stmt, params)
