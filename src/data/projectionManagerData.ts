
export type QualityStatus = "within_limits" | "outside_limits";
export type ScoreCategory = "good" | "average" | "poor";

export interface ProjectionScreenRecord {
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
  scoreCategory: ScoreCategory;
  projectionQuality: { value: string; status: QualityStatus };
  soundQuality: { value: string; status: QualityStatus };
}

const chains = ["AMC", "Regal", "Cinemark", "Odeon", "PVR", "CGV", "Cinépolis", "Village", "Pathé", "IMAX"];
const locations = [
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

const projectionLabels = {
  within_limits: ["Excellent clarity", "Sharp focus", "Good brightness", "Uniform illumination", "Accurate colors"],
  outside_limits: ["Focus drift detected", "Low brightness", "Uneven illumination", "Color shift", "Flicker detected"],
};
const soundLabels = {
  within_limits: ["Balanced output", "Clear dialogue", "Good surround", "Low distortion", "Proper calibration"],
  outside_limits: ["Bass imbalance", "Dialogue unclear", "Surround dropout", "High distortion", "Calibration needed"],
};

function categorize(score: number): ScoreCategory {
  if (score >= 71) return "good";
  if (score >= 41) return "average";
  return "poor";
}

function randomQuality(pool: Record<string, string[]>, status: QualityStatus) {
  const labels = pool[status];
  return { value: labels[Math.floor(Math.random() * labels.length)], status };
}

export const projectionScreenData: ProjectionScreenRecord[] = Array.from({ length: 200 }, (_, i) => {
  const loc = locations[i % locations.length];
  const score = Math.floor(Math.random() * 100) + 1;
  const projStatus: QualityStatus = Math.random() < 0.65 ? "within_limits" : "outside_limits";
  const soundStatus: QualityStatus = Math.random() < 0.65 ? "within_limits" : "outside_limits";
  return {
    id: `proj-${String(i + 1).padStart(3, "0")}`,
    screenName: `Screen ${(i % 15) + 1}`,
    theatreName: theatreNames[i % theatreNames.length],
    chainName: chains[i % chains.length],
    city: loc.city,
    state: loc.state,
    country: loc.country,
    score,
    scoreCategory: categorize(score),
    projectionQuality: randomQuality(projectionLabels, projStatus),
    soundQuality: randomQuality(soundLabels, soundStatus),
  };
});

export const projectionScoreBins = [
  { label: "1-10", min: 1, max: 10 },
  { label: "11-20", min: 11, max: 20 },
  { label: "21-30", min: 21, max: 30 },
  { label: "31-40", min: 31, max: 40 },
  { label: "41-50", min: 41, max: 50 },
  { label: "51-60", min: 51, max: 60 },
  { label: "61-70", min: 61, max: 70 },
  { label: "71-80", min: 71, max: 80 },
  { label: "81-90", min: 81, max: 90 },
  { label: "91-100", min: 91, max: 100 },
];
