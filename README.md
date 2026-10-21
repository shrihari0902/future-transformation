# OfflinePay - Offline Payment System with Double-Spend Protection

A clean, humanized, and cryptographically verified offline payment system where one phone pays another with no network, and the bank settles the payment safely once connectivity returns. All balances and transactions are synthetic for demonstration purposes.

---

## 1. The Core Idea

Offline payments cannot fully prevent double-spending in real time because a payer can pay two shops before either device reconnects. The honest design implemented here:
1. **Bounds the bank's maximum loss in advance** via pre-funded **Offline Reserves**.
2. **Issues asymmetric Allowance Certificates** digitally signed by the bank's ECDSA P-256 private key.
3. **Creates offline payment tokens** signed in-browser via the native **Web Crypto API** with hardware/device keys.
4. **Performs client-side offline verification** on the payee terminal with zero network connectivity: validates bank signature, device signature, limits, expiration, and sequence counter.
5. **Returns signed merchant receipts** for customer non-repudiation.
6. **Settles idempotently on sync**, detecting conflicting claims (double-spend) and strictly bounding loss to the reserve balance.

---

## 2. Restructured Clean Backend Architecture

The backend folder structure has been cleanly organized for readability, simplicity, and maintainability:

```
backend/
├── api/                     # Clean API route endpoints
│   ├── analyst.py           # Flag queue & dispute decisions
│   ├── auth.py              # Login, registration, JWT tokens
│   ├── certificates.py      # Bank public key exposure & user certs
│   ├── deps.py              # Auth & role dependencies
│   ├── devices.py           # Device key registration
│   ├── disputes.py          # User dispute creation & listing
│   ├── risk.py              # Dynamic risk tiers & limit rules
│   ├── transactions.py      # Idempotent sync & ledger history
│   └── wallet.py            # Balances, offline reserves & demo funding
├── core/                    # Core system infrastructure
│   ├── config.py            # Environment settings & paths
│   ├── crypto.py            # ECDSA P-256, canonical JSON, IEEE P1363
│   ├── database.py          # SQLAlchemy engine (supports SQLite & MySQL)
│   └── security.py          # Bcrypt hashing & JWT handling
├── services/                # Financial business logic
│   ├── reserve_service.py   # Reserve locking & certificate signing
│   └── settlement_service.py# Idempotent settlement & double-spend detection
├── models.py                # Unified SQLAlchemy ORM models
├── schemas.py               # Clean Pydantic schemas
├── seed.py                  # Database seeder
├── main.py                  # FastAPI application entrypoint
└── app/                     # Backward-compatibility shims
```

---

## 3. Humanized, User-Friendly Frontend

The frontend has been rebuilt from the ground up to be simple, humanized, and intuitive:
- **Clean modern fintech design**: Inspired by Stripe, Revolut, and Apple Cash with soft surfaces, clear typography, and accessible visual hierarchy.
- **1-Click Demo Quick Logins**: Immediate access as Customer 1 (Payer), Customer 2 (Payer), Merchant (Payee), or Bank Analyst (Risk Operations).
- **Simulate Offline Toggle**: A dedicated pill in the top navigation bar allows toggling offline mode to test Web Crypto and IndexedDB air-gapped flows directly in the browser without cutting system Wi-Fi.
- **Wallet & Reserve**: Transparent breakdown of Available vs Locked Offline Reserve, with 1-click reserve locking.
- **Pay Offline**: Select active certificate, input payee and amount, sign token with browser Web Crypto key, and display QR code + 1-click copy bundle.
- **Receive Payment**: 10-point client-side cryptographic checklist with plain-language accept/reject verdicts and instant signed receipts.
- **Sync Queue & History**: Review queued offline transactions, sync with bank ledger, and test 10x idempotency.
- **Analyst Center**: Double-spend flag queue (with bounded loss guarantees) and dispute adjudication with attached evidence bundles.

---

## 4. Demo Accounts

All seeded demo accounts use the default password: `DemoPass123!`.

| Role | Username | Initial Balance | Purpose |
|---|---|---|---|
| Customer 1 | `customer1` | ₹10,000.00 | Lock reserve & send offline payments |
| Customer 2 | `customer2` | ₹10,000.00 | Second payer for peer payments & double-spend demo |
| Merchant | `merchant` | ₹2,000.00 | Receive, verify offline, & sync with bank |
| Bank Analyst | `analyst` | ₹0.00 | Adjudicate flagged double-spends & disputes |

---

## 5. Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm

### Step 1: Start Backend
```bash
# From OfflinePay_Simplified/OfflinePay_Simplified
python -m uvicorn backend.main:app --port 8000
```
The API and interactive docs are available at `http://127.0.0.1:8000/docs`.

### Step 2: Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### Reset Demo Data Anytime
```bash
python reset_demo.py
```

### Run All 5 Scenario Automated Tests (20 Tests)
```bash
python -m pytest backend/tests/test_all_scenarios.py -v
```

---

## 6. Docker Run
```bash
docker compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- MySQL: `localhost:3306`
