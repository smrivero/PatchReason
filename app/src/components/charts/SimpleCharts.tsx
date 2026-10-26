import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartRow {
  label: string;
  value: number;
}

export function LabelDonut({ vulnerable, safe }: { vulnerable: number; safe: number }) {
  const data = [
    { name: "Vulnerable label", value: vulnerable },
    { name: "Safe label", value: safe },
  ];
  return (
    <div className="h-52 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={78} paddingAngle={3} isAnimationActive={false}>
            <Cell fill="#4F46E5" />
            <Cell fill="#14B8A6" />
          </Pie>
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E5EAF2", borderRadius: 12 }}
            labelStyle={{ color: "#172033" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PartitionBars({
  rows,
}: {
  rows: readonly { label: string; vulnerable: number; safe: number }[];
}) {
  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...rows]} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#E5EAF2" vertical={false} />
          <XAxis dataKey="label" stroke="#64748B" tick={{ fill: "#64748B", fontSize: 12 }} />
          <YAxis stroke="#64748B" tick={{ fill: "#64748B", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E5EAF2", borderRadius: 12 }}
            labelStyle={{ color: "#172033" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#64748B" }} />
          <Bar dataKey="vulnerable" name="Vulnerable" fill="#4F46E5" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="safe" name="Safe" fill="#14B8A6" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MetricBars({ rows, scale }: { rows: readonly ChartRow[]; scale: "percent" | "count" }) {
  const highest = rows.reduce((max, row) => Math.max(max, row.value), 0);
  const top = scale === "percent" ? 100 : Math.max(1, Math.ceil(highest));
  return (
    <div className="h-56 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...rows]} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#E5EAF2" vertical={false} />
          <XAxis dataKey="label" stroke="#64748B" tick={{ fill: "#64748B", fontSize: 12 }} />
          <YAxis domain={[0, top]} stroke="#64748B" tick={{ fill: "#64748B", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E5EAF2", borderRadius: 12 }}
            labelStyle={{ color: "#172033" }}
          />
          <Bar dataKey="value" fill="#4F46E5" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeriesLine({
  rows,
  color,
  valueLabel,
}: {
  rows: readonly ChartRow[];
  color: string;
  valueLabel: string;
}) {
  const data = rows.map((row) => ({ label: row.label, [valueLabel]: row.value }));
  return (
    <div className="h-48 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#E5EAF2" vertical={false} />
          <XAxis dataKey="label" stroke="#64748B" tick={{ fill: "#64748B", fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis stroke="#64748B" tick={{ fill: "#64748B", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E5EAF2", borderRadius: 12 }}
            labelStyle={{ color: "#172033" }}
          />
          <Line type="monotone" dataKey={valueLabel} stroke={color} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LossLines({
  rows,
  showValidation,
}: {
  rows: readonly { step: string; trainLoss: number; validationLoss: number | null }[];
  showValidation: boolean;
}) {
  return (
    <div className="h-56 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...rows]} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#E5EAF2" vertical={false} />
          <XAxis dataKey="step" stroke="#64748B" tick={{ fill: "#64748B", fontSize: 11 }} />
          <YAxis stroke="#64748B" tick={{ fill: "#64748B", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E5EAF2", borderRadius: 12 }}
            labelStyle={{ color: "#172033" }}
          />
          <Line type="monotone" dataKey="trainLoss" name="Train loss" stroke="#4F46E5" dot={false} isAnimationActive={false} />
          {showValidation ? (
            <Line
              type="monotone"
              dataKey="validationLoss"
              name="Validation loss"
              stroke="#0D9488"
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
