import { useState, ChangeEvent } from "react";
import dayjs from "dayjs";
import {
  Block,
  CreateBlockInput,
  EditScope,
  Freq,
  Recurrence,
} from "../models";
import styles from "./BlockForm.module.css";

interface BlockFormProps {
  /**
   * Receives the saved block, or every block of a newly created series.
   * `seriesWide` is set when the save also changed occurrences the caller
   * isn't holding, so it knows to refetch rather than patch its own state.
   */
  onSave: (saved: Block | Block[], seriesWide?: boolean) => void;
  onCancel: () => void;
  existing?: Block; // if provided, we're editing rather than creating
}

// Monday-first for display; values stay 0 = Sunday to match Date.getDay().
const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const today = dayjs().format("YYYY-MM-DD");

// Series are materialised as real rows, so they need an end date. Three months
// is long enough to feel open-ended without creating hundreds of blocks.
const defaultEndFor = (start: string) =>
  dayjs(start).add(3, "month").format("YYYY-MM-DD");

export default function BlockForm({
  onSave,
  onCancel,
  existing,
}: BlockFormProps) {
  const [form, setForm] = useState<CreateBlockInput>({
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    date: existing?.date ?? today,
    start_time: existing?.startTime ?? "",
    end_time: existing?.endTime ?? "",
  });

  const [repeat, setRepeat] = useState<boolean>(false);
  const [freq, setFreq] = useState<Freq>("weekly");
  const [interval, setInterval] = useState<number>(1);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [endDate, setEndDate] = useState<string>(
    defaultEndFor(existing?.date ?? today),
  );

  // Only relevant when editing an occurrence that belongs to a series.
  const isSeriesOccurrence = existing?.seriesId != null;
  const [scope, setScope] = useState<EditScope>("single");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const set =
    (field: keyof CreateBlockInput) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Changing the start date drags the repeat-until date along if it would
  // otherwise end up in the past.
  const handleDateChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const date = e.target.value;
    setForm((prev) => ({ ...prev, date }));
    if (date && date > endDate) setEndDate(defaultEndFor(date));
  };

  // Seed the weekday selection from the start date the first time repeating is
  // switched on, so weekly defaults to "the day I already picked".
  const handleRepeatToggle = (on: boolean): void => {
    setRepeat(on);
    if (on && weekdays.length === 0) {
      setWeekdays([dayjs(form.date).day()]);
    }
  };

  const toggleWeekday = (value: number): void =>
    setWeekdays((prev) =>
      prev.includes(value)
        ? prev.filter((d) => d !== value)
        : [...prev, value].sort((a, b) => a - b),
    );

  const patternSummary = (): string => {
    const unit = freq === "daily" ? "day" : "week";
    const every =
      interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
    const on =
      freq === "weekly" && weekdays.length > 0
        ? ` on ${WEEKDAYS.filter((d) => weekdays.includes(d.value))
            .map((d) => d.label)
            .join(", ")}`
        : "";
    return `${every}${on}, until ${dayjs(endDate).format("D MMM YYYY")}`;
  };

  const handleSubmit = async (): Promise<void> => {
    if (!form.title || !form.date || !form.start_time || !form.end_time) {
      setError("Please fill in all required fields.");
      return;
    }
    if (repeat && !existing) {
      if (freq === "weekly" && weekdays.length === 0) {
        setError("Pick at least one day of the week to repeat on.");
        return;
      }
      if (endDate < form.date) {
        setError("The repeat-until date must be on or after the start date.");
        return;
      }
    }
    setSubmitting(true);
    setError("");

    const recurrence: Recurrence | undefined =
      repeat && !existing
        ? {
            freq,
            interval,
            by_weekday: freq === "weekly" ? weekdays : [],
            end_date: endDate,
          }
        : undefined;

    const body = {
      ...form,
      ...(recurrence ? { recurrence } : {}),
      ...(isSeriesOccurrence ? { scope } : {}),
    };

    try {
      const url = existing ? `/api/blocks/${existing.id}` : "/api/blocks";
      const method = existing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        setError(err.error || "Something went wrong.");
        setSubmitting(false);
        return;
      }

      // A new series comes back as an array of occurrences; everything else as
      // a single block.
      const saved: Block | Block[] = await res.json();
      onSave(saved, isSeriesOccurrence && scope === "future");
    } catch {
      setError("Could not connect to server.");
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.form}>
      <h3 className={styles.heading}>
        {existing ? "Edit Block" : "New Time Block"}
      </h3>

      <label className={styles.label}>
        Activity *
        <input
          className={styles.input}
          placeholder="e.g. Gym — Legs, Dinner with Sarah, Team standup"
          value={form.title}
          onChange={set("title")}
        />
      </label>

      <label className={styles.label}>
        Notes <span className={styles.optional}>(optional)</span>
        <textarea
          className={styles.textarea}
          placeholder="Any extra context helps with categorisation..."
          value={form.description}
          onChange={set("description")}
          rows={2}
        />
      </label>

      <label className={styles.label}>
        Date *
        <input
          className={styles.input}
          type="date"
          value={form.date}
          onChange={handleDateChange}
        />
      </label>

      <div className={styles.timeRow}>
        <label className={styles.label}>
          Start *
          <input
            className={styles.input}
            type="time"
            value={form.start_time}
            onChange={set("start_time")}
          />
        </label>
        <label className={styles.label}>
          End *
          <input
            className={styles.input}
            type="time"
            value={form.end_time}
            onChange={set("end_time")}
          />
        </label>
      </div>

      {/* Repeat options are for new blocks only — an existing series is changed
          by editing one of its occurrences with "all future" scope. */}
      {!existing && (
        <div className={styles.repeatSection}>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={repeat}
              onChange={(e) => handleRepeatToggle(e.target.checked)}
            />
            Repeat this block
          </label>

          {repeat && (
            <div className={styles.repeatBody}>
              <div className={styles.freqRow}>
                <label className={styles.label}>
                  Repeats
                  <select
                    className={styles.input}
                    value={freq}
                    onChange={(e) => setFreq(e.target.value as Freq)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </label>
                <label className={styles.label}>
                  Every
                  <select
                    className={styles.input}
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n === 1
                          ? freq === "daily"
                            ? "day"
                            : "week"
                          : `${n} ${freq === "daily" ? "days" : "weeks"}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {freq === "weekly" && (
                <div className={styles.label}>
                  On these days *
                  <div className={styles.dayPicker}>
                    {WEEKDAYS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        className={`${styles.dayBtn} ${
                          weekdays.includes(day.value) ? styles.dayBtnOn : ""
                        }`}
                        onClick={() => toggleWeekday(day.value)}
                        aria-pressed={weekdays.includes(day.value)}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className={styles.label}>
                Repeat until *
                <input
                  className={styles.input}
                  type="date"
                  value={endDate}
                  min={form.date}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>

              <p className={styles.patternHint}>{patternSummary()}</p>
            </div>
          )}
        </div>
      )}

      {/* Editing one occurrence of a series: ask what it should apply to. */}
      {isSeriesOccurrence && (
        <div className={styles.repeatSection}>
          <p className={styles.scopeIntro}>
            ↻ This block repeats. Apply your changes to:
          </p>
          <label className={styles.checkRow}>
            <input
              type="radio"
              name="scope"
              checked={scope === "single"}
              onChange={() => setScope("single")}
            />
            Just this occurrence
          </label>
          <label className={styles.checkRow}>
            <input
              type="radio"
              name="scope"
              checked={scope === "future"}
              onChange={() => setScope("future")}
            />
            This and all future ones
          </label>
          {scope === "future" && form.date !== existing?.date && (
            <p className={styles.patternHint}>
              Moving this to {dayjs(form.date).format("ddd D MMM")} shifts every
              later occurrence by the same number of days.
            </p>
          )}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button
          className={styles.cancel}
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          className={styles.submit}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Saving…" : existing ? "Save Changes" : "Save Block"}
        </button>
      </div>

      {submitting && (
        <p className={styles.hint}>✦ Claude is categorising your activity…</p>
      )}
    </div>
  );
}
