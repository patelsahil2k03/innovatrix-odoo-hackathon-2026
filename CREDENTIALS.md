# TransitOps — Demo Credentials

> **All accounts share the same password (demo-only, not a real secret).**

## 🔑 Shared Password

```
Demo@1234
```

---

## 👤 Accounts

| # | Email | Password | Role | Name | Permissions |
|---|-------|----------|------|------|-------------|
| 1 | `fleet@transitops.in` | `Demo@1234` | **Fleet Manager** | Rahul Kapoor | Vehicles, Maintenance |
| 2 | `dispatch@transitops.in` | `Demo@1234` | **Dispatcher** | Sneha Iyer | Trips, Costs |
| 3 | `safety@transitops.in` | `Demo@1234` | **Safety Officer** | Anil Deshmukh | Drivers, Compliance |
| 4 | `finance@transitops.in` | `Demo@1234` | **Financial Analyst** | Meera Nair | Costs, Reports |

---

## 🔐 Role → Permission Matrix

| Permission | Fleet Manager | Dispatcher | Safety Officer | Financial Analyst |
|-----------|:---:|:---:|:---:|:---:|
| Vehicle write (add/edit/delete) | ✅ | ❌ | ❌ | ❌ |
| Maintenance write | ✅ | ❌ | ❌ | ❌ |
| Driver write | ❌ | ❌ | ✅ | ❌ |
| Trip write (dispatch) | ❌ | ✅ | ❌ | ❌ |
| Cost write (fuel/expenses) | ❌ | ✅ | ❌ | ✅ |
| Compliance write | ✅ | ❌ | ✅ | ❌ |

---

## 🌐 Local Dev URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

---

> ⚠️ Change `DEMO_PASSWORD` in `backend/src/transitops/seed/seed.py` and `seed_password` in `settings.py` before any real deployment.
