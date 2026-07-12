"""Auth + the RBAC matrix (docs/02 §3)."""

def test_login_sets_httponly_cookie_and_returns_user(client, users, password):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "dispatcher@test.in", "password": password},
    )
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "dispatcher"

    cookie = response.cookies.get("transitops_token")
    assert cookie
    assert "httponly" in response.headers["set-cookie"].lower()


def test_login_is_case_insensitive_on_email(client, users, password):
    response = client.post(
        "/api/v1/auth/login", json={"email": "DISPATCHER@TEST.IN", "password": password}
    )
    assert response.status_code == 200


def test_wrong_password_is_401_with_the_contract_code(client, users, password):
    response = client.post(
        "/api/v1/auth/login", json={"email": "dispatcher@test.in", "password": "wrong"}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_unknown_email_gives_the_same_error_as_a_wrong_password(client, users, password):
    """Don't leak which accounts exist."""
    response = client.post(
        "/api/v1/auth/login", json={"email": "nobody@test.in", "password": password}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_me_requires_authentication(client, users):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_returns_the_logged_in_user(client, as_dispatcher):
    response = client.get("/api/v1/auth/me", headers=as_dispatcher)
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "dispatcher@test.in"


def test_a_garbage_token_is_401_not_500(client, users):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"


# --- RBAC: each write is gated to the role that owns it ----------------------------------------


def test_dispatcher_cannot_create_a_vehicle(client, as_dispatcher):
    response = client.post(
        "/api/v1/vehicles",
        json={
            "registration_number": "GJ-05-CD-4321",
            "name_model": "Tata Ace",
            "vehicle_type": "mini",
            "max_load_capacity_kg": 750,
            "acquisition_cost": 480_000,
        },
        headers=as_dispatcher,
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_fleet_manager_cannot_create_a_trip(client, as_fleet_manager, vehicle, driver):
    response = client.post(
        "/api/v1/trips",
        json={
            "vehicle_id": str(vehicle.id),
            "driver_id": str(driver.id),
            "source_city": "Ahmedabad",
            "dest_city": "Mumbai",
            "cargo_weight_kg": 300,
            "revenue": 10_000,
        },
        headers=as_fleet_manager,
    )
    assert response.status_code == 403


def test_fleet_manager_cannot_create_a_driver(client, as_fleet_manager):
    response = client.post(
        "/api/v1/drivers",
        json={
            "name": "New Driver",
            "license_number": "GJ0120200099999",
            "license_category": "LMV",
            "license_expiry_date": "2030-01-01",
        },
        headers=as_fleet_manager,
    )
    assert response.status_code == 403


def test_safety_officer_can_create_a_driver(client, as_safety_officer):
    response = client.post(
        "/api/v1/drivers",
        json={
            "name": "New Driver",
            "license_number": "GJ0120200099999",
            "license_category": "LMV",
            "license_expiry_date": "2030-01-01",
            "safety_score": 88,
        },
        headers=as_safety_officer,
    )
    assert response.status_code == 201


def test_financial_analyst_can_log_an_expense(client, as_financial_analyst, vehicle):
    response = client.post(
        "/api/v1/expenses",
        json={"vehicle_id": str(vehicle.id), "expense_type": "toll", "amount": 450},
        headers=as_financial_analyst,
    )
    assert response.status_code == 201


def test_safety_officer_cannot_log_an_expense(client, as_safety_officer, vehicle):
    response = client.post(
        "/api/v1/expenses",
        json={"vehicle_id": str(vehicle.id), "expense_type": "toll", "amount": 450},
        headers=as_safety_officer,
    )
    assert response.status_code == 403


def test_every_role_can_read_the_dashboard(
    client, as_fleet_manager, as_dispatcher, as_safety_officer, as_financial_analyst
):
    for headers in (as_fleet_manager, as_dispatcher, as_safety_officer, as_financial_analyst):
        assert client.get("/api/v1/analytics/kpis", headers=headers).status_code == 200


def test_only_the_fleet_manager_reads_the_audit_log(client, as_fleet_manager, as_dispatcher):
    assert client.get("/api/v1/audit-logs", headers=as_fleet_manager).status_code == 200
    assert client.get("/api/v1/audit-logs", headers=as_dispatcher).status_code == 403
