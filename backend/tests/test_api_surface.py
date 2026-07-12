"""The rest of the contract: health, list plumbing, analytics, exports, suggestions, audit.

Also the "never 500" promise — bad input of every shape must come back as an enveloped 4xx.
"""

import uuid


def test_health_is_public_and_reports_the_db(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["db"] == "ok"
    assert body["simulator"] == "off"  # tests force it off


def test_openapi_schema_builds(client):
    """Swagger is part of the demo — a broken response_model would only surface here."""
    assert client.get("/openapi.json").status_code == 200


# --- List plumbing (contract §0) ---------------------------------------------------------------


def test_list_returns_the_page_envelope(client, as_dispatcher, vehicle):
    body = client.get("/api/v1/vehicles", headers=as_dispatcher).json()
    assert set(body) == {"items", "total", "page", "page_size"}
    assert body["total"] == 1
    assert body["page"] == 1


def test_pagination_windows_the_results(client, as_fleet_manager):
    for i in range(5):
        client.post(
            "/api/v1/vehicles",
            json={
                "registration_number": f"GJ-0{i + 1}-AB-100{i}",
                "name_model": f"Truck {i}",
                "vehicle_type": "truck",
                "max_load_capacity_kg": 9000,
                "acquisition_cost": 1_800_000,
            },
            headers=as_fleet_manager,
        )

    page = client.get("/api/v1/vehicles?page=2&page_size=2", headers=as_fleet_manager).json()
    assert page["total"] == 5
    assert page["page"] == 2
    assert len(page["items"]) == 2


def test_search_and_filter(client, as_dispatcher, vehicle):
    hit = client.get("/api/v1/vehicles?q=Tata", headers=as_dispatcher).json()
    assert hit["total"] == 1

    miss = client.get("/api/v1/vehicles?q=Volvo", headers=as_dispatcher).json()
    assert miss["total"] == 0

    by_status = client.get("/api/v1/vehicles?status=retired", headers=as_dispatcher).json()
    assert by_status["total"] == 0


def test_sorting_by_an_unknown_field_is_a_422_not_a_500(client, as_dispatcher):
    response = client.get("/api/v1/vehicles?sort=drop_table", headers=as_dispatcher)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_sort_descending(client, as_dispatcher, vehicle):
    response = client.get("/api/v1/vehicles?sort=-registration_number", headers=as_dispatcher)
    assert response.status_code == 200


# --- Never a raw 500 ---------------------------------------------------------------------------


def test_unknown_id_is_404_with_the_envelope(client, as_dispatcher):
    response = client.get(f"/api/v1/vehicles/{uuid.uuid4()}", headers=as_dispatcher)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_a_malformed_uuid_is_422_not_500(client, as_dispatcher):
    response = client.get("/api/v1/vehicles/not-a-uuid", headers=as_dispatcher)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_negative_cargo_is_rejected_by_the_schema(client, as_dispatcher, vehicle, driver):
    response = client.post(
        "/api/v1/trips",
        json={
            "vehicle_id": str(vehicle.id),
            "driver_id": str(driver.id),
            "source_city": "Ahmedabad",
            "dest_city": "Mumbai",
            "cargo_weight_kg": -5,
            "revenue": 1000,
        },
        headers=as_dispatcher,
    )
    assert response.status_code == 422
    assert "cargo_weight_kg" in response.json()["error"]["fields"]


def test_the_seed_and_the_api_share_one_city_catalog():
    """Regression guard: the seed once had its own catalog, so it wrote trips through cities
    (Vadodara, Rajkot) the API then rejected as UNKNOWN_CITY, and the two disagreed on Delhi's
    coordinates. The seed must stay a view over core.cities, never a second copy."""
    from transitops.core.cities import CITIES, find_city
    from transitops.seed.cities import CITIES as SEED_CITIES

    assert {c["name"] for c in SEED_CITIES} == {c.name for c in CITIES}

    for seeded in SEED_CITIES:
        city = find_city(seeded["name"])
        assert city is not None, f"seed writes trips through {seeded['name']}, API rejects it"
        assert (city.lat, city.lng) == (seeded["lat"], seeded["lng"])


def test_an_unknown_city_is_a_clean_422(client, as_dispatcher, vehicle, driver):
    response = client.post(
        "/api/v1/trips",
        json={
            "vehicle_id": str(vehicle.id),
            "driver_id": str(driver.id),
            "source_city": "Atlantis",
            "dest_city": "Mumbai",
            "cargo_weight_kg": 300,
            "revenue": 1000,
        },
        headers=as_dispatcher,
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNKNOWN_CITY"


def test_same_source_and_destination_is_rejected(client, as_dispatcher, vehicle, driver):
    response = client.post(
        "/api/v1/trips",
        json={
            "vehicle_id": str(vehicle.id),
            "driver_id": str(driver.id),
            "source_city": "Mumbai",
            "dest_city": "Mumbai",
            "cargo_weight_kg": 300,
            "revenue": 1000,
        },
        headers=as_dispatcher,
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "SAME_SOURCE_AND_DEST"


# --- Analytics ---------------------------------------------------------------------------------


def test_kpis_reflect_a_dispatch(client, as_dispatcher, make_trip):
    before = client.get("/api/v1/analytics/kpis", headers=as_dispatcher).json()
    assert before["available_vehicles"] == 1
    assert before["on_trip_vehicles"] == 0
    assert before["pending_trips"] == 0

    trip_id = make_trip()
    assert (
        client.get("/api/v1/analytics/kpis", headers=as_dispatcher).json()["pending_trips"] == 1
    )

    client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)

    after = client.get("/api/v1/analytics/kpis", headers=as_dispatcher).json()
    assert after["on_trip_vehicles"] == 1
    assert after["available_vehicles"] == 0
    assert after["active_trips"] == 1
    assert after["fleet_utilization_pct"] == 100.0
    assert after["drivers_on_duty"] == 1


def test_roi_uses_the_ps_formula(client, as_dispatcher, make_trip, vehicle):
    """ROI = (revenue − operational cost) / acquisition cost."""
    trip_id = make_trip()  # revenue 25,000
    client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)
    client.post(
        f"/api/v1/trips/{trip_id}/complete",
        json={
            "actual_distance_km": 500,
            "final_odometer_km": 10_500,
            "fuel": {"liters": 60, "cost": 5_000},
        },
        headers=as_dispatcher,
    )

    detail = client.get(f"/api/v1/vehicles/{vehicle.id}", headers=as_dispatcher).json()
    metrics = detail["metrics"]

    assert detail["costs"]["operational_total"] == 5_000
    assert metrics["total_revenue"] == 25_000
    # (25,000 − 5,000) / 500,000
    assert metrics["roi"] == 0.04
    # 500 km on 60 L
    assert metrics["fuel_efficiency_kmpl"] == 8.33
    assert metrics["cost_per_km"] == 10.0


def test_fleet_report_and_trends_render(client, as_financial_analyst, vehicle):
    fleet = client.get("/api/v1/analytics/fleet", headers=as_financial_analyst).json()
    assert len(fleet) == 1
    assert fleet[0]["registration_number"] == vehicle.registration_number
    assert 0 <= fleet[0]["health_score"] <= 100

    trends = client.get("/api/v1/analytics/trends", headers=as_financial_analyst).json()
    assert set(trends) == {"weekly", "trips_by_status", "co2_total_kg", "co2_saved_kg"}


def test_health_score_drops_when_a_vehicle_is_in_the_shop(
    client, as_fleet_manager, as_dispatcher, vehicle
):
    before = client.get(f"/api/v1/vehicles/{vehicle.id}", headers=as_dispatcher).json()["metrics"][
        "health_score"
    ]

    client.post(
        "/api/v1/maintenance",
        json={"vehicle_id": str(vehicle.id), "maintenance_type": "repair", "cost": 9_000},
        headers=as_fleet_manager,
    )

    after = client.get(f"/api/v1/vehicles/{vehicle.id}", headers=as_dispatcher).json()["metrics"][
        "health_score"
    ]
    assert after < before


# --- CSV export --------------------------------------------------------------------------------


def test_csv_export_streams_a_fleet_report(client, as_financial_analyst, vehicle):
    response = client.get("/api/v1/export/csv?report=fleet", headers=as_financial_analyst)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]

    lines = response.text.strip().splitlines()
    assert lines[0].startswith("registration_number")
    assert vehicle.registration_number in lines[1]


