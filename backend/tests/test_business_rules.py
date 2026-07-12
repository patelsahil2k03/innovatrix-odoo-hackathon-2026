"""One test per rule in the 00_MASTER_PLAN §5 ledger.

If a rule is in the ledger and not asserted here, the ledger is a wish, not a guarantee.
"""

from datetime import date, timedelta

from transitops.models.enums import DriverStatus, TripStatus, VehicleStatus


def error_code(response) -> str:
    return response.json()["error"]["code"]


# --- Unique registration number ---------------------------------------------------------------


def test_duplicate_registration_is_rejected(client, as_fleet_manager, vehicle):
    response = client.post(
        "/api/v1/vehicles",
        json={
            "registration_number": vehicle.registration_number,
            "name_model": "Another Truck",
            "vehicle_type": "truck",
            "max_load_capacity_kg": 9000,
            "acquisition_cost": 1_800_000,
        },
        headers=as_fleet_manager,
    )
    assert response.status_code == 409
    assert error_code(response) == "DUPLICATE_REGISTRATION"
    assert "registration_number" in response.json()["error"]["fields"]


def test_malformed_registration_is_rejected(client, as_fleet_manager):
    response = client.post(
        "/api/v1/vehicles",
        json={
            "registration_number": "not a plate",
            "name_model": "Truck",
            "vehicle_type": "truck",
            "max_load_capacity_kg": 9000,
            "acquisition_cost": 1_800_000,
        },
        headers=as_fleet_manager,
    )
    assert response.status_code == 422
    assert error_code(response) == "VALIDATION_ERROR"


# --- Cargo ≤ capacity (the demo's deliberate-failure moment) -----------------------------------


def test_cargo_above_capacity_is_rejected_at_creation(client, as_dispatcher, vehicle, driver):
    response = client.post(
        "/api/v1/trips",
        json={
            "vehicle_id": str(vehicle.id),
            "driver_id": str(driver.id),
            "source_city": "Ahmedabad",
            "dest_city": "Mumbai",
            "cargo_weight_kg": 700,  # vehicle capacity is 500
            "revenue": 20_000,
        },
        headers=as_dispatcher,
    )
    assert response.status_code == 422
    assert error_code(response) == "CARGO_EXCEEDS_CAPACITY"
    assert response.json()["error"]["fields"]["cargo_weight_kg"] == "Must be ≤ 500"


def test_cargo_exactly_at_capacity_is_allowed(client, as_dispatcher, make_trip):
    trip_id = make_trip(cargo_weight_kg=500)
    assert trip_id


# --- Dispatch flips both statuses to on_trip, in one transaction -------------------------------


def test_dispatch_puts_vehicle_and_driver_on_trip(
    client, as_dispatcher, make_trip, db_session, vehicle, driver
):
    trip_id = make_trip()
    response = client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)

    assert response.status_code == 200
    assert response.json()["status"] == "dispatched"
    assert response.json()["dispatched_at"] is not None

    db_session.refresh(vehicle)
    db_session.refresh(driver)
    assert vehicle.status == VehicleStatus.ON_TRIP
    assert driver.status == DriverStatus.ON_TRIP


# --- A vehicle/driver already on a trip is not assignable --------------------------------------


def test_second_dispatch_of_same_vehicle_is_rejected(
    client, as_dispatcher, make_trip, vehicle, driver
):
    first = make_trip()
    second = make_trip()  # same vehicle + driver, still a legal draft

    assert client.post(f"/api/v1/trips/{first}/dispatch", headers=as_dispatcher).status_code == 200

    response = client.post(f"/api/v1/trips/{second}/dispatch", headers=as_dispatcher)
    assert response.status_code == 422
    # Vehicle is locked first, so it is the guard that fires.
    assert error_code(response) == "VEHICLE_NOT_AVAILABLE"


