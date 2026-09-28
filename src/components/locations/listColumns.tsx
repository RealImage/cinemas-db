import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { City, Country, LocationEntity, LocationRecordMap, MetroArea, Province, Timezone } from "@/data/locationsData";

export interface LocationColumn<T> {
  header: string;
  /** Server sort key; unsortable when absent. */
  sort?: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

const dash = (v: ReactNode) => (v === null || v === undefined || v === "" ? "—" : v);

const countries: LocationColumn<Country>[] = [
  { header: "ISO 3166-2", sort: "iso2", cell: (r) => r.iso2 },
  { header: "ISO 3166-3", sort: "iso3", cell: (r) => r.iso3 },
];

const provinces: LocationColumn<Province>[] = [
  { header: "Code", sort: "isoCode", cell: (r) => r.isoCode, className: "whitespace-nowrap" },
  { header: "Country", sort: "countryName", cell: (r) => r.countryName },
  { header: "Country Code", sort: "countryCode", cell: (r) => r.countryCode },
];

const cities: LocationColumn<City>[] = [
  { header: "Code", sort: "code", cell: (r) => dash(r.code), className: "whitespace-nowrap" },
  { header: "Province", sort: "provinceName", cell: (r) => `${r.provinceName}, ${r.countryName}` },
  { header: "Province Code", sort: "provinceCode", cell: (r) => r.provinceCode, className: "whitespace-nowrap" },
  { header: "Metro Area", sort: "metroAreaName", cell: (r) => r.metroAreaName ?? "-" },
];

const metroAreas: LocationColumn<MetroArea>[] = [
  { header: "Cities", sort: "cityCount", cell: (r) => r.cityCount, className: "text-right tabular-nums" },
];

const timezones: LocationColumn<Timezone>[] = [
  { header: "Display Name", sort: "displayName", cell: (r) => dash(r.displayName) },
  {
    header: "UTC Offset",
    sort: "utcOffset",
    cell: (r) => (
      <span className="tabular-nums">
        {dash(r.utcOffset)}
        {r.dstOffset && <span className="text-muted-foreground"> / DST {r.dstOffset}</span>}
      </span>
    ),
  },
  {
    header: "Is Active",
    sort: "isActive",
    cell: (r) => (r.isActive ? <Badge variant="positive">Active</Badge> : <Badge variant="outline">Inactive</Badge>),
  },
];

/** Columns between Name and Updated By, per entity (the spec's list columns). */
export const entityColumns: { [E in LocationEntity]: LocationColumn<LocationRecordMap[E]>[] } = {
  countries,
  provinces,
  cities,
  metro_areas: metroAreas,
  timezones,
};

export const entityDescriptions: Record<LocationEntity, string> = {
  countries: "Countries, their ISO codes, currency and calling code.",
  provinces: "States, provinces and regions within each country.",
  cities: "Cities theatres are located in; each belongs to a province and has a timezone.",
  metro_areas: "Groups of cities that form one market, across provinces if needed.",
  timezones: "IANA timezones. Offsets are derived from the IANA database.",
};
