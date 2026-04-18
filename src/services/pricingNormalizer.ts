export type SeasonKey = "PREMIUM" | "PRIME" | "SHOULDER" | "ECONOMY";

export interface SeasonPricing {
  season: SeasonKey;
  dateRange: string;
  rates: number[];
}

export interface CarPricingGroup {
  carType: string;
  modelYears: string[];
  pricing: SeasonPricing[];
}

export interface RawPricingInput {
  carType: string;
  modelYear: string | number;
  season?: string;
  dateRange?: string;
  rate?: number | string;
  rates?: Array<number | string>;
}

const SEASON_DATE_RANGE_MAP: Record<SeasonKey, string[]> = {
  PREMIUM: ["07-01 - 08-31"],
  PRIME: ["06-11 - 06-30", "09-01 - 09-30"],
  SHOULDER: ["05-15 - 06-10", "10-01 - 10-25"],
  ECONOMY: ["10-26 - 12-31", "01-01 - 05-14"],
};

const SEASON_KEYS: SeasonKey[] = ["PREMIUM", "PRIME", "SHOULDER", "ECONOMY"];

const MONTH_NORMALIZATION: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function normalizeText(value: string): string {
  return value
    .replace(/[^A-Za-z0-9\s_\-]/g, " ")
    .trim()
    .replace(/[\s_\-]+/g, " ")
    .toUpperCase();
}

function normalizeCarType(value: string): string {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .map((token) => token[0] + token.slice(1).toLowerCase())
    .join(" ");
}

function normalizeModelYear(value: string | number): string {
  const raw = String(value || "");
  return raw
    .replace(/[^0-9_\-]/g, "")
    .replace(/_+/g, "_")
    .replace(/-+/g, "_")
    .trim();
}

function roundNumber(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeRates(value?: number | string | Array<number | string>): number[] {
  if (value === undefined || value === null) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  const normalized: number[] = [];

  for (const raw of values) {
    if (typeof raw === "number") {
      if (Number.isFinite(raw)) normalized.push(roundNumber(raw));
      continue;
    }

    const pieces = String(raw)
      .split(/[;,]/)
      .flatMap((item) => item.split(/\s+/))
      .map((item) => item.trim())
      .filter(Boolean);

    for (const piece of pieces) {
      const numeric = Number(piece.replace(/[^0-9.]/g, ""));
      if (Number.isFinite(numeric)) {
        normalized.push(roundNumber(numeric));
      }
    }
  }

  return normalized;
}

function normalizeSeason(input?: string): SeasonKey | undefined {
  if (!input) return undefined;
  const token = normalizeText(input);

  for (const season of SEASON_KEYS) {
    if (token.includes(season)) {
      return season;
    }
  }

  return undefined;
}

function parseMonthToken(rawToken: string): string | undefined {
  const letters = rawToken.replace(/[^A-Za-z]/g, "").toLowerCase();
  if (!letters) {
    return undefined;
  }

  for (const key of Object.keys(MONTH_NORMALIZATION)) {
    if (letters.startsWith(key) || key.startsWith(letters) || key.includes(letters) || letters.includes(key)) {
      return MONTH_NORMALIZATION[key];
    }
  }

  return undefined;
}

function parseSegment(segment: string): { month: string; day: number } | undefined {
  const cleaned = segment.replace(/[^A-Za-z0-9]/g, " ").trim();
  const tokens = cleaned
    .split(/\s+/)
    .flatMap((token) => token.match(/[A-Za-z]+|[0-9]+/g) ?? [])
    .filter(Boolean);

  let monthToken = "";
  let dayToken = "";

  for (const token of tokens) {
    if (/[A-Za-z]/.test(token)) {
      monthToken = token;
    } else if (/[0-9]/.test(token) && !dayToken) {
      dayToken = token;
    }
  }

  if (!monthToken && tokens.length > 0) {
    const candidate = tokens.find((token) => /[A-Za-z]/.test(token));
    if (candidate) monthToken = candidate;
  }

  const month = parseMonthToken(monthToken);
  const day = dayToken ? Number(dayToken.replace(/^0+/, "")) : NaN;

  if (!month || !Number.isFinite(day)) {
    return undefined;
  }

  return {
    month,
    day: day < 1 ? 1 : Math.min(day, 31),
  };
}

function formatMonthDay(month: string, day: number): string {
  const paddedDay = String(day).padStart(2, "0");
  return `${month}-${paddedDay}`;
}

function normalizeDateRange(raw?: string, season?: SeasonKey): string {
  if (!raw?.trim()) {
    if (season && SEASON_DATE_RANGE_MAP[season]) {
      return SEASON_DATE_RANGE_MAP[season][0];
    }
    return "00-00 - 00-00";
  }

  const cleaned = raw.replace(/[–—]/g, "-").replace(/\s*[-–—]\s*/, " - ");
  const parts = cleaned.split(" - ").map((part) => part.trim()).filter(Boolean);

  if (parts.length === 1) {
    const exact = parts[0];
    const rangeTokens = exact.split(/\s+to\s+|\s+TO\s+/i);
    if (rangeTokens.length === 2) {
      parts.splice(0, 1, rangeTokens[0].trim(), rangeTokens[1].trim());
    }
  }

  if (parts.length !== 2) {
    if (season && SEASON_DATE_RANGE_MAP[season]) {
      return SEASON_DATE_RANGE_MAP[season][0];
    }
    return "00-00 - 00-00";
  }

  const start = parseSegment(parts[0]);
  const end = parseSegment(parts[1]);

  if (!start || !end) {
    if (season && SEASON_DATE_RANGE_MAP[season]) {
      return SEASON_DATE_RANGE_MAP[season][0];
    }
    return "00-00 - 00-00";
  }

  return `${formatMonthDay(start.month, start.day)} - ${formatMonthDay(end.month, end.day)}`;
}

function seasonForMonthDay(monthDay: string): SeasonKey {
  if (monthDay >= "07-01" && monthDay <= "08-31") {
    return "PREMIUM";
  }
  if ((monthDay >= "06-11" && monthDay <= "06-30") || (monthDay >= "09-01" && monthDay <= "09-30")) {
    return "PRIME";
  }
  if ((monthDay >= "05-15" && monthDay <= "06-10") || (monthDay >= "10-01" && monthDay <= "10-25")) {
    return "SHOULDER";
  }
  return "ECONOMY";
}

function seasonForDateRange(rawRange: string): SeasonKey | undefined {
  const normalized = normalizeDateRange(rawRange);

  for (const season of SEASON_KEYS) {
    if (SEASON_DATE_RANGE_MAP[season].includes(normalized)) {
      return season;
    }
  }

  const parts = normalized.split(" - ").map((part) => part.trim());
  if (parts.length !== 2 || !parts[0]) {
    return undefined;
  }

  return seasonForMonthDay(parts[0]);
}

function buildGroupKey(carType: string): string {
  return normalizeCarType(carType).toLowerCase();
}

function expandModelYears(modelYear: string): string[] {
  const token = modelYear.replace(/[^0-9_\-]/g, "_").replace(/_+/g, "_").trim();
  const years = token
    .split("_")
    .map((part) => part.trim())
    .filter((value) => /^\d{4}$/.test(value));

  if (years.length === 2) {
    const [start, end] = years;
    const startNum = Number(start);
    const endNum = Number(end);
    if (endNum >= startNum) {
      return Array.from({ length: endNum - startNum + 1 }, (_, index) => String(startNum + index));
    }
  }

  return Array.from(new Set(years));
}

function mergeUniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean))).sort();
}

