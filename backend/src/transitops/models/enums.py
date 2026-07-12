import enum


class RoleName(str, enum.Enum):
    FLEET_MANAGER = "fleet_manager"
    DISPATCHER = "dispatcher"
    SAFETY_OFFICER = "safety_officer"
    FINANCIAL_ANALYST = "financial_analyst"


class VehicleType(str, enum.Enum):
    TRUCK = "truck"
    VAN = "van"
    MINI = "mini"
    BUS = "bus"


class VehicleStatus(str, enum.Enum):
    AVAILABLE = "available"
    ON_TRIP = "on_trip"
    IN_SHOP = "in_shop"
    RETIRED = "retired"


class LicenseCategory(str, enum.Enum):
    LMV = "LMV"
    HMV = "HMV"
    TRANS = "TRANS"


class DriverStatus(str, enum.Enum):
    AVAILABLE = "available"
    ON_TRIP = "on_trip"
    OFF_DUTY = "off_duty"
    SUSPENDED = "suspended"


class TripStatus(str, enum.Enum):
    DRAFT = "draft"
    DISPATCHED = "dispatched"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MaintenanceType(str, enum.Enum):
    SERVICE = "service"
    REPAIR = "repair"
    INSPECTION = "inspection"
    OIL_CHANGE = "oil_change"
    TYRES = "tyres"


class MaintenanceStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class ExpenseType(str, enum.Enum):
    TOLL = "toll"
    PARKING = "parking"
    FINE = "fine"
    MISC = "misc"


class AlertType(str, enum.Enum):
    LICENSE_EXPIRY = "license_expiry"
    DOC_EXPIRY = "doc_expiry"
    MAINTENANCE_DUE = "maintenance_due"
    TRIP_ANOMALY = "trip_anomaly"


class AlertSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertStatus(str, enum.Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"


class AlertEntityType(str, enum.Enum):
    """What an alert's entity_id points at — alerts are polymorphic (03_SCHEMA.md §4)."""

    VEHICLE = "vehicle"
    DRIVER = "driver"
    VEHICLE_DOCUMENT = "vehicle_document"
    DRIVER_DOCUMENT = "driver_document"


class DocumentType(str, enum.Enum):
    # vehicle documents
    REGISTRATION_CERTIFICATE = "registration_certificate"
    INSURANCE = "insurance"
    PERMIT = "permit"
    PUC = "puc"
    FITNESS_CERTIFICATE = "fitness_certificate"
    # driver documents
    DRIVING_LICENSE = "driving_license"
    MEDICAL_CERTIFICATE = "medical_certificate"
    BADGE = "badge"


class DocumentStatus(str, enum.Enum):
    VALID = "valid"
    EXPIRING_SOON = "expiring_soon"
    EXPIRED = "expired"