def test_creating_a_trip_for_a_busy_vehicle_is_rejected(
    client, as_dispatcher, make_trip, vehicle, driver
):
    trip_id = make_trip()
    client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)

    response = client.post(
        "/api/v1/trips",
        json={
            "vehicle_id": str(vehicle.id),
            "driver_id": str(driver.id),
            "source_city": "Pune",
            "dest_city": "Surat",
            "cargo_weight_kg": 300,
            "revenue": 10_000,
        },
        headers=as_dispatcher,
    )
    assert response.status_code == 422
    assert error_code(response) == "VEHICLE_NOT_AVAILABLE"


# --- Expired licence / suspended driver is not assignable --------------------------------------


def test_expired_license_driver_cannot_be_assigned(
    client, as_dispatcher, db_session, vehicle, driver
):
    driver.license_expiry_date = date.today() - timedelta(days=1)
    db_session.commit()

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
        headers=as_dispatcher,
    )
    assert response.status_code == 422
    assert error_code(response) == "LICENSE_EXPIRED"


def test_suspended_driver_cannot_be_assigned(client, as_dispatcher, db_session, vehicle, driver):
    driver.status = DriverStatus.SUSPENDED
    db_session.commit()

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
        headers=as_dispatcher,
    )
    assert response.status_code == 422
    assert error_code(response) == "DRIVER_SUSPENDED"


def test_license_expiring_between_draft_and_dispatch_blocks_dispatch(
    client, as_dispatcher, make_trip, db_session, driver
):
    """The guard is re-checked under the lock — a draft created while valid must not sail through."""
    trip_id = make_trip()

    driver.license_expiry_date = date.today() - timedelta(days=1)
    db_session.commit()

    response = client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)
    assert response.status_code == 422
    assert error_code(response) == "LICENSE_EXPIRED"


# --- Retired / in-shop vehicles are never dispatchable -----------------------------------------


def test_in_shop_vehicle_cannot_be_dispatched(
    client, as_dispatcher, make_trip, db_session, vehicle
):
    trip_id = make_trip()

    vehicle.status = VehicleStatus.IN_SHOP
    db_session.commit()

    response = client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)
    assert response.status_code == 422
    assert error_code(response) == "VEHICLE_NOT_AVAILABLE"


def test_retired_vehicle_cannot_be_dispatched(client, as_dispatcher, make_trip, db_session, vehicle):
    trip_id = make_trip()

    vehicle.status = VehicleStatus.RETIRED
    db_session.commit()

    response = client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)
    assert response.status_code == 422
    assert error_code(response) == "VEHICLE_NOT_AVAILABLE"


def test_dispatchable_list_excludes_unavailable_and_too_small(
    client, as_dispatcher, db_session, vehicle
):
    available = client.get(
        "/api/v1/vehicles/dispatchable?cargo_weight_kg=400", headers=as_dispatcher
    ).json()
    assert [v["id"] for v in available] == [str(vehicle.id)]

    # Too heavy for its 500 kg capacity → filtered out.
    assert (
        client.get(
            "/api/v1/vehicles/dispatchable?cargo_weight_kg=600", headers=as_dispatcher
        ).json()
        == []
    )

    vehicle.status = VehicleStatus.IN_SHOP
    db_session.commit()
    assert (
        client.get(
            "/api/v1/vehicles/dispatchable?cargo_weight_kg=400", headers=as_dispatcher
        ).json()
        == []
    )


def test_assignable_list_excludes_expired_and_suspended(client, as_dispatcher, db_session, driver):
    assert len(client.get("/api/v1/drivers/assignable", headers=as_dispatcher).json()) == 1

    driver.license_expiry_date = date.today() - timedelta(days=1)
    db_session.commit()
    assert client.get("/api/v1/drivers/assignable", headers=as_dispatcher).json() == []


# --- Complete restores both statuses, updates odometer, logs fuel ------------------------------


