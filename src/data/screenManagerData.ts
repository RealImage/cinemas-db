
export interface ScreenRecord {
  id: string;
  /** CinemaDB theatre id (set by the API; the mock rows have none) */
  theatreId?: string;
  theatreName: string;
  chainName: string;
  screenName: string;
  city: string;
  state: string;
  country: string;
  pulseInstalled: boolean;
  lionisInstalled: boolean;
  pulseSerialNumber?: string;
  pulseInstalledOn?: string;
  pulseInstalledBy?: string;
  lionisSerialNumber?: string;
  lionisInstalledOn?: string;
  lionisInstalledBy?: string;
  updatedOn: string;
  updatedBy: string;
}

const chains = ["AMC", "Regal", "Cinemark", "Odeon", "PVR", "CGV", "Cinépolis", "Village", "Pathé", "IMAX"];
const cities = [
  { city: "New York", state: "NY", country: "USA" },
  { city: "Los Angeles", state: "CA", country: "USA" },
  { city: "Chicago", state: "IL", country: "USA" },
  { city: "London", state: "England", country: "UK" },
  { city: "Mumbai", state: "Maharashtra", country: "India" },
  { city: "Seoul", state: "Seoul", country: "South Korea" },
  { city: "Mexico City", state: "CDMX", country: "Mexico" },
  { city: "Melbourne", state: "VIC", country: "Australia" },
  { city: "Rotterdam", state: "South Holland", country: "Netherlands" },
  { city: "Toronto", state: "ON", country: "Canada" },
  { city: "Berlin", state: "Berlin", country: "Germany" },
  { city: "Tokyo", state: "Tokyo", country: "Japan" },
  { city: "Paris", state: "Île-de-France", country: "France" },
  { city: "São Paulo", state: "SP", country: "Brazil" },
  { city: "Dubai", state: "Dubai", country: "UAE" },
];
const theatreNames = [
  "AMC Empire 25", "AMC Lincoln Square", "Regal Union Square", "Regal Times Square",
  "Cinemark Century City", "Cinemark Playa Vista", "Odeon Leicester Square", "Odeon Luxe",
  "PVR Phoenix", "PVR INOX", "CGV Yongsan", "CGV Gangnam",
  "Cinépolis Diana", "Cinépolis Perisur", "Village Crown", "Village Jam Factory",
  "Pathé Schouwburg", "Pathé De Munt", "IMAX Lincoln", "IMAX Waterloo",
  "AMC Burbank", "Regal LA Live", "Cinemark XD North", "Odeon Marble Arch",
  "PVR Juhu", "CGV Busan", "Cinépolis Polanco", "Village Doncaster",
  "Pathé Arena", "IMAX Melbourne",
];
const names = ["John Smith", "Sarah Connor", "James Lee", "Maria Garcia", "Anil Kumar", "Kim Soo-jin", "Carlos Mendez", "Emily Watson", "Hans Mueller", "Yuki Tanaka"];

function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString();
}

export const screenManagerData: ScreenRecord[] = Array.from({ length: 250 }, (_, i) => {
  const loc = cities[i % cities.length];
  const theatre = theatreNames[i % theatreNames.length];
  const chain = chains[i % chains.length];
  const pulse = Math.random() > 0.3;
  const lionis = Math.random() > 0.4;
  return {
    id: `scr-${String(i + 1).padStart(3, "0")}`,
    theatreName: theatre,
    chainName: chain,
    screenName: `Screen ${(i % 15) + 1}`,
    city: loc.city,
    state: loc.state,
    country: loc.country,
    pulseInstalled: pulse,
    lionisInstalled: lionis,
    pulseSerialNumber: pulse ? `PSN-${1000 + i}` : undefined,
    pulseInstalledOn: pulse ? randomDate(new Date(2023, 0, 1), new Date(2025, 11, 31)) : undefined,
    pulseInstalledBy: pulse ? names[i % names.length] : undefined,
    lionisSerialNumber: lionis ? `LSN-${2000 + i}` : undefined,
    lionisInstalledOn: lionis ? randomDate(new Date(2023, 0, 1), new Date(2025, 11, 31)) : undefined,
    lionisInstalledBy: lionis ? names[(i + 3) % names.length] : undefined,
    updatedOn: randomDate(new Date(2025, 0, 1), new Date(2026, 2, 8)),
    updatedBy: names[(i + 5) % names.length],
  };
});
