export interface Profile {
  id: string;
  phone: string;
  full_name: string;
  avatar_url?: string;
  membership_level: 'standard' | 'silver' | 'gold';
  wallet_balance: number;
  total_sessions: number;
  total_kwh: number;
  rating: number;
  car_model?: string;
  created_at: string;
  updated_at: string;
}

export interface Station {
  id: string;
  name: string;
  name_ar?: string;
  address: string;
  address_ar?: string;
  governorate: string;
  wilayat?: string;
  latitude: number;
  longitude: number;
  status: 'available' | 'busy' | 'fault' | 'offline';
  price_per_kwh: number;
  total_connectors: number;
  available_connectors: number;
  rating: number;
  total_ratings: number;
  power_kw: number;
  image_url?: string;
  amenities?: string[];
  operating_hours: string;
  last_maintenance?: string;
  created_at: string;
}

export interface Connector {
  id: string;
  station_id: string;
  connector_type: 'Type2' | 'CCS' | 'CHAdeMO' | 'GBT' | 'Tesla';
  power_kw: number;
  status: 'available' | 'occupied' | 'fault' | 'offline';
}

export interface Booking {
  id: string;
  user_id: string;
  station_id: string;
  connector_id?: string;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'no_show';
  booked_at: string;
  duration_minutes: number;
  estimated_kwh?: number;
  estimated_cost?: number;
  actual_kwh?: number;
  actual_cost?: number;
  qr_code: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  station?: Station;
}

export interface ChargingSession {
  id: string;
  booking_id?: string;
  user_id: string;
  station_id: string;
  connector_id?: string;
  status: 'active' | 'completed' | 'interrupted';
  started_at: string;
  ended_at?: string;
  kwh_delivered: number;
  cost: number;
  battery_start_pct?: number;
  battery_end_pct?: number;
  created_at: string;
  station?: Station;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  type: 'topup' | 'charge' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  description: string;
  reference_id?: string;
  payment_method?: string;
  created_at: string;
}

export interface InvestorApplication {
  id: string;
  user_id?: string;
  full_name: string;
  phone: string;
  email?: string;
  location_name: string;
  location_type: 'mall' | 'hotel' | 'hospital' | 'university' | 'residential' | 'commercial' | 'fuel_station' | 'other';
  governorate: string;
  wilayat?: string;
  charger_count: number;
  charger_types?: string[];
  energy_source?: 'grid' | 'solar' | 'hybrid';
  availability_hours?: string;
  suggested_price?: number;
  description?: string;
  package_type: 'basic' | 'pro';
  watt_box_option?: 'buy' | 'subscribe' | 'none';
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  created_at: string;
}

// Navigation param lists
export type RootStackParamList = {
  Splash: undefined;
  Phone: undefined;
  OTP: { phone: string };
  Main: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  StationDetails: { stationId: string };
  Booking: { station: Station };
  ActiveBooking: { bookingId: string };
  Charging: { sessionId: string; stationName: string };
  Investor: undefined;
};

export type TabParamList = {
  Map: undefined;
  Bookings: undefined;
  Wallet: undefined;
  Profile: undefined;
};