def test_complete_restores_statuses_and_updates_odometer(
    client, as_dispatcher, make_trip, db_session, vehicle, driver
):
    trip_id = make_trip()
    client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)

    response = client.post(
        f"/api/v1/trips/{trip_id}/complete",
        json={
            "actual_distance_km": 530.5,
            "final_odometer_km": 10_530.5,
            "fuel": {"liters": 66.3, "cost": 6_100},
        },
        headers=as_dispatcher,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["actual_distance_km"] == 530.5
    assert body["progress_percent"] == 100

    db_session.refresh(vehicle)
    db_session.refresh(driver)
    assert vehicle.status == VehicleStatus.AVAILABLE
    assert driver.status == DriverStatus.AVAILABLE
    assert float(vehicle.odometer_km) == 10_530.5

    # The optional fuel block became a real fuel log against this trip.
    logs = client.get(f"/api/v1/fuel-logs?trip_id={trip_id}", headers=as_dispatcher).json()
    assert logs["total"] == 1
    assert logs["items"][0]["liters"] == 66.3


def test_completing_a_draft_is_rejected(client, as_dispatcher, make_trip):
    trip_id = make_trip()
    response = client.post(
        f"/api/v1/trips/{trip_id}/complete",
        json={"actual_distance_km": 500, "final_odometer_km": 10_500},
        headers=as_dispatcher,
    )
    assert response.status_code == 422
    assert error_code(response) == "TRIP_NOT_DISPATCHED"


def test_odometer_cannot_go_backwards(client, as_dispatcher, make_trip):
    trip_id = make_trip()
    client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)

    response = client.post(
        f"/api/v1/trips/{trip_id}/complete",
        json={"actual_distance_km": 500, "final_odometer_km": 9_000},  # vehicle is at 10,000
        headers=as_dispatcher,
    )
    assert response.status_code == 422
    assert error_code(response) == "ODOMETER_REGRESSION"


# --- Cancel ------------------------------------------------------------------------------------


def test_cancelling_a_dispatched_trip_releases_vehicle_and_driver(
    client, as_dispatcher, make_trip, db_session, vehicle, driver
):
    trip_id = make_trip()
    client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)

    response = client.post(f"/api/v1/trips/{trip_id}/cancel", headers=as_dispatcher)
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"

    db_session.refresh(vehicle)
    db_session.refresh(driver)
    assert vehicle.status == VehicleStatus.AVAILABLE
    assert driver.status == DriverStatus.AVAILABLE


def test_cancelling_a_completed_trip_is_rejected(client, as_dispatcher, make_trip):
    trip_id = make_trip()
    client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)
    client.post(
        f"/api/v1/trips/{trip_id}/complete",
        json={"actual_distance_km": 500, "final_odometer_km": 10_500},
        headers=as_dispatcher,
    )

    response = client.post(f"/api/v1/trips/{trip_id}/cancel", headers=as_dispatcher)
    assert response.status_code == 422
    assert error_code(response) == "TRIP_ALREADY_COMPLETED"


def test_patching_a_dispatched_trip_is_rejected(client, as_dispatcher, make_trip):
    trip_id = make_trip()
    client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)

    response = client.patch(
        f"/api/v1/trips/{trip_id}", json={"revenue": 99_000}, headers=as_dispatcher
    )
    assert response.status_code == 422
    assert error_code(response) == "TRIP_NOT_DRAFT"


# --- Maintenance: open → in_shop, close → available --------------------------------------------


def test_opening_maintenance_sends_vehicle_to_the_shop(
    client, as_fleet_manager, as_dispatcher, db_session, vehicle
):
    response = client.post(
        "/api/v1/maintenance",
        json={
            "vehicle_id": str(vehicle.id),
            "maintenance_type": "repair",
            "description": "Clutch plate replacement",
            "cost": 12_000,
        },
        headers=as_fleet_manager,
    )
    assert response.status_code == 201
    assert response.json()["status"] == "open"

    db_session.refresh(vehicle)
    assert vehicle.status == VehicleStatus.IN_SHOP

    # And it drops out of the dispatch pool.
    assert (
        client.get("/api/v1/vehicles/dispatchable?cargo_weight_kg=100", headers=as_dispatcher).json()
        == []
    )


