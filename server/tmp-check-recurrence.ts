import {
  expandRecurrence,
  validateRule,
  weekdayOf,
  daysBetween,
  addDays,
} from "./src/lib/recurrence.js";

const NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      expected ${e}\n      actual   ${a}`);
}

// Anchor: 2026-09-07 — confirm the weekday helper agrees before relying on it.
console.log("2026-09-07 is a", NAMES[weekdayOf("2026-09-07")]);
console.log("2026-09-01 is a", NAMES[weekdayOf("2026-09-01")]);
console.log("");

// Weekly, single weekday (Mondays)
check(
  "weekly Mon, 3 weeks",
  expandRecurrence({
    freq: "weekly",
    interval: 1,
    byWeekday: [1],
    startDate: "2026-09-07",
    endDate: "2026-09-28",
  }),
  ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"],
);

// Weekly, Mon/Wed/Fri — the gym case
check(
  "weekly Mon/Wed/Fri, 2 weeks",
  expandRecurrence({
    freq: "weekly",
    interval: 1,
    byWeekday: [1, 3, 5],
    startDate: "2026-09-07",
    endDate: "2026-09-18",
  }),
  [
    "2026-09-07",
    "2026-09-09",
    "2026-09-11",
    "2026-09-14",
    "2026-09-16",
    "2026-09-18",
  ],
);

// Fortnightly should skip a whole calendar week
check(
  "fortnightly Mon",
  expandRecurrence({
    freq: "weekly",
    interval: 2,
    byWeekday: [1],
    startDate: "2026-09-07",
    endDate: "2026-10-05",
  }),
  ["2026-09-07", "2026-09-21", "2026-10-05"],
);

// Starting mid-week on a fortnightly pattern: the first occurrence must still be
// included even though its weekday precedes the anchor.
check(
  "fortnightly Tue/Thu starting Thu",
  expandRecurrence({
    freq: "weekly",
    interval: 2,
    byWeekday: [2, 4],
    startDate: "2026-09-10",
    endDate: "2026-09-29",
  }),
  ["2026-09-10", "2026-09-22", "2026-09-24"],
);

check(
  "daily, 4 days",
  expandRecurrence({
    freq: "daily",
    interval: 1,
    byWeekday: [],
    startDate: "2026-09-07",
    endDate: "2026-09-10",
  }),
  ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10"],
);

check(
  "every 3rd day",
  expandRecurrence({
    freq: "daily",
    interval: 3,
    byWeekday: [],
    startDate: "2026-09-07",
    endDate: "2026-09-17",
  }),
  ["2026-09-07", "2026-09-10", "2026-09-13", "2026-09-16"],
);

// Crossing a month boundary, a year boundary, and a UK DST change (25 Oct 2026)
check(
  "weekly Sun across DST + month end",
  expandRecurrence({
    freq: "weekly",
    interval: 1,
    byWeekday: [0],
    startDate: "2026-10-18",
    endDate: "2026-11-08",
  }),
  ["2026-10-18", "2026-10-25", "2026-11-01", "2026-11-08"],
);

check(
  "weekly across new year",
  expandRecurrence({
    freq: "weekly",
    interval: 1,
    byWeekday: [4],
    startDate: "2026-12-24",
    endDate: "2027-01-14",
  }),
  ["2026-12-24", "2026-12-31", "2027-01-07", "2027-01-14"],
);

// Leap year: 2028-02-29 exists and daily must not skip it
check(
  "daily across leap day",
  expandRecurrence({
    freq: "daily",
    interval: 1,
    byWeekday: [],
    startDate: "2028-02-27",
    endDate: "2028-03-01",
  }),
  ["2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01"],
);

// Single day range
check(
  "start == end, weekday matches",
  expandRecurrence({
    freq: "weekly",
    interval: 1,
    byWeekday: [1],
    startDate: "2026-09-07",
    endDate: "2026-09-07",
  }),
  ["2026-09-07"],
);

check(
  "start == end, weekday does not match",
  expandRecurrence({
    freq: "weekly",
    interval: 1,
    byWeekday: [3],
    startDate: "2026-09-07",
    endDate: "2026-09-07",
  }),
  [],
);

// Over-long patterns must be catchable: daily for 2 years > 366
const twoYears = expandRecurrence({
  freq: "daily",
  interval: 1,
  byWeekday: [],
  startDate: "2026-01-01",
  endDate: "2027-12-31",
});
check("daily 2 years stops past the cap", twoYears.length, 367);

// Validation
check(
  "rejects end before start",
  validateRule({
    freq: "weekly",
    interval: 1,
    byWeekday: [1],
    startDate: "2026-09-07",
    endDate: "2026-09-01",
  }),
  "Repeat-until date must be on or after the start date",
);
check(
  "rejects weekly with no weekdays",
  validateRule({
    freq: "weekly",
    interval: 1,
    byWeekday: [],
    startDate: "2026-09-07",
    endDate: "2026-09-28",
  }),
  "Pick at least one day of the week",
);
check(
  "rejects interval 0",
  validateRule({
    freq: "daily",
    interval: 0,
    byWeekday: [],
    startDate: "2026-09-07",
    endDate: "2026-09-28",
  }),
  "Repeat interval must be a whole number between 1 and 30",
);
check(
  "rejects malformed date",
  validateRule({
    freq: "daily",
    interval: 1,
    byWeekday: [],
    startDate: "07/09/2026",
    endDate: "2026-09-28",
  }),
  "Recurrence dates must be in YYYY-MM-DD format",
);
check(
  "accepts a valid rule",
  validateRule({
    freq: "weekly",
    interval: 1,
    byWeekday: [1, 3, 5],
    startDate: "2026-09-07",
    endDate: "2026-09-28",
  }),
  null,
);

// Date helpers used by the "all future" shift
check("daysBetween Mon->Tue", daysBetween("2026-09-07", "2026-09-08"), 1);
check("daysBetween backwards", daysBetween("2026-09-08", "2026-09-07"), -1);
check("daysBetween across DST", daysBetween("2026-10-24", "2026-10-26"), 2);
check("addDays across month end", addDays("2026-10-31", 1), "2026-11-01");
check("addDays negative", addDays("2026-01-01", -1), "2025-12-31");

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
