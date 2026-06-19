const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Formatea un año-mes "AAAA-MM" como "Junio 2026". Devuelve el input si es inválido. */
export function formatMes(anioMes: string): string {
  const [anio, mes] = anioMes.split("-");
  const i = parseInt(mes, 10) - 1;
  if (!anio || i < 0 || i > 11) return anioMes;
  return `${MESES[i]} ${anio}`;
}

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

/** Quita puntos, guión y espacios; deja cuerpo + dígito verificador en mayúscula. */
function limpiarRut(rut: string): string {
  return rut.replace(/[.\-\s]/g, "").toUpperCase();
}

/** Formatea un RUT como "76.123.456-7". Devuelve el input limpio si es muy corto. */
export function formatRut(rut: string): string {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const cuerpoConPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpoConPuntos}-${dv}`;
}

/** Calcula el dígito verificador (módulo 11) de un cuerpo numérico. */
function calcularDv(cuerpo: string): string {
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return resto.toString();
}

/** Valida un RUT chileno con su dígito verificador (módulo 11). */
export function validarRut(rut: string): boolean {
  const limpio = limpiarRut(rut);
  if (!/^\d+[\dK]$/.test(limpio) || limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return calcularDv(cuerpo) === dv;
}
