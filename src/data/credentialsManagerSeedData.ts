// Sample Credentials Manager records, used only by db/seeds/credentials.ts.
import { chains, theatres } from "./mockData";
import {
  CredentialDevice,
  CredentialFieldDef,
  CredentialScope,
  DciCompliance,
  DeviceType,
  GLOBAL_REF,
  ScopedCredential,
  countryOptions,
  extraChainNames,
} from "./credentialsManagerData";

const chainOptions = Array.from(
  new Set([...chains.map((c) => c.name), ...extraChainNames]),
).sort();
const theatreOptions = theatres.map((t) => t.name).sort();

type SeedRow = [string, string, string[], DeviceType, DciCompliance, string[], string, string];

// Sample rows: [brand, model, roles, type, dci, translations, updatedBy, updatedAt]
const rows: SeedRow[] = [
  ["Barco", "SP4K-55", [], "Projector", "true", ["SP4K 55", "SP4K55", "SP4K-55B", "SP4K 55B", "SP4K 55 B"], "Ketan Mehta", "2022-01-25T15:11:00+05:30"],
  ["Barco", "DP2K-11Cx", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:11:00+05:30"],
  ["Barco", "LS4K", [], "Projector", "true", ["HDR - LS4K"], "Vaibhav Shete", "2025-08-29T17:29:00+05:30"],
  ["Barco", "DP-1200", ["PR"], "Projector", "true", ["DP1200", "DP 1200"], "Andre Lopes", "2019-01-30T15:11:00+05:30"],
  ["Barco", "ICP-D", ["PR"], "Projector", "true", ["ICP D"], "Sam Mary", "2024-09-12T14:28:00+05:30"],
  ["Barco", "SP4K-15", [], "Projector", "true", ["SP4K 15", "SP4K15", "SP4K-15C", "SP4K 15C", "SP4K15C", "SP4K-15B", "DP4K-15C"], "Ketan Mehta", "2024-01-24T16:58:00+05:30"],
  ["Barco", "DP2K-23B", ["LD", "PR"], "Projector", "true", ["DP2K 23B", "DP2K-23", "DP2K 23BLP", "DP2K-23BLP", "DP2K-23B-RGB+", "DP2K-23-B"], "Ketan Mehta", "2024-01-23T20:01:00+05:30"],
  ["Barco", "SP4K-27HC", [], "Projector", "true", ["SP4K 27HC", "SP4K27HC", "SP4K-27BHC"], "Andre Lopes", "2023-11-24T19:13:00+05:30"],
  ["Barco", "SP4K-25", [], "Projector", "true", ["SP4K 25", "SP4K25", "SP4K-25C", "SP4K-25B"], "Andre Lopes", "2023-11-24T19:11:00+05:30"],
  ["Barco", "DP-3000", ["PR", "LD"], "Projector", "true", ["DP3000", "DP 3000"], "", "2018-08-24T16:09:00+05:30"],
  ["Barco", "DP-2000", ["PR", "LD"], "Projector", "true", ["DP2000", "DP 2000"], "", "2018-08-24T16:09:00+05:30"],
  ["Barco", "SP4K-20", [], "Projector", "true", ["SP4K 20", "SP4K20", "SP4K-20C", "SP4K20C", "SP4K 20C", "SP4K-20B"], "Andre Lopes", "2023-11-24T19:10:00+05:30"],
  ["Barco", "APX32", ["SM", "SPB", "MDA", "FMA"], "Playback Server", "true", [], "Poombavai Sivamani", "2026-09-09T19:13:00+05:30"],
  ["Barco", "ICMP", ["SM", "PR"], "Playback Server", "true", ["IMS", "IMS Integrated Media Block", "ICMP Integrated Media Block", "Alchemy", "NONE", "ICMP-X", "ICMP X", "ICMP-X w/ SDI/IP"], "Ketan Mehta", "2024-01-23T20:33:00+05:30"],
  ["Barco", "SP2K-15", [], "Projector", "true", ["SP2K 15", "SP2K 15S", "SP2K-15S", "SP2K-15C"], "Andre Lopes", "2023-11-24T19:11:00+05:30"],
  ["Barco", "ICMP-XS", ["PR", "SM", "SMS", "MIC"], "Playback Server", "true", ["ICMP‑XS"], "Shivaraman Raghuraman", "2026-08-28T20:22:00+05:30"],
  ["Barco", "DP4K-20LHC", [], "Projector", "true", ["DP4K-20L"], "Ketan Mehta", "2021-05-13T12:40:00+05:30"],
  ["Barco", "DP2K-8S", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:12:00+05:30"],
  ["Barco", "DPC4K-80", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:14:00+05:30"],
  ["Barco", "DP2K-8SLP", [], "Projector", "true", [], "Ketan Mehta", "2021-05-13T12:31:00+05:30"],
  ["Barco", "DP4K-60L", ["PR"], "Projector", "true", ["DP60L", "DP4K60L", "DP4K 60L", "DP4K-60LHC"], "Ketan Mehta", "2021-05-12T22:17:00+05:30"],
  ["Barco", "DP2K-10SLP", [], "Projector", "true", ["DP2K10SLP"], "Ketan Mehta", "2021-05-12T22:16:00+05:30"],
  ["Barco", "DP2K-10Sx", ["PR"], "Projector", "true", ["DP2K-10SX", "DP2K-10S"], "Ketan Mehta", "2021-05-12T22:13:00+05:30"],
  ["Barco", "SP2K-11", [], "Projector", "true", ["SP2K-11S", "SP2K 11S", "SP2K 11"], "Ketan Mehta", "2022-01-25T15:18:00+05:30"],
  ["Barco", "DP2K-36B", ["PR"], "Projector", "true", ["DP2K 36B", "DP2K36B", "DP2K-36BLP", "DP2K36BLP", "DP2K 36BLP"], "Andre Lopes", "2019-01-30T15:11:00+05:30"],
  ["Barco", "DP2K-15C", ["LD", "PR"], "Projector", "true", ["DP 2K 15C", "DP2K 15C", "DP15C", "DP2K-15CX", "DP2K-15CLP"], "Andre Lopes", "2018-08-26T21:06:00+05:30"],
  ["Barco", "SP2K-9", [], "Projector", "true", ["SP2K-9S", "SP2K 9S", "SP2K 9"], "Ketan Mehta", "2022-01-25T15:17:00+05:30"],
  ["Barco", "DP2K-17B", ["PR"], "Projector", "true", ["DP2K 17B", "DP2K17B", "DP2K-17BLP", "DP2K17BLP", "DP2K 17BLP"], "Andre Lopes", "2019-01-30T15:12:00+05:30"],
  ["Barco", "SP4K-12", [], "Projector", "true", ["SP4K 12", "SP4K12", "SP4K-12C", "SP4K 12C", "SP4K12C", "DP4K-12C"], "Ketan Mehta", "2024-01-24T16:58:00+05:30"],
  ["Barco", "DP4K-18BLPHC", [], "Projector", "true", ["DP4K-18BLP", "DP4K-18", "DP4K-18B", "DP4K-18HC"], "Ketan Mehta", "2021-05-12T22:07:00+05:30"],
  ["Barco", "DP2K-19B", ["PR"], "Projector", "true", ["DP2K 19B", "DP2K 19C"], "Andre Lopes", "2019-01-30T15:13:00+05:30"],
  ["Barco", "DP4K-23B", ["PR"], "Projector", "true", ["DP4K 23B", "DP 4K 23B", "DP4K-23BLP", "DP4K 23BPL"], "Senthil Kumar", "2018-08-24T16:07:00+05:30"],
  ["Barco", "DP4K-36BLP", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:12:00+05:30"],
  ["Barco", "DP4K-17BLP", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:11:00+05:30"],
  ["Barco", "DP4K-22L", ["PR"], "Projector", "true", ["DP22L", "DP4K22L", "DP4K 22L"], "Andre Lopes", "2019-01-30T15:13:00+05:30"],
  ["Barco", "DP2K-6E", ["PR"], "Projector", "true", ["DP6L", "DP2K6E", "DP2K 6E", "DP2K-6", "DP2K 6", "DP2K6", "DP6E", "DP 6E DP-6E"], "Andre Lopes", "2019-01-30T15:13:00+05:30"],
  ["Barco", "SP4K-40", [], "Projector", "true", ["SP4K 40", "SP4K40", "SP4K-40B", "SP4K 40B", "SP4K40B"], "Andre Lopes", "2021-01-11T19:54:00+05:30"],
  ["Barco", "DP4K-13BLPHC", [], "Projector", "true", ["DP4K-13BLP", "DP4K13BLP"], "Ketan Mehta", "2021-05-12T21:59:00+05:30"],
  ["Barco", "DP4K-32B", ["PR", "LD"], "Projector", "true", ["DP4K 32B", "DP4K32B", "DP4K-32BX", "DP4K-32B+", "DP4K-37B+"], "Ketan Mehta", "2024-01-24T16:25:00+05:30"],
  ["Barco", "DP100", ["PR", "LD"], "Projector", "true", ["DP-100", "DP 100"], "Common", "2018-08-24T16:07:00+05:30"],
  ["Barco", "SP2K-7", [], "Projector", "true", ["SP2K 7", "SP2K-7S", "SP2K 7S"], "Ketan Mehta", "2022-01-25T15:15:00+05:30"],
  ["Barco", "DP4K-40LHC", [], "Projector", "true", ["DP4K-40L", "DP4K-40"], "Ketan Mehta", "2021-05-12T22:02:00+05:30"],
  ["Barco", "DP-1500", ["PR", "LD"], "Projector", "true", ["DP1500", "DP 1500"], "Common", "2018-08-24T16:09:00+05:30"],
  ["Barco", "DP2K-10S", ["PR"], "Projector", "true", ["10S", "DP10S", "DP 10S", "DP2K10S", "DP2K-10Sx"], "Ketan Mehta", "2021-05-13T12:33:00+05:30"],
  ["Barco", "DP30", ["PR"], "Projector", "true", ["DP-30", "DP 30"], "Andre Lopes", "2019-01-30T15:10:00+05:30"],
  ["Barco", "DP2K-32B", ["LD"], "Projector", "true", ["DP2K 32B", "DP32B", "DP2K-32BX", "DP2K-37B+"], "Ketan Mehta", "2024-01-24T16:25:00+05:30"],
  ["Barco", "SP4K-35", [], "Projector", "true", ["SP4K 35", "SP4K35", "SP4K-35B", "SP4K 35B", "SP4K35B"], "Andre Lopes", "2021-01-11T19:53:00+05:30"],
  ["Barco", "DP90", ["PR", "LD"], "Projector", "true", [], "", "2018-08-24T16:09:00+05:30"],
  ["Barco", "DP4K-30L", ["PR"], "Projector", "true", ["DP30L", "DP4K30L", "DP4K 30L"], "Andre Lopes", "2019-01-30T15:08:00+05:30"],
  ["Barco", "DP4K-45L", ["PR"], "Projector", "true", ["DP45L", "DP4K45L", "DP4K 45L"], "Andre Lopes", "2019-01-30T15:07:00+05:30"],
  ["Barco", "DPC-80", ["PR"], "Projector", "true", ["DPC 80", "DP80"], "Andre Lopes", "2019-01-30T15:15:00+05:30"],
  ["Barco", "DP4K-19B", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:13:00+05:30"],
  ["Barco", "DP2K-18Cx", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:12:00+05:30"],
  ["Barco", "DP2K-12C", ["LD", "PR"], "Projector", "true", ["DP 2K 12C", "DP2K 12C", "DP12C"], "Common", "2018-08-24T16:09:00+05:30"],
  ["Barco", "DP2K-20C", ["LD", "PR"], "Projector", "true", ["DP2K 20 C", "DP2K 20C", "DP 2K 20C", "DP20C", "DP2K20C", "DP2K-20CX", "DP2K-20CLP"], "Aarthi Videep", "2018-08-24T16:16:00+05:30"],
  ["Christie", "Solaria One+", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:19:00+05:30"],
  ["Christie", "CP4450", [], "Projector", "true", ["CP4450-RGB"], "Andre Lopes", "2021-05-11T21:25:00+05:30"],
  ["Christie", "CP4230", ["PR"], "Projector", "true", ["CP 4230", "CP-4230"], "Senthil Kumar", "2018-08-24T16:07:00+05:30"],
  ["Christie", "CP4325-RGB", [], "Projector", "true", ["CP4325"], "Ketan Mehta", "2021-05-12T21:49:00+05:30"],
  ["Christie", "CP2320-RGB", [], "Projector", "true", ["CP2320", "CP-2320", "CP2320RGB"], "Ketan Mehta", "2021-05-12T22:08:00+05:30"],
  ["Christie", "CP2220", ["LD", "PR"], "Projector", "true", ["CP 2220", "CP-2220"], "", "2018-08-24T16:16:00+05:30"],
  ["Christie", "CP4220", ["PR"], "Projector", "true", ["CP 4220"], "Andre Lopes", "2019-01-30T15:16:00+05:30"],
  ["Christie", "CP2230", ["PR", "LD"], "Projector", "true", ["CP 2230", "CP2230U"], "Ketan Mehta", "2021-05-12T21:50:00+05:30"],
  ["Christie", "CP4315-RGB", [], "Projector", "true", ["CP4315", "CP4315RGB"], "Ketan Mehta", "2022-02-23T20:47:00+05:30"],
  ["Christie", "CP4330-RGB", [], "Projector", "true", ["CP4330"], "Ketan Mehta", "2021-05-12T21:53:00+05:30"],
  ["Christie", "F-IMB", ["SM"], "Playback Server", "true", ["FIMB", "IMBS3", "IMB S3", "IMB-S3"], "Dhanya Rajagopalan", "2019-11-19T12:15:00+05:30"],
  ["Christie", "CP42LH", ["PR"], "Projector", "true", ["CP 42LH", "CP42 LH", "CP 42 LH"], "Andre Lopes", "2019-01-30T15:15:00+05:30"],
  ["Christie", "IMB-S4", ["SM", "MIC"], "Playback Server", "true", ["IMB S4", "IMBS4"], "Sam Mary", "2024-10-10T10:57:00+05:30"],
  ["Christie", "E3LH", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:18:00+05:30"],
  ["Christie", "CP2210", ["PR"], "Projector", "true", ["CP 2210", "CP-2210"], "Andre Lopes", "2018-08-24T16:07:00+05:30"],
  ["Christie", "CP2000", ["PR", "LD"], "Projector", "true", ["CP2000-ZX", "CP2000SB", "CP2000-SB", "CP2000X", "CP2000XB", "CP2000-XB", "CP2000ZX", "CP2000H", "CP2000-H", "CP2000M", "CP2000S", "CP 2000 ZX", "CP 2000 SB", "CP-2000-ZX", "CP2000-М", "CP2000-S", "CP2000-X", "CP2000-M"], "Common", "2018-08-24T16:09:00+05:30"],
  ["Christie", "CP2200", ["PR"], "Projector", "true", ["CP2208", "CP2210", "CP2215", "CP2220", "CP2230"], "Andre Lopes", "2019-01-30T15:26:00+05:30"],
  ["Christie", "CP4440-RGB", [], "Projector", "true", ["CP4440"], "Ketan Mehta", "2021-05-12T22:04:00+05:30"],
  ["Christie", "CP2215", ["PR"], "Projector", "true", ["CP-2215", "CP 2215"], "Senthil Kumar", "2018-08-24T16:09:00+05:30"],
  ["Christie", "IMB-S2", ["SM"], "Playback Server", "true", ["IMB-S2 4K IMB", "IMB-S2 4K Integrated Media Block", "IMB - S2", "Solaria One IMB-S2 4K Integrated Media Block", "IMB", "SOLARIA-ONE"], "Common", "2018-08-24T16:11:00+05:30"],
  ["Christie", "CP2208", ["PR"], "Projector", "true", ["CP 2208", "CP-2208", "CP2208CLP"], "Ketan Mehta", "2022-08-23T11:36:00+05:30"],
  ["Christie", "CP2315-RGB", ["PR"], "Projector", "true", ["CP2315", "CP2315RGB", "CP2315 RGB", "CP 2315-RGB", "CP 2315 RGB"], "Andre Lopes", "2019-01-30T15:15:00+05:30"],
  ["Christie", "CP2309-RGB", [], "Projector", "true", ["CP2309"], "Ketan Mehta", "2021-05-12T22:10:00+05:30"],
  ["Christie", "CP4320-RGB", [], "Projector", "true", ["CP4320"], "Ketan Mehta", "2021-05-25T19:08:00+05:30"],
  ["Christie", "CP2310-RGBe", [], "Projector", "true", ["CP2310RGB", "CP2310-RGB", "CP2310RGBe"], "Ketan Mehta", "2022-02-23T20:45:00+05:30"],
  ["Christie", "Solaria One", ["PR"], "Projector", "true", ["SOLARIA ONE", "SOLARIA-ONE", "Solaria"], "Ketan Mehta", "2022-08-23T11:37:00+05:30"],
  ["Christie", "CP2420-RGB", ["PR"], "Projector", "true", ["CP2420RGB", "CP2420 RGB", "CP 2420-RGB", "CP 2420RGB"], "Ketan Mehta", "2024-01-23T20:15:00+05:30"],
  ["Christie", "CP2415-RGB", ["PR"], "Projector", "true", ["CP2415", "CP2415RGB", "CP 2415", "CP 2415 RGB", "CP 2415-RGB"], "Ketan Mehta", "2024-01-23T20:13:00+05:30"],
  ["Christie", "CP4455-RGB", ["PR"], "Projector", "true", ["CP4455RGB", "CP4455 RGB", "CP 4455RGB", "CP 4455-RGB", "CP 4455 RGB", "CP4455"], "Ketan Mehta", "2024-01-23T20:32:00+05:30"],
  ["Christie", "CP4435-RGB", ["PR"], "Projector", "true", ["CP4435RGB", "CP4435 RGB", "CP 4435RGB", "CP 4435-RGB", "CP 4435 RGB", "CP4435"], "Ketan Mehta", "2024-01-23T20:34:00+05:30"],
  ["Christie", "CP4425-RGB", ["PR"], "Projector", "true", ["CP4425RGB", "CP4425 RGB", "CP 4425RGB", "CP 4425-RGB", "CP 4425 RGB", "CP4425"], "Ketan Mehta", "2024-01-23T20:32:00+05:30"],
  ["Christie", "CP4420-RGB", ["PR"], "Projector", "true", ["CP4420RGB", "CP4420 RGB", "CP 4420RGB", "CP 4420-RGB", "CP 4420 RGB"], "Ketan Mehta", "2024-01-23T20:24:00+05:30"],
  ["Christie", "CP2415-Xe", ["PR"], "Projector", "true", ["CP2415Xe", "CP2415XE", "CP2415 Xe", "CP 2415Xe", "CP 2415-Xe", "CP 2415 Xe"], "Ketan Mehta", "2024-01-23T20:30:00+05:30"],
  ["Christie", "CP4445-RGB", ["PR"], "Projector", "true", ["CP4445RGB", "CP4445 RGB", "CP 4445RGB", "CP 4445-RGB", "CP 4445 RGB", "CP4445"], "Ketan Mehta", "2024-01-23T20:31:00+05:30"],
  ["Christie", "CP2420-Xe", ["PR"], "Projector", "true", ["CP2420Xe", "CP2420XE", "CP2420 Xe", "CP 2420Xe", "CP 2420-Xe", "CP 2420 Xe", "CP2420"], "Ketan Mehta", "2024-01-24T16:28:00+05:30"],
  ["Christie", "CP4420-Xe", ["PR"], "Projector", "true", ["CP4420Xe", "CP4420XE", "CP4420 Xe", "CP 4420Xe", "CP 4420-Xe", "CP 4420 Xe", "CP4420"], "Ketan Mehta", "2024-01-24T16:48:00+05:30"],
  ["Christie", "CP4415-RGB", ["PR"], "Projector", "true", ["CP4415RGB", "CP4415 RGB", "CP 4415RGB", "CP 4415-RGB", "CP 4415 RGB", "CP4415"], "Ketan Mehta", "2024-01-24T16:13:00+05:30"],
  ["Cinemeccanica", "CMC4 D2", ["PR"], "Projector", "true", ["CMC4", "CMC4-D2"], "Andre Lopes", "2019-01-30T15:27:00+05:30"],
  ["Cinemeccanica", "MVC201", ["SM"], "Playback Server", "true", [], "", "2018-08-24T16:09:00+05:30"],
  ["Cinemeccanica", "CMC3 D2", ["PR"], "Projector", "true", ["CMC3-D2", "CMC3", "CMC-D2"], "Andre Lopes", "2019-01-30T15:28:00+05:30"],
  ["Cinemeccanica", "CMC2 D2", ["PR"], "Projector", "true", ["CMC2"], "Andre Lopes", "2019-01-30T15:28:00+05:30"],
  ["Cinemeccanica", "DCP 30 SX II", ["PR"], "Projector", "true", ["DCP 30 S"], "Andre Lopes", "2019-01-30T15:29:00+05:30"],
  ["Cinemeccanica", "DCP 30 MX II", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:29:00+05:30"],
  ["Cinemeccanica", "CineCloud IMB 24-10", ["SM"], "Playback Server", "true", ["Cine Cloud", "Cinemeccanica", "IMB"], "Andre Lopes", "2019-01-30T15:26:00+05:30"],
  ["Cinemeccanica", "DCP 30 LX II", ["PR"], "Projector", "true", ["DCP 30 L"], "Andre Lopes", "2019-01-30T15:28:00+05:30"],
  ["Arts Alliance Media", "Screenwriter TMS", ["TMS"], "TMS", "NA", [], "Aarthi Videep", "2018-02-27T14:56:00+05:30"],
  ["Christie", "Avias-TMS Theater Management", ["TMS"], "TMS", "NA", [], "Aarthi Videep", "2018-02-27T14:58:00+05:30"],
  ["Cinedigm", "TMS", ["TMS"], "TMS", "NA", [], "Aarthi Videep", "2018-02-27T14:59:00+05:30"],
  ["Dolby", "Theatre Management System", ["TMS"], "TMS", "NA", [], "Aarthi Videep", "2018-02-27T15:09:00+05:30"],
  ["Film-Tech", "Theatre Management System", ["TMS"], "TMS", "NA", [], "Aarthi Videep", "2018-05-23T22:08:00+05:30"],
  ["GDC", "Theatre Management System", ["TMS"], "TMS", "NA", [], "Aarthi Videep", "2018-02-27T14:57:00+05:30"],
  ["Unique", "RosettaBridge TMS", ["TMS"], "TMS", "NA", [], "Aarthi Videep", "2018-02-27T15:00:00+05:30"],
  ["Compeso", "Compeso", [], "Ticketing System", "NA", [], "Aarthi Videep", "2017-04-05T15:50:00+05:30"],
  ["Easy Movies", "Easy Movies", [], "Ticketing System", "NA", [], "Aarthi Videep", "2017-04-05T15:48:00+05:30"],
  ["Impact", "Impact", [], "Ticketing System", "NA", [], "Aarthi Videep", "2017-04-05T15:46:00+05:30"],
  ["Jack Roe", "Jack Roe", [], "Ticketing System", "NA", [], "Aarthi Videep", "2017-04-05T15:59:00+05:30"],
  ["Manual", "Manual", [], "Ticketing System", "NA", [], "", "2014-09-06T18:30:00+05:30"],
  ["Masti Tickets", "Masti Tickets", [], "Ticketing System", "NA", [], "Aarthi Videep", "2017-04-05T15:48:00+05:30"],
  ["POSitive Cinema", "POSitive Cinema", [], "Ticketing System", "NA", [], "Aarthi Videep", "2017-04-05T15:51:00+05:30"],
  ["QuickTickets", "QuickTickets", [], "Ticketing System", "NA", [], "", "2014-12-01T14:25:00+05:30"],
  ["Ready Theatre Systems", "Ready Theatre Systems", [], "Ticketing System", "NA", [], "Aarthi Videep", "2017-04-05T15:57:00+05:30"],
  ["Retriever Software", "Retriever Software", [], "Ticketing System", "NA", [], "Aarthi Videep", "2017-04-05T15:57:00+05:30"],
  ["Showbizz", "Showbizz", [], "Ticketing System", "NA", [], "Aarthi Videep", "2017-04-05T15:46:00+05:30"],
  ["Ticket Green", "Ticket Green", [], "Ticketing System", "NA", [], "Aarthi Videep", "2017-04-05T15:49:00+05:30"],
  ["Ticket New", "Ticket New", [], "Ticketing System", "NA", [], "", "2014-09-06T18:30:00+05:30"],
  ["Ticket Reel", "Ticket Reel", [], "Ticketing System", "NA", [], "Aarthi Videep", "2017-04-05T15:49:00+05:30"],
  ["Vista", "Veezi", [], "Ticketing System", "NA", [], "Aarthi Videep", "2017-04-05T15:49:00+05:30"],
  ["Venue Management System", "Venue Management System", [], "Ticketing System", "NA", [], "Aarthi Videep", "2020-02-13T17:02:00+05:30"],
  ["Vista", "Vista", [], "Ticketing System", "NA", [], "", "2014-09-06T18:30:00+05:30"],
  // Rest of the legacy cinemadb projector and playback-server list (after the systems above, so existing ids stay put)
  ["Cinemeccanica", "DPC4K-80", ["PR"], "Projector", "true", ["DPC-80"], "Andre Lopes", "2019-01-30T15:27:00+05:30"],
  ["DIGICINE", "FilmStore", ["SM"], "Playback Server", "true", ["FilmStore IMB", "FilmStore Integrated Media Block", "FILMSTORE"], "Senthil Kumar", "2018-08-24T16:11:00+05:30"],
  ["Dolby", "IMSLD", ["LD"], "Projector", "true", ["IMS-C-LD"], "Sam Mary", "2024-06-27T12:41:00+05:30"],
  ["Dolby", "DSS200", ["SM", "LE"], "Playback Server", "true", ["CAT862", "DSS 200", "CAT 862", "DSS200-3"], "Ketan Mehta", "2024-01-24T16:47:00+05:30"],
  ["Dolby", "IMBLD", ["LD"], "Projector", "true", ["IMB-C-LD"], "Sam Mary", "2024-06-27T13:00:00+05:30"],
  ["Dolby", "ShowVault IMB", ["LE", "SPB", "MD", "FM", "SM", "LD"], "Playback Server", "true", ["Integrated Media Block ShowVault", "IMB", "IMB2K", "IMB4K", "IMBLD", "IMB-C-LD", "Show Vault", "IMB-4K", "IMB-2K-N", "ShowVault 2.x"], "Shikha Gupta", "2024-12-19T12:11:00+05:30"],
  ["Dolby", "DCP-2000", ["LE", "SPB", "MD", "FM", "SM"], "Playback Server", "true", ["DCP 2000", "DCP2000", "DCP-2K4", "DCP2K4", "DCP2000 2.x", "DCP2K4 2.x"], "Sam Mary", "2024-12-19T20:29:00+05:30"],
  ["Dolby", "CP850", ["RMB", "SPB", "MDE", "FMA", "OBAE", "SM"], "Playback Server", "true", [], "Poombavai Sivamani", "2025-11-27T15:29:00+05:30"],
  ["Dolby", "Montage CDCS 2000", ["SM"], "Playback Server", "true", [], "Andre Lopes", "2019-01-30T15:32:00+05:30"],
  ["Dolby", "DCP-2000-NTS", ["SM"], "Playback Server", "true", [], "Andre Lopes", "2019-01-30T15:31:00+05:30"],
  ["Dolby", "IMS1000", ["LE", "SPB", "MD", "FM", "SM", "LD"], "Playback Server", "true", ["Integrated Media Block IMS1000", "IMSLD", "IMS1000 Integrated Media Block", "IMS"], "Common", "2018-08-24T16:16:00+05:30"],
  ["Dolby", "IMS2000", ["LE", "SPB", "MD", "FM", "SM", "LD"], "Playback Server", "true", ["IMS-2000"], "Andre Lopes", "2019-10-09T17:38:00+05:30"],
  ["Dolby", "IMS3000", ["LE", "SPB", "MD", "FM", "SM"], "Playback Server", "true", ["IMS 3000", "IMB3K"], "Ketan Mehta", "2021-05-12T22:05:00+05:30"],
  ["Dolby", "DSP100/DSS100", ["SM", "LE"], "Playback Server", "true", ["DSS100", "DSS 100", "DSP100"], "", "2018-08-24T16:11:00+05:30"],
  ["Dolby", "Cat. No. 745 IMB", ["SM", "SPB", "MDI", "MDA", "MDS", "FMI", "FMA"], "Playback Server", "true", ["Cat. No. 745 Integrated Media Block", "CAT745", "CAT 745", "DSS220", "DSS 220"], "Common", "2018-08-24T16:11:00+05:30"],
  ["Dolby", "CAT1710", ["OBAE", "SM"], "Playback Server", "true", ["CP950A"], "Sam Mary", "2025-05-22T12:49:00+05:30"],
  ["GDC", "SX-3000", ["LE", "MD", "FM", "SM", "SPB"], "Playback Server", "true", ["SX3000", "SX-3000A", "SX3000A", "SX3000AR", "SX3000X", "SX3000S"], "Common", "2018-08-24T16:09:00+05:30"],
  ["GDC", "SR5520", ["MD", "FM", "SM", "SPB"], "Playback Server", "false", ["SR 5520", "SR-5520"], "Sam Mary", "2026-05-04T16:09:00+05:30"],
  ["GDC", "UC-A42", ["PR", "MD", "FM", "SM", "SPB"], "Playback Server", "true", [], "Sam Mary", "2026-02-12T21:12:00+05:30"],
  ["GDC", "SA-2100", ["LE", "MD", "FM", "SM", "SPB", "TMS", "PR"], "Playback Server", "true", ["SA-2100T", "SA2100A", "SA-2100A", "SA-2100AQ", "SA2100", "SA2100T", "SX2100", "SX2100A", "SX2100T", "SA2101T"], "Common", "2021-01-18T23:41:00+05:30"],
  ["GDC", "SX-2000", ["LE", "MD", "FM", "SM", "SPB", "PR"], "Playback Server", "true", ["SX-2000A", "SA-2000T", "SX-2000AR", "SX-2000T", "SX-2000TR", "SX 2000A", "SX20000", "SX2000AR", "SX2000A", "SX2000TR", "SX2000T", "SX2000", "SA2000", "SA2000T", "SX-2000X", "SA-2000"], "Andre Lopes", "2023-12-06T08:17:00+05:30"],
  ["GDC", "SR5400C", ["MD", "FM", "SM", "SPB", "PR"], "Playback Server", "true", ["SR 5400C", "SR-5400C"], "mary rimt", "2023-11-29T11:08:00+05:30"],
  ["GDC", "C5", ["PR", "MD", "FM", "SM", "SPB"], "Playback Server", "true", ["SUPRA", "Supra-5000", "Esepedo Supra 5000"], "Ketan Mehta", "2024-01-24T16:32:00+05:30"],
  ["GDC", "SR6400C", ["MD", "FM", "SM", "SPB"], "Playback Server", "true", ["SR 6400C", "SR-6400C"], "Sam Mary", "2023-11-25T11:02:00+05:30"],
  ["GDC", "SA-1000", ["LE", "MD", "FM", "SM", "SPB"], "Playback Server", "true", ["SA1000"], "Common", "2018-08-24T16:16:00+05:30"],
  ["GDC", "SX-4000", ["MD", "FM", "SM", "SPB", "LE"], "Playback Server", "true", ["SX4000", "SX 4000"], "Senthil Kumar", "2018-08-24T16:16:00+05:30"],
  ["GDC", "SR1000", ["MD", "FM", "SM", "SPB", "LE", "PR"], "Playback Server", "true", ["SR 1000", "SR-1000"], "Andre Lopes", "2023-08-23T11:45:00+05:30"],
  ["GDC", "XDR3090", ["PR", "SM", "SPB"], "Playback Server", "true", ["XDR 3090", "XDR-3090"], "Sam Mary", "2023-11-28T19:23:00+05:30"],
  ["GDC", "SX-2001A", ["LE", "MD", "FM", "SM", "SPB"], "Playback Server", "true", ["SX-2001AQ", "SX-2001T", "SX2001T", "SX2001A", "SX2001", "SX2001AQ", "SA2001T", "SX-2001SA"], "Andre Lopes", "2018-08-24T16:09:00+05:30"],
  ["JoveAI", "STAR-2424", ["PR", "SM", "FMI", "FMA", "MDI", "MDA", "MDS", "MIC", "SPB"], "Playback Server", "true", [], "Sam Mary", "2025-11-07T20:21:00+05:30"],
  ["KINOTON", "DCP 70", ["PR"], "Projector", "true", ["DCP70L", "DCP70"], "Andre Lopes", "2019-01-30T15:33:00+05:30"],
  ["KINOTON", "DCP 30 MX II", ["PR"], "Projector", "true", ["DCP30MX"], "Andre Lopes", "2019-01-30T15:30:00+05:30"],
  ["KINOTON", "DCP 30 LX II", ["PR"], "Projector", "true", ["DCP30LX", "DCP30L", "DCP30"], "Andre Lopes", "2019-01-30T15:36:00+05:30"],
  ["KINOTON", "DCP 30 SX II", ["PR"], "Projector", "true", ["DCP30S", "DCP30SX"], "Andre Lopes", "2019-01-30T15:36:00+05:30"],
  ["NEC", "IS8-2K", ["PR"], "Projector", "true", ["IS8"], "Andre Lopes", "2019-01-30T15:34:00+05:30"],
  ["NEC", "NC1201L-A", [], "Projector", "true", ["NC1201L-C", "NC1201L", "NC1201", "NC1201L1-A"], "Ketan Mehta", "2021-05-12T21:47:00+05:30"],
  ["NEC", "NC3200S", ["LD", "PR"], "Projector", "true", ["3200S", "NC3200", "NC3200S-A"], "Ketan Mehta", "2021-05-12T21:51:00+05:30"],
  ["NEC", "NC1803ML", ["PR"], "Projector", "true", ["NC 1803ML", "NC 1803 ML", "NC1803 ML", "NC1803-ML", "NC-1803-ML"], "Ketan Mehta", "2024-01-23T20:57:00+05:30"],
  ["NEC", "NC1200C", ["LD"], "Projector", "true", ["NC1200", "1200C+"], "", "2018-08-24T16:09:00+05:30"],
  ["NEC", "NC800C", ["PR", "LD"], "Projector", "true", ["NC800"], "Common", "2018-08-24T16:09:00+05:30"],
  ["NEC", "NC2000C", ["LD", "PR"], "Projector", "true", ["2000C", "NC2000", "NC-2000C"], "Common", "2018-08-24T16:09:00+05:30"],
  ["NEC", "NC2500S", ["PR", "LD"], "Projector", "true", ["NC2500", "NC2500S-A", "NC2500A", "NC-2500", "NC2500C"], "Common", "2018-08-24T16:09:00+05:30"],
  ["NEC", "NC1202L", [], "Projector", "true", ["NC-1202L"], "Ketan Mehta", "2022-08-23T11:41:00+05:30"],
  ["NEC", "NC900C-A", ["PR"], "Projector", "true", ["NP-NC900C-A", "NC900C", "NC900c", "NC900"], "Common", "2018-08-24T16:09:00+05:30"],
  ["NEC", "NC2402ML", ["PR"], "Projector", "true", [], "Ketan Mehta", "2024-01-23T21:27:00+05:30"],
  ["NEC", "NC2041L", ["PR"], "Projector", "true", ["NC2041", "NC 2041L", "NC 2041", "NC2401L"], "Ketan Mehta", "2024-01-24T16:52:00+05:30"],
  ["NEC", "NC1843ML", ["PR"], "Projector", "true", ["NC 1843ML", "NC 1843 ML", "NC1843 ML", "NC1843-ML", "NC-1843-ML"], "Ketan Mehta", "2024-01-23T21:10:00+05:30"],
  ["NEC", "NC2043ML", ["PR"], "Projector", "true", ["NC 2043ML", "NC 2043 ML", "NC2043 ML", "NC2043-ML", "NC-2043-ML"], "Ketan Mehta", "2024-01-23T21:09:00+05:30"],
  ["NEC", "NC2443ML", ["PR"], "Projector", "true", ["NC 2443ML", "NC 2443 ML", "NC2443 ML", "NC2443-ML", "NC-2443-ML"], "Ketan Mehta", "2024-01-23T21:12:00+05:30"],
  ["NEC", "NC3240S", ["LD", "PR"], "Projector", "true", ["NC3240S-A", "NC3240", "NC 3240S"], "Common", "2018-08-24T16:09:00+05:30"],
  ["NEC", "NC1000C", ["PR"], "Projector", "true", ["NC-1000C", "NC 1000", "NC 1000C", "NC-1000"], "Andre Lopes", "2019-01-30T15:34:00+05:30"],
  ["NEC", "NC1500C", ["PR", "LD"], "Projector", "true", [], "", "2018-08-24T16:09:00+05:30"],
  ["NEC", "NC603L", ["PR"], "Projector", "true", ["NC 603L", "NC603 L", "NC 603 L"], "Ketan Mehta", "2024-01-23T20:53:00+05:30"],
  ["NEC", "NC3541L", ["PR"], "Projector", "true", ["NC 3541L", "NC 3541 L", "NC3541 L", "NC3541-L", "NC-3541-L"], "Ketan Mehta", "2024-01-23T21:17:00+05:30"],
  ["NEC", "NC1503L", ["PR"], "Projector", "true", ["NC 1503L", "NC 1503 L", "NC1503 L"], "Ketan Mehta", "2024-01-23T20:55:00+05:30"],
  ["NEC", "NC2003ML", ["PR"], "Projector", "true", ["NC 2003ML", "NC 2003 ML", "NC2003 ML", "NC2003-ML", "NC-2003-ML"], "Ketan Mehta", "2024-01-23T20:58:00+05:30"],
  ["NEC", "NC1100L-A", ["PR"], "Projector", "true", ["NC1100L"], "Andre Lopes", "2019-01-30T15:34:00+05:30"],
  ["NEC", "NP-90MS01 IMB", ["SM"], "Playback Server", "true", ["NP-90MS01 Integrated Media Block", "NP-90MS01"], "Andre Lopes", "2019-01-30T15:36:00+05:30"],
  ["NEC", "NC1600C", ["PR", "LD"], "Projector", "true", ["NC1600C-A", "NC-1600C", "NC1600", "NC-1600C-A", "NC-1600"], "Common", "2018-08-24T16:08:00+05:30"],
  ["NEC", "NC1402L", ["PR"], "Projector", "true", ["NC1402L+", "NP-NC1402L+", "NP-NC1402L"], "Ketan Mehta", "2024-01-23T21:13:00+05:30"],
  ["NEC", "NC2403ML", ["PR"], "Projector", "true", ["NC 2403ML", "NC 2403 ML", "NC2403 ML", "NC2403-ML", "NC-2403-ML"], "Ketan Mehta", "2024-01-23T21:07:00+05:30"],
  ["ORISTAR", "AQ10", ["FMI", "SM", "MDI", "LE", "MDA", "MDS", "SPB", "FMA"], "Playback Server", "true", ["AQ10CP"], "Common", "2018-08-24T16:15:00+05:30"],
  ["ORISTAR", "AQ30", ["FMA", "FMI", "MDA", "MDI", "MDS", "SPB", "SM"], "Playback Server", "true", ["AQ30CP"], "Common", "2018-08-24T16:15:00+05:30"],
  ["Qube Cinema", "CINE4K25", [], "Playback Server", "true", ["CINE", "CINE 4K25", "CINE-4K25"], "Sam Mary", "2024-09-06T10:57:00+05:30"],
  ["Qube Cinema", "XP-D", ["FMI", "FMA", "SM", "SPB", "MDI", "MDA", "LE", "MDS"], "Playback Server", "true", ["QXPD", "XP - D"], "Sam Mary", "2025-04-04T02:56:00+05:30"],
  ["Qube Cinema", "Premiere XD", ["SM"], "Playback Server", "true", ["Premier XD"], "Andre Lopes", "2019-01-30T15:33:00+05:30"],
  ["Qube Cinema", "Premiere XE", ["SM", "FMA", "TMS", "SPB", "MDS", "MDI", "MDA", "FMI"], "Playback Server", "false", ["Premier XE", "QPHD", "QXPR"], "Dhanya Rajagopalan", "2020-11-05T11:59:00+05:30"],
  ["Qube Cinema", "CVCB25", ["PR", "SM"], "Playback Server", "true", ["CVCB"], "Sam Mary", "2024-09-06T16:21:00+05:30"],
  ["Qube Cinema", "XP-E", ["SPB", "FMA", "LE", "FMI", "SM", "TMS", "MDI", "MDS", "MDA"], "Playback Server", "false", ["QCPE", "QXPE"], "Andre Lopes", "2018-12-07T15:38:00+05:30"],
  ["Qube Cinema", "XP-I with Xi IMB", ["FMI", "SPB", "MDI", "MDA", "SM", "MDS", "FMA"], "Playback Server", "true", ["XP-I with Xi Integrated Media Block", "XP-I", "QXI", "Xi Integrated Media Block with XP-I"], "Common", "2018-08-24T16:16:00+05:30"],
  ["Qube Cinema", "XP-S", ["SM", "MDA", "FMI", "MDS", "FMA", "MDI", "SPB", "LE", "TMS"], "Playback Server", "false", ["QCPS", "QXPS"], "Dhanya Rajagopalan", "2020-11-04T17:51:00+05:30"],
  ["Qube Cinema", "Premier Plus", ["FMI", "SM", "FMA", "MDI", "SPB", "MDS", "MDA", "LE"], "Playback Server", "false", ["QXPP"], "Dhanya Rajagopalan", "2020-11-05T12:08:00+05:30"],
  ["Quvis", "QCP", ["SM"], "Playback Server", "false", [], "Andre Lopes", "2019-01-30T15:37:00+05:30"],
  ["SONY", "SRX-R320", ["PR"], "Projector", "true", ["SRXR320P", "SRXR320", "SRX R-320", "SRX-R320P", "SRX-320"], "Common", "2018-08-24T16:08:00+05:30"],
  ["SONY", "XCT-S10", ["SM"], "Playback Server", "true", [], "Andre Lopes", "2019-01-30T15:39:00+05:30"],
  ["SONY", "SRX-R105", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:39:00+05:30"],
  ["SONY", "SRX-R220", ["PR", "SM"], "Projector", "true", ["SRXR220"], "", "2018-12-13T08:23:00+05:30"],
  ["SONY", "SRX-R510P", ["PR"], "Projector", "true", ["SRX-R510", "SRX R510", "SRX 510", "SRX 510P", "SRX-510P", "SRX-510"], "Senthil Kumar", "2018-08-24T16:16:00+05:30"],
  ["SONY", "LMT-100", ["SM"], "Playback Server", "true", ["LMT100", "LMT 100"], "Common", "2018-08-24T16:09:00+05:30"],
  ["SONY", "SI-R320", ["SM"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:40:00+05:30"],
  ["SONY", "SI-R320S", ["PR"], "Projector", "true", ["SI-R320-DS"], "Andre Lopes", "2019-01-30T15:40:00+05:30"],
  ["SONY", "SRX-R110", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:39:00+05:30"],
  ["SONY", "SRX-R515P", ["PR", "SM"], "Projector", "true", ["SRX-R515", "SRXR515", "SRXR515DS", "SRX-R515P-IMB"], "Ketan Mehta", "2024-01-24T16:53:00+05:30"],
  ["SONY", "SRX-R320S", ["PR"], "Projector", "true", [], "Andre Lopes", "2019-01-30T15:39:00+05:30"],
  ["SONY", "SRX-R800", ["PR"], "Projector", "true", ["SRX-R810P", "SRX-R815P", "SRX-R810DS", "SRX-R815DS", "SRX-R815", "SRX-R810"], "Andre Lopes", "2018-08-24T16:16:00+05:30"],
  ["SONY", "XCT-M10", ["SM"], "Playback Server", "true", ["XCTM10", "SRX-R515"], "Common", "2018-08-24T16:09:00+05:30"],
  ["SONY", "LMT-300", ["SM", "PR"], "Playback Server", "true", ["LMT300/1", "LMT300", "SSP-27-K", "LMT 300", "LMT-300 2.50+"], "Sam Mary", "2024-12-19T12:08:00+05:30"],
  ["SONY", "SRX-R210", ["PR"], "Projector", "true", ["SRXR210"], "", "2018-08-24T16:09:00+05:30"],
  ["SONY", "LMT-200", ["SM"], "Playback Server", "true", ["LMT200", "LMT 200", "SSP-27"], "Common", "2018-08-24T16:07:00+05:30"],
  ["TEXAS INSTRUMENTS", "Series2", ["PR", "LD"], "Projector", "true", ["Series 2"], "Sam Mary", "2024-06-27T12:23:00+05:30"],
  ["UFO/Scrabble India", "CineBlaster 2", [], "Playback Server", "false", [], "Aarthi Videep", "2018-03-27T11:53:00+05:30"],
  ["UFO/Scrabble India", "CineBlaster", [], "Playback Server", "false", [], "Aarthi Videep", "2018-12-05T14:24:00+05:30"],
  ["USL", "CMS-2200 IMB", ["SM"], "Playback Server", "true", ["CMS-2200 Integrated Media Block"], "Andre Lopes", "2019-01-30T15:41:00+05:30"],
  ["USL", "CMS-1200 IMB", ["SM", "SPB", "MDI", "MDA", "MDS", "FMI", "FMA"], "Playback Server", "true", ["CMS-1200 Integrated Media Block", "CMS1200", "IMB1200", "IMB1200HFR", "1200HFR", "CMS-1200HFR", "CMS1200HFR"], "Common", "2018-08-24T16:16:00+05:30"],
  ["XDC", "CineStore Solo G3", ["SPB", "SM", "MDI", "MDA", "FMI", "FMA", "LE"], "Playback Server", "true", ["SOLOG3-MVC200", "CSC-INTER", "G3"], "Common", "2018-08-24T16:16:00+05:30"],
];

const SITE_ID: CredentialFieldDef = { key: "siteId", name: "Site ID", valueType: "string", masked: false, mandatory: true };
const USERNAME: CredentialFieldDef = { key: "username", name: "Username", valueType: "string", masked: false, mandatory: true };
const PASSWORD: CredentialFieldDef = { key: "password", name: "Password", valueType: "string", masked: true, mandatory: true };

const fieldsForType = (type: DeviceType, i: number): CredentialFieldDef[] => {
  switch (type) {
    case "TMS": return [SITE_ID, USERNAME, PASSWORD];
    case "Ticketing System": return i % 2 === 0 ? [SITE_ID, PASSWORD] : [SITE_ID, USERNAME, PASSWORD];
    default: return [USERNAME, PASSWORD];
  }
};

export const credentialDevices: CredentialDevice[] = rows.map(
  ([brand, model, roles, type, dci, translations, updatedBy, updatedAt], i) => ({
    id: `cred-${i + 1}`,
    brand,
    model,
    roles,
    primaryRole: null,
    certificateRoles: roles,
    additionalRoles: [],
    type,
    dci,
    translations,
    serialNumberRequired: type === "Projector" || type === "Playback Server",
    credentialFields: fieldsForType(type, i),
    updatedBy,
    updatedAt,
  }),
);

// Placeholder credentials so the tabs have something to show. Not real vendor defaults.
const editors = ["Ketan Mehta", "Andre Lopes", "Sam Mary", "Vaibhav Shete", "Aarthi Videep"];
const valuesFor = (device: CredentialDevice, seed: number): ScopedCredential["values"] => {
  const values: ScopedCredential["values"] = {};
  for (const { key } of device.credentialFields) {
    if (key === "siteId") values.siteId = `SITE-${1000 + seed}`;
    if (key === "username") values.username = seed % 2 === 0 ? "admin" : "service";
    if (key === "password") values.password = `Demo@${2000 + seed}`;
  }
  return values;
};

const hasSampleCredentials = (d: CredentialDevice, i: number) =>
  d.type === "Playback Server" || d.type === "TMS" || (d.type === "Projector" && i % 3 !== 0);

/** Seed rows with every value in plain text; the seeder encrypts the masked ones. */
export type SeedCredential = Omit<ScopedCredential, "maskedKeys">;

export const initialScopedCredentials: SeedCredential[] = credentialDevices.flatMap((device, i) => {
  if (!hasSampleCredentials(device, i)) return [];
  const make = (scope: CredentialScope, ref: string, n: number, location?: string): SeedCredential => ({
    id: `${device.id}-${scope}-${n}`,
    deviceId: device.id,
    scope,
    ref,
    location,
    values: valuesFor(device, i * 7 + n),
    updatedBy: editors[(i + n) % editors.length],
    updatedAt: new Date(Date.UTC(2025, (i + n) % 12, 1 + ((i * 3 + n) % 27), 9 + (n % 8), (i * 11) % 60)).toISOString(),
  });
  const list = [make("global", GLOBAL_REF, 0)];
  if (i % 4 === 1) list.push(make("global", countryOptions[i % countryOptions.length], 1));
  if (i % 3 === 0) list.push(make("chain", chainOptions[i % chainOptions.length], 2));
  if (i % 5 === 0) list.push(make("theatre", theatreOptions[i % theatreOptions.length], 3));
  if (i % 6 === 0) {
    const serial = `${device.model.replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase()}-${String(10000 + i * 37).slice(-5)}`;
    list.push(make("device", serial, 4, `${theatreOptions[(i + 1) % theatreOptions.length]} · Audi ${(i % 8) + 1}`));
  }
  return list;
});
