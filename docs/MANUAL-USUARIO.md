# Manual de Usuario — App de Rendición de Gastos

Esta guía explica cómo usar la aplicación para registrar y consultar gastos. Está pensada para
usarse desde el **celular** (aunque también funciona en computador).

---

## 1. Iniciar sesión

1. Abre la aplicación en tu navegador (tu administrador te dará la dirección).
2. Toca **"Iniciar sesión con Google"**.
3. Elige tu cuenta corporativa **@bosca.cl**.
4. Listo: entras a la pantalla de chat con un saludo.

> Si ves un mensaje de "no autorizado", tu cuenta aún no fue habilitada. Pídele a tu administrador
> que te agregue.

---

## 1.1. Completa tu perfil (solo la primera vez)

La primera vez que entras (o si te falta algún dato), la app te muestra el formulario **"Completa tu
perfil"** antes de dejarte usar el chat. Es rápido y se hace una sola vez:

- **Nombre completo** (obligatorio).
- **RUT** (obligatorio): se valida y se ordena solo (p. ej. `76.543.219-7`).
- **Área de trabajo** (obligatorio): elígela del menú.
- **Banco** y **N° cuenta corriente** (opcionales): solo se usan si pides que un gasto te lo
  **reembolsen** (ver "Devolución" en la sección 4). Puedes dejarlos en blanco y agregarlos después.

Toca **"Guardar y empezar"** y pasas al chat. Estos datos salen en tu **rendición en PDF**, por eso se
piden al inicio.

---

## 2. Registrar un gasto por texto

Es la forma más rápida cuando no tienes la boleta a mano o quieres ir directo.

1. En la barra de abajo, escribe el gasto en lenguaje natural. Ejemplos:
   - `combustible $45.000 en Copec`
   - `almuerzo 12000 restaurant El Bosque`
   - `peaje 3500`
2. Toca **Enviar**.
3. El bot lee lo que escribiste y **te pregunta lo que falte**. Por ejemplo, si no pusiste la fecha,
   te preguntará: *"¿Cuál es la fecha del documento? (formato AAAA-MM-DD)"*.
4. Responde cada pregunta hasta que el bot tenga todo lo esencial: **comercio, monto, categoría y
   fecha**.
5. Aparecerá una **tarjeta de confirmación** (ver sección 4). Ahí terminas de completar el resto
   (tipo, documento, centro de costo) antes de guardar.

---

## 3. Registrar un gasto con foto de la boleta

La forma recomendada: el bot lee la boleta por ti.

1. Toca el botón **📷** (abajo a la izquierda).
2. En el celular podrás **tomar una foto** con la cámara o **elegir una de la galería**.
   - Se aceptan **imágenes** (JPG, PNG). Para que el bot lea bien los datos, usa una foto de la boleta.
3. El bot procesa la imagen (verás "Procesando…") y **extrae automáticamente**: comercio, monto,
   fecha, RUT del emisor, número de documento.
4. Si algún dato esencial no se pudo leer, el bot te lo preguntará.
5. Aparecerá la **tarjeta de confirmación** con los datos leídos y la imagen ya guardada.

> 💡 Consejo: una foto nítida, bien iluminada y derecha mejora mucho la lectura.

---

## 4. Revisar y confirmar (la tarjeta de confirmación)

Antes de guardar, siempre revisas una tarjeta con los datos. **Todos los campos son editables**, así
que si el bot leyó algo mal, lo corriges aquí:

- **Tipo**: elige **"Rendición (solo justificar)"** o **"Devolución (me reembolsan)"**.
  - Si eliges **Devolución**, aparecen abajo **Banco** y **N° cuenta corriente** (vienen de tu perfil,
    pero puedes ajustarlos). Son obligatorios para registrar una devolución.
- **Comercio**, **Monto**, **Fecha**: edítalos directamente. El monto puedes escribirlo como `45000`
  o `$45.000`; ambos funcionan.
- **Categoría**: del menú. Son: Combustible, Alimentación, Transporte, Peajes, Hospedaje, Materiales,
  Servicios, Otros.