export function buildPricingGroups(rawInputs: RawPricingInput[]): CarPricingGroup[] {
  const groups: Record<string, CarPricingGroup> = {};

  for (const row of rawInputs) {
    const carType = normalizeCarType(String(row.carType || ""));
    const modelYearKey = normalizeModelYear(row.modelYear ?? "");
    const season = normalizeSeason(row.season) ?? seasonForDateRange(String(row.dateRange || "")) ?? "ECONOMY";
    const dateRange = normalizeDateRange(row.dateRange, season);
    const rates = normalizeRates(row.rates ?? row.rate);

    if (!carType || !modelYearKey || !rates.length) {
      continue;
    }

    const groupKey = buildGroupKey(carType);
    const existing = groups[groupKey] ?? {
      carType,
      modelYears: [],
      pricing: [],
    };

    existing.modelYears = mergeUniqueStrings([...existing.modelYears, ...expandModelYears(modelYearKey)]);

    const pricingEntry: SeasonPricing = {
      season,
      dateRange,
      rates,
    };

    const existingPricing = existing.pricing.find(
      (entry) => entry.season === pricingEntry.season && entry.dateRange === pricingEntry.dateRange
    );

    if (existingPricing) {
      existingPricing.rates = mergeUniqueStrings([...existingPricing.rates.map(String), ...pricingEntry.rates.map(String)]).map(Number);
    } else {
      existing.pricing.push(pricingEntry);
    }

    groups[groupKey] = existing;
  }

  return Object.values(groups).map((group) => ({
    carType: group.carType,
    modelYears: group.modelYears,
    pricing: group.pricing.sort((a, b) => SEASON_KEYS.indexOf(a.season) - SEASON_KEYS.indexOf(b.season)),
  }));
}
