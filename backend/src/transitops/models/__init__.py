"""Import every model so Base.metadata is fully populated (Alembic autogenerate + relationship
string resolution both depend on this module having been imported before use)."""

from transitops.core.database import Base
from transitops.models.alert import Alert
from transitops.models.audit_log import AuditLog
from transitops.models.document import DriverDocument, VehicleDocument
from transitops.models.driver import Driver
from transitops.models.expense import Expense
from transitops.models.fuel_log import FuelLog
from transitops.models.maintenance_log import MaintenanceLog
from transitops.models.notification import Notification
from transitops.models.role import Role
from transitops.models.trip import Trip
from transitops.models.user import User
from transitops.models.vehicle import Vehicle

__all__ = [
    "Base",
    "Role",
    "User",
    "Vehicle",
    "Driver",
    "Trip",
    "MaintenanceLog",
    "FuelLog",
    "Expense",
    "Alert",
    "Notification",
    "AuditLog",
    "VehicleDocument",
    "DriverDocument",
]