- **Tipo de documento**: **Boleta**, **Factura** u **Otro**.
- **Neto** e **IVA**: para **Factura** se calculan solos a partir del monto; puedes corregirlos.
- **Centro de costo → Área → Ubicación** (obligatorios): se eligen en ese orden (al elegir el centro
  de costo se habilita el área, y luego la ubicación). Sirven para imputar el gasto.
- **Observación** (opcional): una nota libre, por ejemplo "Camioneta de la flota".
- El **RUT del emisor** se muestra de referencia (si la boleta lo tenía).

Cuando esté todo correcto:
- Toca **"Confirmar registro"** → el gasto se guarda y verás **"✅ Gasto registrado."**.
- O toca **"Cancelar"** si te equivocaste y quieres empezar de nuevo.

Después de guardar, el bot te pregunta **"¿Deseas registrar otro?"**: toca **Sí** para seguir o
**No** para terminar.

> El botón "Confirmar registro" se mantiene deshabilitado hasta que estén todos los campos
> obligatorios (incluidos centro de costo, área y ubicación).

---

## 5. Ver el resumen (Dashboard)

Toca **"Dashboard"** en la parte superior. Ahí ves:

- **Período (Desde / Hasta)**: elige el rango de fechas con dos selectores; todo lo de abajo se
  recalcula para ese rango.
- **Descargar PDF**: genera tu **rendición en PDF** del rango elegido (con tus datos, el detalle de
  cada gasto y los totales) y la descarga al instante.
- **Total del período**: cuánto se gastó en el rango.
- **Rendiciones vs Devoluciones**: cuánto es solo justificado y cuánto te deben reembolsar.
- **Por categoría**: un gráfico de dona que muestra en qué se gasta más.
- **Tendencia**: un gráfico de barras por día.

Para volver al chat, toca **"← Chat"**.

---

## 6. ¿Qué puede ver cada quién? (roles)

Hay dos tipos de usuario:

| | **Usuario** | **Administrador** |
|---|---|---|
| Registrar gastos | ✅ | ✅ |
| Ver sus propios gastos | ✅ | ✅ |
| Ver los gastos de **todos** | ❌ | ✅ |
| Dashboard | ✅ (solo lo suyo) | ✅ (vista global) |
| Ver **"Por usuario"** y **"Pendientes"** en el dashboard | ❌ | ✅ |

En otras palabras: como **Usuario** ves y registras solo lo tuyo; como **Administrador** ves todo y
tienes el panorama completo en el dashboard.

---

## 6.1. Aprobar o rechazar gastos (gerentes)

Si tu perfil tiene asignado uno o más centros de costo (o "todos", para el Gerente
General), verás el enlace **"Aprobaciones"** en el encabezado, con el número de gastos
pendientes.

1. Toca **"Aprobaciones"**.
2. Verás los gastos **pendientes** de tu(s) centro(s) de costo, con su detalle y la
   boleta.
3. **Aprobar**: el gasto queda aprobado y sale de la lista.
4. **Rechazar**: escribe el **motivo** (obligatorio) y confirma.

Notas:
- No puedes aprobar **tus propios** gastos: esos los revisa el Gerente General.
- El **Gerente General** puede aprobar en cualquier centro de costo.
- Una vez decidido, el gasto no vuelve a la lista (la decisión es final).

---

## 7. Preguntas frecuentes

**¿Necesito internet?**
Sí. La app guarda todo en la nube (Google Sheets y Drive) y usa el asistente para leer las boletas.

**El bot no entendió mi mensaje.**
Reformúlalo de manera más simple, por ejemplo "categoría monto comercio": `combustible 45000 Copec`.
O usa una foto.

**El bot leyó mal un dato de la boleta.**
No hay problema: corrígelo en la tarjeta de confirmación antes de confirmar.

**¿Puedo registrar sin foto?**
Sí, por texto. La foto es opcional (aunque útil como respaldo).

**Me equivoqué y ya confirmé un gasto.**
La edición/eliminación de gastos ya guardados la maneja un administrador directamente en la planilla
(en esta versión). Avísale.

**¿Por voz?**
Aún no — está planificado para una versión futura. Por ahora: texto o foto.

---

¿Dudas que esta guía no cubre? Contacta a tu administrador.