def test_closing_maintenance_returns_vehicle_to_available(
    client, as_fleet_manager, db_session, vehicle
):
    maintenance_id = client.post(
        "/api/v1/maintenance",
        json={"vehicle_id": str(vehicle.id), "maintenance_type": "service", "cost": 0},
        headers=as_fleet_manager,
    ).json()["id"]

    response = client.post(
        f"/api/v1/maintenance/{maintenance_id}/close",
        json={"cost": 8_500},
        headers=as_fleet_manager,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "closed"
    assert response.json()["cost"] == 8_500

    db_session.refresh(vehicle)
    assert vehicle.status == VehicleStatus.AVAILABLE


def test_maintenance_cannot_open_on_a_vehicle_that_is_on_a_trip(
    client, as_fleet_manager, as_dispatcher, make_trip, vehicle
):
    trip_id = make_trip()
    client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)

    response = client.post(
        "/api/v1/maintenance",
        json={"vehicle_id": str(vehicle.id), "maintenance_type": "repair", "cost": 5_000},
        headers=as_fleet_manager,
    )
    assert response.status_code == 422
    assert error_code(response) == "VEHICLE_ON_TRIP"


def test_cannot_edit_a_vehicle_back_to_available_while_maintenance_is_open(
    client, as_fleet_manager, as_dispatcher, db_session, vehicle
):
    """Editing status must not be a back door around the maintenance workflow (00 §5)."""
    client.post(
        "/api/v1/maintenance",
        json={"vehicle_id": str(vehicle.id), "maintenance_type": "repair", "cost": 5_000},
        headers=as_fleet_manager,
    )

    response = client.patch(
        f"/api/v1/vehicles/{vehicle.id}", json={"status": "available"}, headers=as_fleet_manager
    )
    assert response.status_code == 422
    assert error_code(response) == "MAINTENANCE_OPEN"

    db_session.refresh(vehicle)
    assert vehicle.status == VehicleStatus.IN_SHOP
    # …and it is still out of the dispatch pool.
    assert (
        client.get("/api/v1/vehicles/dispatchable?cargo_weight_kg=100", headers=as_dispatcher).json()
        == []
    )


def test_a_vehicle_with_only_fuel_logs_is_retired_not_hard_deleted(
    client, as_fleet_manager, as_dispatcher, db_session, vehicle
):
    """Zero trips but a fuel log still means dependent rows exist — hard delete would FK-violate."""
    client.post(
        "/api/v1/fuel-logs",
        json={"vehicle_id": str(vehicle.id), "liters": 40, "cost": 3_800},
        headers=as_dispatcher,
    )

    response = client.delete(f"/api/v1/vehicles/{vehicle.id}", headers=as_fleet_manager)
    assert response.status_code == 204

    db_session.refresh(vehicle)
    assert vehicle.status == VehicleStatus.RETIRED


def test_a_vehicle_with_no_history_is_hard_deleted(client, as_fleet_manager, vehicle):
    assert client.delete(f"/api/v1/vehicles/{vehicle.id}", headers=as_fleet_manager).status_code == 204
    assert (
        client.get(f"/api/v1/vehicles/{vehicle.id}", headers=as_fleet_manager).status_code == 404
    )


def test_a_driver_on_a_trip_can_still_have_their_phone_corrected(
    client, as_safety_officer, as_dispatcher, make_trip, driver
):
    """Only the status transition is blocked mid-trip (contract §3), not every edit."""
    trip_id = make_trip()
    client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)

    ok = client.patch(
        f"/api/v1/drivers/{driver.id}", json={"phone": "+91 9000000000"}, headers=as_safety_officer
    )
    assert ok.status_code == 200
    assert ok.json()["phone"] == "+91 9000000000"

    blocked = client.patch(
        f"/api/v1/drivers/{driver.id}", json={"status": "suspended"}, headers=as_safety_officer
    )
    assert blocked.status_code == 422
    assert error_code(blocked) == "DRIVER_ON_TRIP"


