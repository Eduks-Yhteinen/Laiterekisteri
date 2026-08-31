export interface IntuneDevice {
  id: string;
  deviceName: string;
  serialNumber: string;
  model: string;
  lastSyncDateTime: string;
  userPrincipalName?: string;
  operatingSystem: string;
}

export interface GoogleChromeDevice {
  deviceId: string;
  serialNumber: string;
  model: string;
  lastPolicySync: string;
  osVersion: string;
  orgUnitPath: string;
  status: string;
  autoUpdateExpiration: string;
  recentUsers?: Array<{ email: string }>;
}

export interface FirestoreDevice {
  Serial: string;
  DeviceID: string;
  Model: string;
  LastCheckIn: string;
  DeviceType: string;
  AutoUpdateExpiration?: string | null;
  provisionStatus?: string;
  // Financial data (Kustannuspaikka, jne) is managed manually in Firestore now.
}

export interface FirestoreDevicePII {
  Serial: string;
  DeviceName: string;
  PrimaryUser: string;
}
