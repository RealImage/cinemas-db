export type FlmSource = "MACCS" | "DCIP" | "Qube Radar" | "Cinergy" | "Sony" | "KDMx";
export type FlmStatus = "Auto-Updated" | "Manual" | "Auto-Updated / Mapped";

export interface FlmContact {
  name: string;
  phone: string;
  email: string;
}

export interface FlmAuditorium {
  id: string;
  name: string;
  seatingCapacity: number;
  suiteCount: number;
  devices: { manufacturer: string; model: string; serialNumber: string }[];
}

export interface FlmFacilityDetails {
  city: string;
  state: string;
  country: string;
  postalCode: string;
  timezone: string;
  contact: FlmContact;
  alternateIds: string[];
  auditoriums: FlmAuditorium[];
}

/** A feed's own theatre identity for the info hover card: the theatre may not be in CinemaDB yet. */
export const feedTheatreDetails = (f: Pick<FlmFeed, "theatreName" | "theatreDisplayName" | "theatreUuid" | "address">) => ({
  name: f.theatreName,
  alternateNames: f.theatreDisplayName && f.theatreDisplayName !== f.theatreName ? [f.theatreDisplayName] : [],
  uuid: f.theatreUuid || null,
  address: f.address || null,
});

export interface FlmFeed {
  id: string;
  theatreName: string;
  theatreDisplayName: string;
  address: string;
  theatreUuid: string;
  chain: string;
  location: string;
  theatreIdFeed: string;
  source: FlmSource;
  isNewTheatre: boolean;
  receivedOn: string;
  status: FlmStatus;
  mappedTheatreId?: string;
  details?: FlmFacilityDetails;
}

