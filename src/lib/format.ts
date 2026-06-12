/** Formatea un entero de pesos chilenos como "$45.000". */
export function formatCLP(monto: number): string {
  const entero = Math.round(monto);
  const conPuntos = entero
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${conPuntos}`;
}

/**
 * Parsea un texto de monto en CLP a entero.
 * Ignora símbolo, separadores de miles y decimales tipo ",00".
 * Devuelve null si no hay dígitos.
 */
export function parseCLP(texto: string): number | null {
  // Elimina parte decimal ",dd" al final antes de quitar separadores.
  const sinDecimales = texto.replace(/,\d{1,2}\b/g, "");
  const soloDigitos = sinDecimales.replace(/[^\d]/g, "");
  if (soloDigitos.length === 0) return null;
  return parseInt(soloDigitos, 10);
}
