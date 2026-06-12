"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCLP } from "@/lib/format";

const COLORES = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

export function GraficoCategorias({
  datos,
}: {
  datos: { categoria: string; total: number }[];
}) {
  if (datos.length === 0) {
    return <p className="text-sm text-gray-400">Sin datos en este período.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={datos} dataKey="total" nameKey="categoria" innerRadius={55} outerRadius={85}>
          {datos.map((_, i) => (
            <Cell key={i} fill={COLORES[i % COLORES.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatCLP(v as number)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
