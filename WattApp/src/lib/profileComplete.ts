import type { Profile } from '../types';

// A customer's car profile is "complete" once we know the essentials needed to
// book and to estimate charging: connector type + battery size. car_make/model
// are helpful but optional.
export function isCarProfileComplete(profile: Profile | null | undefined): boolean {
  return !!(profile && profile.connector_type && (profile.battery_kwh ?? 0) > 0);
}
