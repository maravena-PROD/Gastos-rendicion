import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ModeloReporte } from "./reporte";
import { formatCLP } from "./format";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: "Helvetica" },
  titulo: { fontSize: 13, fontWeight: "bold", marginBottom: 8 },
  cab: { marginBottom: 10 },
  cabLinea: { flexDirection: "row", marginBottom: 2 },
  cabEtq: { width: 90, fontWeight: "bold" },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999" },
  filaCab: { flexDirection: "row", backgroundColor: "#eee", borderBottomWidth: 1, borderBottomColor: "#333" },
  celda: { padding: 3, borderRightWidth: 0.5, borderRightColor: "#ccc" },
  num: { textAlign: "right" },
});

type ColDef = { k: string; t: string; w: number; num?: boolean };

// Anchos relativos (suman ~100) por columna.
const cols: ColDef[] = [
  { k: "fechaCompra", t: "Fecha", w: 42 },
  { k: "proveedor", t: "Proveedor", w: 70 },
  { k: "centroCosto", t: "C.Costo", w: 38 },
  { k: "area", t: "Área", w: 38 },
  { k: "ubicacion", t: "Ubic.", w: 38 },
  { k: "tipoDocumento", t: "Tipo", w: 40 },
  { k: "numeroDocumento", t: "N° Doc", w: 45 },
  { k: "descripcion", t: "Descripción", w: 90 },
  { k: "neto", t: "Neto", w: 45, num: true },
  { k: "iva", t: "IVA", w: 40, num: true },
  { k: "total", t: "Total", w: 50, num: true },
  { k: "tipoRendicion", t: "Tipo rend.", w: 50 },
];

export function ReporteDocument({ modelo }: { modelo: ModeloReporte }) {
  const { cabecera, filas, totales } = modelo;
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.titulo}>Rendición de Gastos</Text>
        <View style={styles.cab}>
          <View style={styles.cabLinea}><Text style={styles.cabEtq}>Rendición de:</Text><Text>{cabecera.nombre}</Text></View>
          <View style={styles.cabLinea}><Text style={styles.cabEtq}>RUT:</Text><Text>{cabecera.rut}</Text></View>
          <View style={styles.cabLinea}><Text style={styles.cabEtq}>Correo:</Text><Text>{cabecera.correo}</Text></View>
          <View style={styles.cabLinea}><Text style={styles.cabEtq}>C. Corriente:</Text><Text>{cabecera.cuentaCorriente} — {cabecera.banco}</Text></View>
          <View style={styles.cabLinea}><Text style={styles.cabEtq}>Período:</Text><Text>{cabecera.desde} a {cabecera.hasta}</Text></View>
          <View style={styles.cabLinea}><Text style={styles.cabEtq}>Fecha rendición:</Text><Text>{cabecera.fechaRendicion}</Text></View>
        </View>

        <View style={styles.filaCab}>
          {cols.map((c) => (
            <Text key={c.k} style={[styles.celda, { width: c.w }, c.num ? styles.num : {}]}>{c.t}</Text>
          ))}
        </View>
        {filas.map((f, i) => (
          <View key={i} style={styles.fila}>
            {cols.map((c) => {
              const raw = f[c.k as keyof typeof f];
              const val = c.num ? formatCLP(Number(raw)) : String(raw);
              return (
                <Text key={c.k} style={[styles.celda, { width: c.w }, c.num ? styles.num : {}]}>{val}</Text>
              );
            })}
          </View>
        ))}

        <View style={{ marginTop: 10 }}>
          <Text>Total Neto: {formatCLP(totales.neto)}    IVA: {formatCLP(totales.iva)}    Total: {formatCLP(totales.total)}</Text>
          <Text style={{ marginTop: 4 }}>Rendición (justificado): {formatCLP(totales.rendicion)}    Devolución (a reembolsar): {formatCLP(totales.devolucion)}</Text>
        </View>
      </Page>
    </Document>
  );
}

/** Helper callable from a .ts API route to keep JSX out of the route file. */
export async function renderReportePdf(modelo: ModeloReporte): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const result = await renderToBuffer(<ReporteDocument modelo={modelo} />);
  return Buffer.from(result as Uint8Array);
}
