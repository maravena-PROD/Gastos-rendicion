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
  // overflow hidden: el contenido se mantiene dentro de su columna y nunca
  // invade la celda vecina (folios largos antes se desbordaban).
  celda: { padding: 3, borderRightWidth: 0.5, borderRightColor: "#ccc", overflow: "hidden" },
  num: { textAlign: "right" },
});

type ColDef = { k: string; t: string; w: number; num?: boolean };

// Anchos en puntos por columna (suman < ancho útil de A4 horizontal).
const cols: ColDef[] = [
  { k: "fechaCompra", t: "Fecha", w: 44 },
  { k: "proveedor", t: "Proveedor", w: 64 },
  { k: "centroCosto", t: "C.Costo", w: 38 },
  { k: "area", t: "Área", w: 36 },
  { k: "ubicacion", t: "Ubic.", w: 36 },
  { k: "tipoDocumento", t: "Tipo", w: 38 },
  { k: "numeroDocumento", t: "N° Doc", w: 60 },
  { k: "descripcion", t: "Descripción", w: 92 },
  { k: "neto", t: "Neto", w: 46, num: true },
  { k: "iva", t: "IVA", w: 42, num: true },
  { k: "total", t: "Total", w: 50, num: true },
  { k: "tipoRendicion", t: "Tipo rend.", w: 52 },
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
            <View key={c.k} style={[styles.celda, { width: c.w }]}>
              <Text style={c.num ? styles.num : undefined}>{c.t}</Text>
            </View>
          ))}
        </View>
        {filas.map((f, i) => (
          <View key={i} style={styles.fila}>
            {cols.map((c) => {
              const raw = f[c.k as keyof typeof f];
              const val = c.num ? formatCLP(Number(raw)) : String(raw);
              return (
                <View key={c.k} style={[styles.celda, { width: c.w }]}>
                  <Text style={c.num ? styles.num : undefined}>{val}</Text>
                </View>
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
