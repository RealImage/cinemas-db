/** Choices for the theatre form's TMS and Ticketing System dropdowns (GET /api/theatres/systems). */
export interface TheatreSystemOptions {
  tms?: { id: string; name: string }[];
  ticketing: { id: string; name: string }[];
}

/** How a theatre is listed: shown to everyone, only to its companies, or not at all. */
export const THEATRE_LISTINGS = ["Listed - Public", "Listed - Private", "Unlisted"] as const;
export type TheatreListing = (typeof THEATRE_LISTINGS)[number];

export type Operator = {
  name: string;
  email: string;
  phone?: string;
};

export type IPAddress = {
  address: string;
  subnet: string;
  gateway: string;
};

export type ScreenDevice = {
  id: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  role?: string;
  certificateStatus: "Valid" | "Invalid" | "Expired";
  certificateLockStatus: "Locked" | "Unlocked";
  softwareVersion: string;
};

export type Suite = {
  id: string;
  name: string;
  devices: string[];
  ipAddresses: number[];
  status: "Valid" | "Invalid";
};

export type Dimensions = {
  auditoriumWidth?: number;
  auditoriumHeight?: number;
  auditoriumDepth?: number;
  screenWidth?: number;
  screenHeight?: number;
  throwDistance?: number;
  gain?: number;
};

export type Projection = {
  /** Projector technology as free text, e.g. Laser, Xenon. */
  type?: string;
  manufacturer?: string;
  masking?: boolean;
  /** DCI, E-Cinema or Film (screenExperienceData.projectionTypes). */
  projectionType?: string;
  /** E.g. IMAX Laser, 4DX (screenExperienceData.projectionExperiences). */
  experiences?: string[];
};

export type Sound = {
  processor?: string;
  speakers?: string;
  soundMixes: string[];  // This is required
  iabSupported?: boolean;
  /** 5.1, 7.1, IAB (screenExperienceData.audioExperiences). */
  audioExperiences?: string[];
};

export type TemporaryClosure = {
  id: string;
  startDate: string;
  endDate?: string;
  reason: string;
  notes?: string;
  active: boolean;
};

export type Screen = {
  id: string;
  theatreId: string;
  number: string;
  name: string;
  uuid: string;
  thirdPartyId?: string;
  operators?: Operator[];
  autoScreenUpdateLock: boolean;
  flmManagementLock: boolean;
  multiThumbprintKdmScreen: boolean;
  status: "Active" | "Inactive" | "Deleted";
  closureNotes?: string;
  seatingCapacity?: number;
  coolingType?: string;
  wheelchairAccessibility: boolean;
  motionSeats: boolean;
  dimensions?: Dimensions;
  projection?: Projection;
  sound?: Sound;
  devices: ScreenDevice[];
  ipAddresses: IPAddress[];
  suites: Suite[];
  temporaryClosures?: TemporaryClosure[];
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
};

export type DeliveryAddress = {
  useTheatreAddress: boolean;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type DeliveryTimeSlot = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
};

export type DCPPhysicalDeliveryMethod = {
  id: string;
  mediaType: string;
  details: string;
};

export type DCPNetworkDeliveryMethod = {
  id: string;
  networkURL: string;
};

export type DCPModemDeliveryMethod = {
  id: string;
  modemPhoneNumber: string;
};

export type Contact = {
  id: string;
  name?: string;
  email: string;
  phone?: string;
};

export type TheatreMapping = {
  id: string;
  domain: string;
  theatreId: string;
};

export type DownloadRestrictions = {
  sunday: { startTime: string; endTime: string };
  monday: { startTime: string; endTime: string };
  tuesday: { startTime: string; endTime: string };
  wednesday: { startTime: string; endTime: string };
  thursday: { startTime: string; endTime: string };
  friday: { startTime: string; endTime: string };
  saturday: { startTime: string; endTime: string };
};

