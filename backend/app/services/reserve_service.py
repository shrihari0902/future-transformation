import uuid
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.crypto import sign_bank_payload
from app.models import (
    User, Wallet, Device, Reserve, AllowanceCertificate, LedgerEntry, RiskTier, AuditLog
)
from app.schemas import ReserveCreateRequest


def create_wallet_reserve(db: Session, user: User, req: ReserveCreateRequest):
    """
    Creates an offline reserve and issues a cryptographically signed Allowance Certificate.
    Deducts available balance into reserved balance and creates immutable ledger entry.
    """
    # 1. Fetch and validate wallet
    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).with_for_update().first()
    if not wallet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")

    if req.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reserve amount must be positive")

    if wallet.available_balance < req.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient available balance ({wallet.available_balance} paise available, requested {req.amount} paise)"
        )

    # 2. Check Risk Tier limits
    risk_tier = user.risk_tier
    if not risk_tier:
        risk_tier = db.query(RiskTier).filter(RiskTier.name == "Medium Risk").first()
        if not risk_tier:
            risk_tier = db.query(RiskTier).first()

    if risk_tier and req.amount > risk_tier.max_reserve_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested reserve exceeds {risk_tier.name} limit of {risk_tier.max_reserve_amount} paise."
        )

    # 3. Verify device belongs to user
    device = db.query(Device).filter(
        Device.device_id == req.device_id,
        Device.user_id == user.id,
        Device.is_active == True
    ).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Device '{req.device_id}' is not registered or not active for this user."
        )

    # 4. Atomic balance lock
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7)

    available_before = wallet.available_balance
    wallet.available_balance -= req.amount
    wallet.reserved_balance += req.amount
    available_after = wallet.available_balance

    # 5. Ledger entry
    reserve_id = str(uuid.uuid4())
    cert_id = str(uuid.uuid4())

    ledger = LedgerEntry(
        wallet_id=wallet.id,
        entry_type="RESERVE_LOCK",
        amount=-req.amount,
        balance_before=available_before,
        balance_after=available_after,
        reference_type="RESERVE",
        reference_id=reserve_id,
        description=f"Locked {req.amount} paise into offline reserve {reserve_id[:8]}",
        created_at=now
    )
    db.add(ledger)

    # 6. Create Reserve
    reserve = Reserve(
        reserve_id=reserve_id,
        wallet_id=wallet.id,
        user_id=user.id,
        amount=req.amount,
        remaining_allowance=req.amount,
        status="ACTIVE",
        created_at=now,
        expires_at=expires_at
    )
    db.add(reserve)
    db.flush()

    # 7. Construct & digitally sign Allowance Certificate
    max_payment = risk_tier.max_per_payment_limit if risk_tier else req.amount
    cert_payload = {
        "certificate_id": cert_id,
        "device_id": req.device_id,
        "payer_user_id": user.id,
        "reserve_amount": req.amount,
        "max_per_payment": max_payment,
        "issued_at": now.isoformat(),
        "expires_at": expires_at.isoformat()
    }

    bank_sig = sign_bank_payload(cert_payload)

    certificate = AllowanceCertificate(
        certificate_id=cert_id,
        reserve_id=reserve.id,
        user_id=user.id,
        device_id=req.device_id,
        reserve_amount=req.amount,
        max_per_payment=max_payment,
        issued_at=now,
        expires_at=expires_at,
        signature=bank_sig,
        raw_payload_json=json.dumps(cert_payload)
    )
    db.add(certificate)

    # Audit log
    audit = AuditLog(
        action="RESERVE_CREATED",
        actor_id=user.id,
        entity_type="RESERVE",
        entity_id=reserve_id,
        details_json=json.dumps({"amount": req.amount, "certificate_id": cert_id}),
        created_at=now
    )
    db.add(audit)

    db.commit()
    db.refresh(reserve)

    return reserve, certificate
