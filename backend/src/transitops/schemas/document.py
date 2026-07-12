import uuid
from datetime import UTC, date, datetime

from transitops.models.enums import DocumentStatus, DocumentType
from transitops.schemas.common import ORMModel

EXPIRING_SOON_DAYS = 30


def _status_for(expiry_date: date) -> DocumentStatus:
    days_left = (expiry_date - datetime.now(UTC).date()).days
    if days_left < 0:
        return DocumentStatus.EXPIRED
    if days_left <= EXPIRING_SOON_DAYS:
        return DocumentStatus.EXPIRING_SOON
    return DocumentStatus.VALID


class VehicleDocumentOut(ORMModel):
    id: uuid.UUID
    document_type: DocumentType
    document_number: str | None
    expiry_date: date
    file_url: str | None
    status: DocumentStatus

    @classmethod
    def from_doc(cls, doc) -> "VehicleDocumentOut":
        return cls(
            id=doc.id,
            document_type=doc.document_type,
            document_number=doc.document_number,
            expiry_date=doc.expiry_date,
            file_url=doc.file_url,
            status=_status_for(doc.expiry_date),
        )


class DriverDocumentOut(ORMModel):
    id: uuid.UUID
    document_type: DocumentType
    document_number: str | None
    expiry_date: date
    file_url: str | None
    status: DocumentStatus

    @classmethod
    def from_doc(cls, doc) -> "DriverDocumentOut":
        return cls(
            id=doc.id,
            document_type=doc.document_type,
            document_number=doc.document_number,
            expiry_date=doc.expiry_date,
            file_url=doc.file_url,
            status=_status_for(doc.expiry_date),
        )
