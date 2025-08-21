export interface Destination {
  id: number;
  carrier: string;
  labelUrl: string;
  country: string;
  zipCode: string;
  city: string;
  latitude: string;
  longitude: string;
  address: string | null;
  servicepoint_id: string;
  reference: string;
  created_at: Date;
  updated_at: Date;
  package_id: string;
}

export interface Device {
  id: number;
  uuid: string;
  name: string;
  battery_percentage: number;
  type: string;
  firmware_version: string;
  wifi: number;
  activation_state: string;
  connectivity_state: string;
  events_count: number;
  selected_profile: number | null;
  active_profile: number | null;
  activated_at: string;
  registered_at: string;
  created_at: string;
  latestLatitude: string | null;
  latestLongitude: string | null;
}

export interface Event {
  id: number;
  latitude: string;
  longitude: string;
  road: string | null;
  country: string | null;
  status: string;
  trigger: string;
  tripId: number | null;
  created_at: string;
  deviceId: string;
  event_id: number;
  city: string | null;
}

export interface Trip {
  id: number;
  start_latitude: string;
  start_longitude: string;
  start_time: string;
  end_latitude: string | null;
  end_longitude: string | null;
  end_time: string | null;
  latest_latitude: string | null;
  latest_longitude: string;
  created_at: Date;
  updated_at: Date;
}

export interface Trips {
  id: number;
  deviceId: string;
  deliveryCompanyName: string | null;
  deliveryCompanyPhone: string | null;
  deliveryCompanyEmail: string | null;
  deliveryCompanyImageUrl: string | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryCountry: string | null;
  expectedDeliveryTime: string | null;
  isReturning: number;
  deliveryStatus: string;
  startTime: string;
  endTime: string | null;
  startLatitude: string;
  startLongitude: string;
  endLatitude: string | null;
  endLongitude: string | null;
  currentLatitude: string | null;
  currentLongitude: string | null;
}

export interface Database {
  Destination: Destination;
  Device: Device;
  Event: Event;
  Trip: Trip;
  Trips: Trips;
}