export const flmFeeds: FlmFeed[] = [
  {
    id: "1",
    theatreName: "Cineplex Berlin Mitte",
    theatreDisplayName: "Cineplex Mitte",
    address: "Friedrichstrasse 112, Berlin",
    theatreUuid: "e0b1c2d3-4f56-4a78-9b01-2c3d4e5f6a71",
    chain: "Cineplex",
    location: "Berlin, Berlin, Germany",
    theatreIdFeed: "maccs.com:DE20235311",
    source: "MACCS",
    isNewTheatre: true,
    receivedOn: "2026-09-05T09:14:00Z",
    status: "Manual",
  },
  {
    id: "2",
    theatreName: "Unknown Facility 133000",
    theatreDisplayName: "Unknown Facility",
    address: "Address not provided",
    theatreUuid: "b7d2f1a0-1122-4c33-8d44-55e6f7a8b901",
    chain: "Unassigned",
    location: "Unknown, Unknown, Unknown",
    theatreIdFeed: "URI_Unknown:133000",
    source: "KDMx",
    isNewTheatre: true,
    receivedOn: "2026-09-05T08:02:00Z",
    status: "Manual",
  },
  {
    id: "3",
    theatreName: "Odeon Leicester Square",
    theatreDisplayName: "Odeon Luxe Leicester Sq",
    address: "24-26 Leicester Square, London",
    theatreUuid: "aa11bb22-cc33-4d44-9e55-6f7788990011",
    chain: "Odeon",
    location: "London, England, United Kingdom",
    theatreIdFeed: "maccs.com:GB20235310",
    source: "MACCS",
    isNewTheatre: false,
    receivedOn: "2026-09-04T17:41:00Z",
    status: "Manual",
    mappedTheatreId: "2",
    details: {
      city: "London",
      state: "England",
      country: "United Kingdom",
      postalCode: "WC2H 7NA",
      timezone: "Europe/London",
      contact: { name: "Sarah Mitchell", phone: "+44 20 7766 9600", email: "manager@odeon.co.uk" },
      alternateIds: ["rentrak.com:991288", "urn:uuid:aa11bb22-cc33-4d44-9e55-6f7788990011"],
      auditoriums: [
        { id: "1", name: "Screen 1", seatingCapacity: 800, suiteCount: 1, devices: [{ manufacturer: "Dolby", model: "IMS3000", serialNumber: "DOL-31084" }] },
        { id: "2", name: "Screen 2", seatingCapacity: 350, suiteCount: 1, devices: [{ manufacturer: "Christie", model: "CP4230", serialNumber: "CHR-22910" }] },
      ],
    },
  },
  {
    id: "4",
    theatreName: "Omniplex Dublin Santry",
    theatreDisplayName: "Omniplex Santry",
    address: "Omni Park SC, Santry, Dublin",
    theatreUuid: "cc44dd55-ee66-4f77-8899-00aabbccddee",
    chain: "Omniplex",
    location: "Dublin, Leinster, Ireland",
    theatreIdFeed: "maccs.com:IE20235307",
    source: "MACCS",
    isNewTheatre: false,
    receivedOn: "2026-09-04T15:20:00Z",
    status: "Auto-Updated",
  },
  {
    id: "5",
    theatreName: "Caribbean Cinemas Megaplex",
    theatreDisplayName: "Caribbean Megaplex 10",
    address: "Av. Winston Churchill, Santo Domingo",
    theatreUuid: "ff00aa11-2233-4455-8677-99aabbcc0011",
    chain: "Caribbean Cinemas",
    location: "Santo Domingo, Distrito Nacional, Dominican Republic",
    theatreIdFeed: "maccs.com:DO20235309",
    source: "MACCS",
    isNewTheatre: true,
    receivedOn: "2026-09-04T11:05:00Z",
    status: "Manual",
  },
  {
    id: "6",
    theatreName: "Regal Union Square",
    theatreDisplayName: "Regal Union Sq ScreenX",
    address: "850 Broadway, New York, NY",
    theatreUuid: "11223344-5566-4778-899a-bbccddeeff00",
    chain: "Regal Cinemas",
    location: "New York, New York, United States",
    theatreIdFeed: "regalcinemas.com:1487",
    source: "DCIP",
    isNewTheatre: false,
    receivedOn: "2026-09-03T22:31:00Z",
    status: "Auto-Updated",
  },
  {
    id: "7",
    theatreName: "PVR Phoenix Mills",
    theatreDisplayName: "PVR Icon Phoenix",
    address: "Lower Parel, Mumbai",
    theatreUuid: "99887766-5544-4332-9110-aabbccdd1122",
    chain: "PVR INOX",
    location: "Mumbai, Maharashtra, India",
    theatreIdFeed: "sony.com:IN20235306",
    source: "Sony",
    isNewTheatre: false,
    receivedOn: "2026-09-03T13:47:00Z",
    status: "Auto-Updated",
  },
  {
    id: "8",
    theatreName: "Total Cinema Solutions Site 1002279",
    theatreDisplayName: "TCS Site 1002279",
    address: "Industrial Park Rd, Sydney",
    theatreUuid: "5566aabb-ccdd-4eef-8011-223344556677",
    chain: "Independent",
    location: "Sydney, New South Wales, Australia",
    theatreIdFeed: "totalcinemasolutions.com:1002279",
    source: "Cinergy",
    isNewTheatre: true,
    receivedOn: "2026-09-03T07:12:00Z",
    status: "Manual",
  },
  {
    id: "9",
    theatreName: "AMC Century City 15",
    theatreDisplayName: "AMC Century City",
    address: "10250 Santa Monica Blvd, Los Angeles, CA",
    theatreUuid: "abcd1234-5678-4901-8234-56789abcdef0",
    chain: "AMC Theatres",
    location: "Los Angeles, California, United States",
    theatreIdFeed: "maccs.com:US20235304",
    source: "MACCS",
    isNewTheatre: false,
    receivedOn: "2026-09-02T19:58:00Z",
    status: "Auto-Updated",
  },
  {
    id: "10",
    theatreName: "Kinepolis Antwerpen",
    theatreDisplayName: "Kinepolis Antwerp",
    address: "Groenendaallaan 394, Antwerpen",
    theatreUuid: "778899aa-bbcc-4dde-8ff0-112233445566",
    chain: "Kinepolis",
    location: "Antwerp, Flanders, Belgium",
    theatreIdFeed: "maccs.com:BE20235303",
    source: "MACCS",
    isNewTheatre: false,
    receivedOn: "2026-09-02T10:24:00Z",
    status: "Auto-Updated",
  },
  {
    id: "11",
    theatreName: "Qube Test Facility 235302",
    theatreDisplayName: "Qube Test Facility",
    address: "Qube Cinema, Chennai",
    theatreUuid: "0f1e2d3c-4b5a-4697-8887-99aabbccddee",
    chain: "Qube",
    location: "Chennai, Tamil Nadu, India",
    theatreIdFeed: "cinemadb.io:235302",
    source: "Qube Radar",
    isNewTheatre: true,
    receivedOn: "2026-09-01T16:09:00Z",
    status: "Manual",
  },
  {
    id: "12",
    theatreName: "AMC Empire 25",
    theatreDisplayName: "AMC Empire 25 Times Sq",
    address: "234 W 42nd St, New York, NY",
    theatreUuid: "13579bdf-2468-4ace-9012-3456789abcde",
    chain: "AMC Theatres",
    location: "New York, New York, United States",
    theatreIdFeed: "amctheatres.com:2660",
    source: "DCIP",
    isNewTheatre: false,
    receivedOn: "2026-09-01T06:33:00Z",
    status: "Auto-Updated",
  },
];