def test_closing_maintenance_leaves_a_retired_vehicle_retired(
    client, as_fleet_manager, db_session, vehicle
):
    maintenance_id = client.post(
        "/api/v1/maintenance",
        json={"vehicle_id": str(vehicle.id), "maintenance_type": "repair", "cost": 0},
        headers=as_fleet_manager,
    ).json()["id"]

    vehicle.status = VehicleStatus.RETIRED
    db_session.commit()

    client.post(
        f"/api/v1/maintenance/{maintenance_id}/close",
        json={"cost": 1_000},
        headers=as_fleet_manager,
    )
    db_session.refresh(vehicle)
    assert vehicle.status == VehicleStatus.RETIRED


# --- Vehicle status edits guard against live trips ---------------------------------------------


def test_cannot_retire_a_vehicle_that_is_on_a_trip(
    client, as_fleet_manager, as_dispatcher, make_trip, vehicle
):
    trip_id = make_trip()
    client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=as_dispatcher)

    response = client.patch(
        f"/api/v1/vehicles/{vehicle.id}", json={"status": "retired"}, headers=as_fleet_manager
    )
    assert response.status_code == 422
    assert error_code(response) == "VEHICLE_ON_TRIP"


def test_delete_soft_retires_a_vehicle_with_trip_history(
    client, as_fleet_manager, make_trip, db_session, vehicle
):
    make_trip()  # gives the vehicle history worth keeping

    response = client.delete(f"/api/v1/vehicles/{vehicle.id}", headers=as_fleet_manager)
    assert response.status_code == 204

    db_session.refresh(vehicle)
    assert vehicle.status == VehicleStatus.RETIRED


# --- Fuel log ↔ trip must agree on the vehicle -------------------------------------------------


def test_fuel_log_against_another_vehicles_trip_is_rejected(
    client, as_dispatcher, as_fleet_manager, make_trip, db_session
):
    trip_id = make_trip()

    other = client.post(
        "/api/v1/vehicles",
        json={
            "registration_number": "MH-12-XY-9999",
            "name_model": "Tata LPT 1613",
            "vehicle_type": "truck",
            "max_load_capacity_kg": 9000,
            "acquisition_cost": 1_800_000,
        },
        headers=as_fleet_manager,
    ).json()

    response = client.post(
        "/api/v1/fuel-logs",
        json={
            "vehicle_id": other["id"],  # not the trip's vehicle
            "trip_id": trip_id,
            "liters": 40,
            "cost": 3_800,
        },
        headers=as_dispatcher,
    )
    assert response.status_code == 422
    assert error_code(response) == "TRIP_VEHICLE_MISMATCH"


def test_vehicle_costs_sum_fuel_maintenance_and_expenses(
    client, as_dispatcher, as_fleet_manager, vehicle
):
    client.post(
        "/api/v1/fuel-logs",
        json={"vehicle_id": str(vehicle.id), "liters": 50, "cost": 4_500},
        headers=as_dispatcher,
    )
    client.post(
        "/api/v1/expenses",
        json={"vehicle_id": str(vehicle.id), "expense_type": "toll", "amount": 800},
        headers=as_dispatcher,
    )
    maintenance_id = client.post(
        "/api/v1/maintenance",
        json={"vehicle_id": str(vehicle.id), "maintenance_type": "service", "cost": 0},
        headers=as_fleet_manager,
    ).json()["id"]
    client.post(
        f"/api/v1/maintenance/{maintenance_id}/close",
        json={"cost": 3_000},
        headers=as_fleet_manager,
    )

    costs = client.get(f"/api/v1/vehicles/{vehicle.id}/costs", headers=as_dispatcher).json()
    assert costs["fuel_total"] == 4_500
    assert costs["maintenance_total"] == 3_000
    assert costs["other_total"] == 800
    assert costs["operational_total"] == 8_300