export type Theatre = {
  id: string;
  name: string;
  displayName: string;
  alternateNames?: string[];
  uuid: string;
  thirdPartyId?: string;
  chainId: string;
  chainName: string;
  companyId: string;
  companyName: string;
  exhibitorIntegratorCompanies?: string[];
  theatreMappings?: TheatreMapping[];
  listing?: TheatreListing;
  type: string;
  address: string;
  city: string;
  state: string;
  country: string;
  /** Locations city; city, state, country and timezone follow it. */
  cityId?: string | null;
  postalCode: string;
  phoneNumber: string;
  email: string;
  website?: string;
  timezone?: string;
  wireTap?: string;
  screenCount: number;
  status: "Active" | "Inactive" | "Closed";
  adIntegrators?: string[];
  screens?: Screen[];
  notes?: string;
  closureDetails?: string;
  latitude?: number;
  longitude?: number;
  locationType?: string;
  bikeParkingAvailable?: boolean;
  bikeParkingCapacity?: number;
  carParkingAvailable?: boolean;
  carParkingCapacity?: number;
  /** Credentials Manager TMS entry; must be linked to the theatre's chain. */
  tmsId?: string | null;
  /** Read-only: the TMS's name. */
  theatreManagementSystem?: string | null;
  /** Credentials Manager Ticketing System entry. */
  ticketingSystemId?: string | null;
  /** Read-only: the ticketing system's name. */
  ticketingSystem?: string | null;
  startDate?: string;
  contact?: string;
  deliveryAddress?: DeliveryAddress;
  deliveryInstructions?: string;
  deliveryTimeSlots?: DeliveryTimeSlot[];
  dcpPhysicalDeliveryMethods?: DCPPhysicalDeliveryMethod[];
  dcpNetworkDeliveryMethods?: DCPNetworkDeliveryMethod[];
  dcpModemDeliveryMethods?: DCPModemDeliveryMethod[];
  dcpDeliveryContacts?: Contact[];
  sendEmailsForDCPDelivery?: boolean;
  dcpContentTypesForEmail?: string[];
  keyDeliveryContacts?: Contact[];
  kdmDeliveryEmailsInFLMX?: string;
  autoIngestOfContentEnabled?: boolean;
  autoIngestContentTypes?: string[];
  /** When enabled content types are auto-ingested; none means any time. */
  autoIngestTimeSlots?: DeliveryTimeSlot[];
  /** When KDMs are auto-ingested; none means any time. */
  kdmAutoIngestTimeSlots?: DeliveryTimeSlot[];
  qcnTheatreIPAddressRange?: string;
  wireTAPDevices?: WireTAPDevice[];
  downloadRestrictionsEnabled?: boolean;
  downloadRestrictions?: DownloadRestrictions;
  liveWireEnabled?: boolean;
  liveWireConfig?: {
    multicastIp: string;
    port: string;
    lanIp: string;
    prodUsername: string;
    prodPassword: string;
  };
  configurationNotes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
};

export type WireTAPDevice = {
  id: string;
  serialNumber: string;
  mappingStatus: string;
  theatreId: string;
  theatreName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type Chain = {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  theatreCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  /** TMSes (Credentials Manager) this chain's theatres may use. */
  tms?: { id: string; name: string }[];
};

export type Company = {
  id: string;
  name: string;
  chainCount: number;
  theatreCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TDLDevice = {
  id: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  softwareVersion: string;
  deviceRole: string;
  certificateAutoSync: boolean;
  validTill: string;
  publicKeyThumbprint: string;
  issuerThumbprint: string;
  source: string;
  retired: boolean;
  updatedBy: string;
  updatedOn: string;
  certificateStatus: string;
  firmwareVersion: string;
  autoUpdateCertificate: boolean;
};

export type DashboardStats = {
  totalTheatres: number;
  activeTheatres: number;
  totalScreens: number;
  totalDevices: number;
  totalCompanies: number;
  totalChains: number;
  recentlyAddedTheatres: Theatre[];
  recentlyUpdatedTheatres: Theatre[];
  theatresByStatus: { status: string; count: number }[];
  theatresByType: { type: string; count: number }[];
};
