import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import dayjs from "dayjs";
import { AnalyticsEntry } from "../models";
import styles from "./AnalyticsPage.module.css";

interface Period {
  label: string;
  getDates: () => { from?: string; to?: string };
}

const PERIODS: Period[] = [
  {
    label: "This week",
    getDates: () => ({
      from: dayjs().startOf("week").format("YYYY-MM-DD"),
      to: dayjs().endOf("week").format("YYYY-MM-DD"),
    }),
  },
  {
    label: "This month",
    getDates: () => ({
      from: dayjs().startOf("month").format("YYYY-MM-DD"),
      to: dayjs().endOf("month").format("YYYY-MM-DD"),
    }),
  },
  {
    label: "Last month",
    getDates: () => ({
      from: dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
      to: dayjs().subtract(1, "month").endOf("month").format("YYYY-MM-DD"),
    }),
  },
  { label: "All time", getDates: () => ({}) },
];

function getCatColor(name: string): string {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue(`--cat-${name.replace(/\s/g, "")}`)
      .trim() || "#aaaaaa"
  );
}

const RADIAN = Math.PI / 180;
interface LabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}

function renderCustomLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: LabelProps) {
  if (percent < 0.05) return null; // hide labels for tiny slices
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={500}
    >
      {`${name} ${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsEntry[]>([]);
  const [period, setPeriod] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setLoading(true);
      const { from, to } = PERIODS[period].getDates();
      const params = from && to ? `?from=${from}&to=${to}` : "";
      const res = await fetch(`/api/blocks/analytics${params}`, {
        credentials: "include",
      });
      const json: AnalyticsEntry[] = await res.json();
      setData(json);
      setLoading(false);
    };
    loadData();
  }, [period]);

  const totalPlanned = data.reduce((s, d) => s + d.planned, 0);
  const totalCompleted = data.reduce((s, d) => s + d.completed, 0);
  const completionRate =
    totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;

  // Only include categories with completed hours in the pie chart
  const pieData = data
    .filter((d) => d.completed > 0)
    .map((d) => ({
      name: d.category,
      value: d.completed,
      color: getCatColor(d.category),
    }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Time Insights</h2>
          <p className={styles.subtitle}>
            See where your time is really going.
          </p>
        </div>
        <div className={styles.periodToggle}>
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              className={
                i === period
                  ? `${styles.periodBtn} ${styles.active}`
                  : styles.periodBtn
              }
              onClick={() => setPeriod(i)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className={styles.empty}>Loading insights…</div>
      ) : data.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No data for this period.</p>
          <p>Add some time blocks to see your breakdown.</p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <div className={styles.statValue}>{totalPlanned.toFixed(1)}h</div>
              <div className={styles.statLabel}>Planned</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>
                {totalCompleted.toFixed(1)}h
              </div>
              <div className={styles.statLabel}>Completed</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{completionRate}%</div>
              <div className={styles.statLabel}>Completion rate</div>
            </div>
          </div>

          {/* Charts row */}
          <div className={styles.chartsRow}>
            {/* Bar chart — planned vs completed */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Planned vs Completed</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
                >
                  <XAxis
                    type="number"
                    unit="h"
                    tick={{ fontSize: 12, fill: "#9090aa" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={90}
                    tick={{ fontSize: 12, fill: "#4a4a6a" }}
                  />
                  <Tooltip formatter={(v) => [`${v}h`]} />
                  <Legend />
                  <Bar
                    dataKey="planned"
                    name="Planned"
                    fill="#c9d4e0"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="completed"
                    name="Completed"
                    fill="#c9732a"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart — completed hours distribution */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Completed Hours by Category</h3>
              {pieData.length === 0 ? (
                <div className={styles.pieEmpty}>
                  No completed blocks yet for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v}h`, "Completed"]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Breakdown table */}
          <div className={styles.breakdown}>
            <h3 className={styles.chartTitle}>Full Breakdown</h3>
            <div className={styles.breakdownList}>
              {data.map((d) => (
                <div key={d.category} className={styles.breakdownRow}>
                  <span
                    className={styles.dot}
                    style={{ background: getCatColor(d.category) }}
                  />
                  <span className={styles.breakdownCat}>{d.category}</span>
                  <div className={styles.barGroup}>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFillPlanned}
                        style={{
                          width: `${(d.planned / totalPlanned) * 100}%`,
                        }}
                      />
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFillCompleted}
                        style={{
                          width: `${d.planned > 0 ? (d.completed / d.planned) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className={styles.breakdownHours}>
                    <span>{d.planned}h</span>
                    <span className={styles.completedHours}>
                      {d.completed}h
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.legend}>
              <span className={styles.legendPlanned}>■ Planned</span>
              <span className={styles.legendCompleted}>■ Completed</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
