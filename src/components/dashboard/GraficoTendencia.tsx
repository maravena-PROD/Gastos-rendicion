"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { formatCLP } from "@/lib/format";

export function GraficoTendencia({
  datos,
}: {
  datos: { fecha: string; total: number }[];
}) {
  if (datos.length === 0) {
    return <p className="text-sm text-gray-400">Sin datos en este período.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={datos}>
        <XAxis
          dataKey="fecha"
          tick={{ fontSize: 10 }}
          tickFormatter={(v: string) => v.slice(8)}
        />
        <YAxis tickFormatter={(v: number) => formatCLP(v)} width={72} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v) => formatCLP(v as number)} />
        <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
