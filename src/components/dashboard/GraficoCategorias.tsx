"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCLP } from "@/lib/format";

// Paleta cálida de tierra (Bosca): burdeo, ámbar, terracota, oliva, carbón, gris cálido…
const COLORES = [
  "#7a2230",
  "#c8772e",
  "#a8553a",
  "#6b7a3a",
  "#1e1b1a",
  "#9c8b7a",
  "#5a2e3a",
  "#d9a05b",
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
