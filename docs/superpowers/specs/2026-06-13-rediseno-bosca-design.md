# Diseño — Rediseño visual marca Bosca + saludo personalizado

**Fecha:** 2026-06-13
**Estado:** Diseño aprobado, pendiente revisión del spec

## Contexto

La app de rendición de gastos funciona en producción con una estética genérica (acento azul). Se
rediseña para alinearla a la **marca Bosca** (calefacción y vida al aire libre — fuego, calor,
hogar) y se personaliza el saludo del bot con el nombre del usuario.

Investigación de marca (bosca.cl): base **carbón/negro**, acento **burdeo/vino**, **tonos cálidos
de tierra** (ámbar/brasa), estética cálida y premium, sans-serif limpia.

## Decisiones tomadas en brainstorming

- Dirección elegida: **carbón + burdeo + calidez de brasa**, fondo crema cálida (no la variante
  minimalista blanca ni la oscura "Black Vision").
- Saludo personalizado del bot al entrar con perfil completo.

## Paleta (tema Bosca)

| Token | Uso | Hex |
|---|---|---|
| `bosca-crema` | Fondo de la app | `#F7F4EF` |
| `bosca-carbon` | Cabeceras, texto fuerte | `#1E1B1A` |
| `bosca-burdeo` | Acento principal (botones, burbuja usuario) | `#7A2230` |
| `bosca-burdeo-h` | Hover del burdeo | `#8E2A3A` |
| `bosca-ambar` | Acento cálido (pendientes, destacados, gráficos) | `#C8772E` |
| `bosca-gris` | Burbujas del bot, bordes, superficies | `#EDE8E1` |

**Implementación del tema:** Tailwind v4 → se definen estos colores como tokens en `@theme` dentro
de `src/app/globals.css`, generando utilidades (`bg-bosca-burdeo`, `text-bosca-carbon`, etc.). Los
componentes referencian esos tokens en vez de los `blue-*`/`gray-*` genéricos. El `body` usa fondo
crema.

## Cambios por pantalla/componente

- **`globals.css`** — tokens `@theme` + fondo crema del `body` + color de texto base carbón.
- **Cabecera (chat y dashboard)** — fondo **carbón**, texto claro, marca **"🔥 Bosca · Rendición
  de Gastos"**. Enlaces/botón "Salir" en estilo claro sobre carbón.
- **Saludo (`page.tsx`)** — mensaje inicial: **"Hola {nombre} 👋 ¿Qué gasto registramos hoy?"**
  (usa `perfil.nombre`, que ya está disponible en el componente `Chat`).
- **Burbujas (`MensajeBurbuja`)** — usuario: fondo **burdeo**, texto claro. Bot: fondo **gris
  cálido**, texto carbón.
- **Botones primarios** (Enviar, Confirmar, Guardar, Sí) — **burdeo** con hover; secundarios
  (Cancelar, No) — contorno sobre crema.
- **Barra de entrada (`BarraEntrada`)** — botón Enviar burdeo; bordes/inputs cálidos.
- **Tarjeta de confirmación (`TarjetaConfirmacion`)** — superficie clara, botón confirmar burdeo.
- **Onboarding (`Onboarding`)** — tarjeta de marca, botón burdeo.
- **Login (`login/page.tsx`)** — fondo crema, título **Bosca**, botón "Iniciar sesión con Google"
  en burdeo, tono cálido.
- **Dashboard (`dashboard/page.tsx`)** — cabecera carbón; total y tarjetas con acentos cálidos;
  conteo de **pendientes en ámbar**.
- **Gráficos (`GraficoCategorias`, `GraficoTendencia`)** — paleta cálida de tierra: barras de
  tendencia en **burdeo**; dona de categorías con secuencia burdeo/ámbar/terracota/oliva/carbón/
  gris cálido (en vez de la paleta azul/multicolor actual).
- **AuthGate / estados de carga** — texto/acentos en tono carbón sobre crema.

## Verificación (entregable: app operativa y verificada)

- `npx tsc --noEmit` limpio y `npm test` en verde (los cambios son de estilo; la lógica no cambia,
  así que las pruebas existentes deben seguir pasando).
- `npm run build` compila.
- Revisión visual de las pantallas (chat, login, onboarding, dashboard).
- Despliegue a Vercel (`vercel --prod`) y verificación en vivo (saludo con nombre + look Bosca).

## Fuera de alcance

- **Sin cambios de lógica** (auth, registro, perfil, guardado): es puramente visual + el saludo.
- **Sin archivo de logo** (no se descarga imagen de Bosca): la marca se representa con el wordmark
  de texto "Bosca" + un emoji 🔥. Si después se quiere el logo oficial, se agrega como asset.
- No se agregan fuentes externas nuevas (se usa la sans del sistema, coherente con la marca); se
  puede sumar una fuente luego si se desea.

## Pruebas

No hay unidades nuevas testeables (es estilo). Las pruebas existentes (104) deben seguir verdes
porque no cambia la lógica. Verificación principal: `npm run build` + revisión visual + prueba en
vivo tras desplegar.
