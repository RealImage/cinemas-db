// Screen presentation options set in the theatre definition (screen Projection
// and Sound tabs) and shown in the WTF panel.

export const projectionTypes = ["DCI", "E-Cinema", "Film"] as const;
export type ProjectionType = (typeof projectionTypes)[number];

export const projectionExperiences = [
  "4DX", "AMC Prime", "CGS", "Cinemark XD", "Dolby Cinema", "EPIQ", "EPIQ Luxon", "IMAX", "IMAX Laser",
  "IMAX Laser(ICLPS)", "IMAX Laser(XT)", "IMAX Xenon", "Normal", "Onyx LED", "Regal RPX", "Screen X", "VMax",
] as const;

export const audioExperiences = ["5.1", "7.1", "IAB"] as const;

// Spellings match what screens store in sound.soundMixes.
export const soundMixes = ["5.1 Surround", "7.1 Surround", "Dolby Atmos", "Auro 3D", "DTS:X", "IMAX Enhanced"] as const;
