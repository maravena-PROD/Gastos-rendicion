import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
import type { ModeloReporte } from "./reporte";
import { formatCLP } from "./format";

// Desactivamos la hyphenación automática: por defecto @react-pdf parte palabras
// con patrones en inglés (genera cortes erróneos como "descrip-ción") e inserta
// guiones. Devolviendo la palabra intacta, el texto solo salta de línea entre
// espacios.
Font.registerHyphenationCallback((palabra) => [palabra]);

// Los folios largos sin espacios (p. ej. "597053013994A2491504") no tienen
// dónde cortar, así que @react-pdf los parte por la fuerza con un guión que
// confunde el número. Insertamos un espacio cada 14 caracteres en tokens muy
// largos (>= 16) para que envuelvan limpio, sin guión. Se aplica SOLO a folios
// (no a texto natural, donde partiría palabras españolas largas).
function envolverTokensLargos(texto: string): string {
  return texto.replace(/\S{16,}/g, (token) => token.replace(/(.{14})/g, "$1 "));
}

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

type ColDef = { k: string; t: string; w: number; num?: boolean; wrap?: boolean };

// Anchos en puntos por columna. Suman ~782, justo bajo el ancho útil de A4
// horizontal (~794 = 841.89 - 2*24 de padding), para aprovechar todo el ancho
// sin desbordar la página.
const cols: ColDef[] = [
  { k: "fechaCompra", t: "Fecha", w: 46 },
  { k: "proveedor", t: "Proveedor", w: 112 },
  { k: "centroCosto", t: "C.Costo", w: 40 },
  { k: "area", t: "Área", w: 38 },
  { k: "ubicacion", t: "Ubic.", w: 38 },
  { k: "tipoDocumento", t: "Tipo", w: 36 },
  { k: "numeroDocumento", t: "N° Doc", w: 88, wrap: true },
  { k: "descripcion", t: "Descripción", w: 162 },
  { k: "neto", t: "Neto", w: 56, num: true },
  { k: "iva", t: "IVA", w: 50, num: true },
  { k: "total", t: "Total", w: 62, num: true },
  { k: "tipoRendicion", t: "Tipo rend.", w: 54 },
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
              const val = c.num
                ? formatCLP(Number(raw))
                : c.wrap
                  ? envolverTokensLargos(String(raw))
                  : String(raw);
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
