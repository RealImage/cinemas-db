import { backfillsSeeder } from "./backfills";
import { credentialsSeeder } from "./credentials";
import { theatreSystemsSeeder } from "./theatreSystems";
import { fleetSeeder } from "./fleet";
import { agentConfigsSeeder } from "./agentConfigs";
import { theatreDefinitionsSeeder } from "./theatreDefinitions";
import { screenPulseSeeder } from "./screenPulse";
import { locationsSeeder } from "./locations";
import { flmSubscriptionsSeeder } from "./flmSubscriptions";
import { flmSyncSeeder } from "./flmSync";
import type { ExtraSeeder } from "./types";

/** Run after the core seed, in this order. */
export const extraSeeders: ExtraSeeder[] = [backfillsSeeder, credentialsSeeder, theatreSystemsSeeder, fleetSeeder, agentConfigsSeeder, screenPulseSeeder, theatreDefinitionsSeeder, locationsSeeder, flmSubscriptionsSeeder, flmSyncSeeder];
