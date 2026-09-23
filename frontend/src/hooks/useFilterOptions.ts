import { useEffect, useState } from 'react';
import { vehiclesApi, type Vehicle } from '@/api/vehicles.api';
import { maintenanceTypesApi, type MaintenanceType } from '@/api/maintenance-types.api';

/** Largest page the API accepts; the fleet and the type catalog fit in it. */
const MAX_PAGE = 100;

/**
 * Options for the "Vehículo" / "Tipo" filter selects. Loaded once per screen;
 * a failure leaves the list empty (the filter just offers "Todos") instead of
 * blocking the listing, which has its own error banner.
 */
export function useVehicleOptions(): Vehicle[] {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  useEffect(() => {
    let cancelled = false;
    vehiclesApi
      .list({ page: 1, limit: MAX_PAGE })
      .then((r) => {
        if (!cancelled) setVehicles([...r.items].sort((a, b) => a.licensePlate.localeCompare(b.licensePlate)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return vehicles;
}

export function useMaintenanceTypeOptions(): MaintenanceType[] {
  const [types, setTypes] = useState<MaintenanceType[]>([]);
  useEffect(() => {
    let cancelled = false;
    maintenanceTypesApi
      .list({ page: 1, limit: MAX_PAGE })
      .then((r) => {
        if (!cancelled) setTypes([...r.items].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return types;
}
