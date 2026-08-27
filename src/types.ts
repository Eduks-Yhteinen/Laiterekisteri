export type ProvisionStatus = 'ACTIVE' | 'INACTIVE' | 'DEPROVISIONED';
export type DeviceStatus = 'Käytössä' | 'Varastossa' | 'Huollossa' | 'Rikkoutunut' | 'Kadonnut';

export interface Device {
  Serial: string;
  DeviceID: string;
  Model: string;
  LastCheckIn: string; // ISO date string
  AutoUpdateExpiration: string | null; // ISO date string or null
  provisionStatus: ProvisionStatus;
  Kustannuspaikka: string;
  DeviceType: string;
  LeaseStatus: string;
  DeviceStatus: DeviceStatus;
  LeaseEnd: string | null;
  LeaseType: string;
}

export interface DevicePII {
  Serial: string; // Document ID matches Device Document ID
  DeviceName: string;
  PrimaryUser: string;
}

export interface UserRole {
  role: 'admin' | 'viewer'; // Global admins are hardcoded in security rules
}
