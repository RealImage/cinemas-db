
export type RatingStatus = "within_theatre_baseline" | "within_recommended_baseline" | "out_of_range";

export interface EnvironmentMetric {
  value: number;
  unit: string;
  status: RatingStatus;
}

export interface EnvironmentScreenRecord {
  id: string;
  screenName: string;
  /** CinemaDB theatre id (set by the API; the mock rows have none) */
  theatreId?: string;
  theatreName: string;
  chainName: string;
  city: string;
  state: string;
  country: string;
  score: number;
  onTemperature: EnvironmentMetric;
  onHumidity: EnvironmentMetric;
  onDust: EnvironmentMetric;
  offTemperature: EnvironmentMetric;
  offHumidity: EnvironmentMetric;
  offDust: EnvironmentMetric;
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

function randomStatus(): RatingStatus {
  const r = Math.random();
  if (r < 0.45) return "within_theatre_baseline";
  if (r < 0.8) return "within_recommended_baseline";
  return "out_of_range";
}

function randomTemp(status: RatingStatus): EnvironmentMetric {
  // Theatre baseline: 20-24°C, Recommended: 18-26°C, Out of range: 15-17 or 27-32
  let value: number;
  if (status === "within_theatre_baseline") value = 20 + Math.random() * 4;
  else if (status === "within_recommended_baseline") value = Math.random() > 0.5 ? 18 + Math.random() * 2 : 24 + Math.random() * 2;
  else value = Math.random() > 0.5 ? 15 + Math.random() * 2 : 27 + Math.random() * 5;
  return { value: Math.round(value * 10) / 10, unit: "°C", status };
}

function randomHumidity(status: RatingStatus): EnvironmentMetric {
  let value: number;
  if (status === "within_theatre_baseline") value = 40 + Math.random() * 15;
  else if (status === "within_recommended_baseline") value = Math.random() > 0.5 ? 30 + Math.random() * 10 : 55 + Math.random() * 10;
  else value = Math.random() > 0.5 ? 15 + Math.random() * 15 : 65 + Math.random() * 20;
  return { value: Math.round(value), unit: "%", status };
}

function randomDust(status: RatingStatus): EnvironmentMetric {
  let value: number;
  if (status === "within_theatre_baseline") value = 5 + Math.random() * 20;
  else if (status === "within_recommended_baseline") value = 25 + Math.random() * 25;
  else value = 50 + Math.random() * 100;
  return { value: Math.round(value), unit: "µg/m³", status };
}

export const environmentScreenData: EnvironmentScreenRecord[] = Array.from({ length: 200 }, (_, i) => {
  const loc = cities[i % cities.length];
  const theatre = theatreNames[i % theatreNames.length];
  const chain = chains[i % chains.length];
  return {
    id: `env-${String(i + 1).padStart(3, "0")}`,
    screenName: `Screen ${(i % 15) + 1}`,
    theatreName: theatre,
    chainName: chain,
    city: loc.city,
    state: loc.state,
    country: loc.country,
    score: Math.floor(Math.random() * 121),
    onTemperature: randomTemp(randomStatus()),
    onHumidity: randomHumidity(randomStatus()),
    onDust: randomDust(randomStatus()),
    offTemperature: randomTemp(randomStatus()),
    offHumidity: randomHumidity(randomStatus()),
    offDust: randomDust(randomStatus()),
  };
});

export const scoreRangeBins = [
  { label: "0", min: 0, max: 0 },
  { label: "1-10", min: 1, max: 10 },
  { label: "11-20", min: 11, max: 20 },
  { label: "21-30", min: 21, max: 30 },
  { label: "31-40", min: 31, max: 40 },
  { label: "41-50", min: 41, max: 50 },
  { label: "51-60", min: 51, max: 60 },
  { label: "61-70", min: 61, max: 70 },
  { label: "71-80", min: 71, max: 80 },
  { label: "81-90", min: 81, max: 90 },
  { label: "91-120", min: 91, max: 120 },
];
