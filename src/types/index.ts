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

/** Which reason list a screen status needs: deactivating and deleting each have their own. */
export const SCREEN_STATUS_REASON_TYPES = { Inactive: "DEACTIVATE_SCREEN", Deleted: "DELETE_SCREEN" } as const;
/** Reason type for a theatre deletion request. */
export const THEATRE_DELETION_REASON_TYPE = "DELETE_THEATRE";
export type StatusReasonType =
  | (typeof SCREEN_STATUS_REASON_TYPES)[keyof typeof SCREEN_STATUS_REASON_TYPES]
  | typeof THEATRE_DELETION_REASON_TYPE;
export type StatusReason = { id: string; reasonType: StatusReasonType; reason: string };

/** A soft-deleted theatre can be deleted permanently this long after the deletion was approved. */
export const THEATRE_PERMANENT_DELETE_HOURS = 48;

export type TheatreDeletionStatus = "Pending" | "Approved" | "Rejected" | "Restored";

/** A row of the Theatre Deletions queue (Approvals & Conflicts). */
export type TheatreDeletionRequest = {
  id: string;
  theatreId: string;
  theatreName: string;
  chainName: string;
  city: string;
  screenCount: number;
  reasonId: string;
  reason: string;
  comments: string;
  status: TheatreDeletionStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComments: string | null;
  /** Set once approved (the theatre is soft-deleted). */
  deletedAt: string | null;
  deletedBy: string | null;
  /** deletedAt + THEATRE_PERMANENT_DELETE_HOURS. */
  permanentDeleteFrom: string | null;
};

export type ScreenOption = { id: string; name: string };
/** Choices for a screen's picture fields: lookup masters and industry companies by role. */
export type ScreenOptions = {
  screenTypes: ScreenOption[];
  threeDModels: ScreenOption[];
  screenManufacturers: ScreenOption[];
  digitalIntegrators: ScreenOption[];
  datasatProviders: ScreenOption[];
  adConsolidators: ScreenOption[];
};

/** A screen tracks IMAX integration only when it has an IMAX projection experience. */
/** Safe on untrusted input: anything but an array of strings has no IMAX experience. */
export const isImaxScreen = (experiences: unknown) =>
  Array.isArray(experiences) && experiences.some((x) => typeof x === "string" && x.startsWith("IMAX"));

export const IMAX_INTEGRATION_TYPES = ["WireTAP", "TMS", "Both"] as const;
export type ImaxIntegrationType = (typeof IMAX_INTEGRATION_TYPES)[number];

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
  automation?: boolean;
  imaxIntegrated?: boolean;
  /** Required when imaxIntegrated. */
  imaxIntegrationType?: ImaxIntegrationType | null;
  status: "Active" | "Inactive" | "Deleted";
  /** Why an Inactive or Deleted screen is in that state (a status_reasons id); null while Active. */
  statusReasonId?: string | null;
  /** The reason's text, as returned by the API. */
  statusReason?: string | null;
  statusComments?: string | null;
  /** Picture fields (ids into GET /api/screens/options). */
  screenTypeId?: string | null;
  screenManufacturerId?: string | null;
  digitalIntegratorId?: string | null;
  threeDModelIds?: string[];
  datasatProviderIds?: string[];
  adConsolidatorIds?: string[];
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
  /** Null when not set. */
  listing: TheatreListing | null;
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
  /** Deleted: soft-deleted by an approved deletion request (read-only; restore it to edit). */
  status: "Active" | "Inactive" | "Closed" | "Deleted";
  /** Read-only: when the theatre was soft-deleted, and when it may be deleted permanently. */
  deletedAt?: string | null;
  deletedBy?: string | null;
  permanentDeleteFrom?: string | null;
  /** Read-only: the deletion request waiting for approval, if any. */
  pendingDeletion?: { id: string; reason: string; requestedBy: string; requestedAt: string } | null;
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
  /** POS / ticketing systems (Credentials Manager) this chain's theatres may use. */
  ticketingSystems?: { id: string; name: string }[];
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
