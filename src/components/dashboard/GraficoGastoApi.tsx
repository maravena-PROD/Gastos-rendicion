"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const usd = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

/** Gasto de la API de Claude por día (USD). Distinto dominio que los gastos en CLP. */
export function GraficoGastoApi({
  datos,
}: {
  datos: { fecha: string; montoUSD: number }[];
}) {
  if (datos.length === 0) {
    return <p className="text-sm text-gray-400">Aún no hay gasto este mes.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={datos}>
        <XAxis
          dataKey="fecha"
          tick={{ fontSize: 10 }}
          tickFormatter={(v: string) => v.slice(8)}
        />
        <YAxis tickFormatter={(v: number) => usd(v)} width={72} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v) => usd(v as number)} labelFormatter={(l) => `Día ${String(l).slice(8)}`} />
        <Bar dataKey="montoUSD" fill="#c2703d" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