def test_csv_export_rejects_an_unknown_report(client, as_financial_analyst):
    response = client.get("/api/v1/export/csv?report=nonsense", headers=as_financial_analyst)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


# --- Suggestions (W2) --------------------------------------------------------------------------


def test_suggestions_only_propose_dispatchable_pairs(client, as_dispatcher, vehicle, driver):
    suggestions = client.get(
        "/api/v1/trips/suggestions?cargo_weight_kg=400", headers=as_dispatcher
    ).json()

    assert len(suggestions) == 1
    assert suggestions[0]["vehicle"]["id"] == str(vehicle.id)
    assert suggestions[0]["driver"]["id"] == str(driver.id)
    assert suggestions[0]["score"] > 0
    assert suggestions[0]["reasons"]


def test_no_suggestions_when_nothing_can_carry_the_load(client, as_dispatcher, vehicle, driver):
    assert (
        client.get("/api/v1/trips/suggestions?cargo_weight_kg=5000", headers=as_dispatcher).json()
        == []
    )


# --- Live map feed -----------------------------------------------------------------------------


def test_live_trips_interpolate_a_position(client, as_dispatcher, make_trip, db_session):
    from transitops.models.trip import Trip

    trip_id = make_trip()
    client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)

    trip = db_session.get(Trip, uuid.UUID(trip_id))
    trip.progress_percent = 50
    db_session.commit()

    live = client.get("/api/v1/trips/live", headers=as_dispatcher).json()
    assert len(live) == 1

    row = live[0]
    # Halfway between Ahmedabad (23.0225) and Mumbai (19.0760).
    assert row["current_lat"] == round((23.0225 + 19.0760) / 2, 6)
    assert row["vehicle_registration"]
    assert row["driver_name"]


# --- Audit trail (Tier-2 B4) -------------------------------------------------------------------


def test_writes_are_audited_and_reads_are_not(client, as_fleet_manager, as_dispatcher, vehicle):
    client.get("/api/v1/vehicles", headers=as_dispatcher)  # a read — must not be logged

    client.patch(
        f"/api/v1/vehicles/{vehicle.id}", json={"region": "Maharashtra"}, headers=as_fleet_manager
    )

    logs = client.get("/api/v1/audit-logs", headers=as_fleet_manager).json()
    actions = [row["action"] for row in logs["items"]]

    assert "vehicles.patch" in actions
    assert all(not a.endswith(".get") for a in actions)


def test_login_is_never_written_to_the_audit_log(client, users):
    client.post("/api/v1/auth/login", json={"email": "fleet_manager@test.in", "password": "test-password"})

    token = client.post(
        "/api/v1/auth/token",
        json={"email": "fleet_manager@test.in", "password": "test-password"},
    ).json()["access_token"]

    logs = client.get(
        "/api/v1/audit-logs", headers={"Authorization": f"Bearer {token}"}
    ).json()
    assert all("auth" not in row["entity_name"] for row in logs["items"])
