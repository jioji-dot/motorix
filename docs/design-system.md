# Motorix — Sistema de diseño (UI)

> **Documento complementario de `project-context.md`**
> Guía visual para el desarrollo asistido por IA (CLAUDE) del frontend en Flutter.
> Si una decisión de este documento cambia, actualizarlo antes de modificar la interfaz.

---

## 1. Propósito y reglas para el agente

Este documento define cómo debe verse y comportarse la interfaz de Motorix. El objetivo es una UI profesional, sobria y con identidad propia, que no parezca generada por IA.

### Reglas para el agente de IA

- Usar **Material Design 3** como base obligatoria (`useMaterial3: true`).
- **No** usar el tema por defecto de Material: definir un tema propio ([sección 4](#4-tema-de-material-3)).
- Se permite una librería complementaria de diseño además de Material 3 ([sección 3](#3-stack-de-diseño-en-flutter)), sin reemplazar el tema M3.
- No introducir dependencias nuevas sin justificarlas y proponerlas antes.
- Todos los colores, tamaños de letra, radios y espacios salen de los tokens de este documento. **No escribir valores sueltos en las pantallas.**
- Respetar la lista de "qué evitar" ([sección 9](#9-qué-evitar-señales-de-hecho-por-ia)).
- **Prioridad: escritorio.** La interfaz debe ser responsive, pero se diseña primero para pantallas anchas.
- Mostrar en la navegación solo los módulos que existan en el sprint actual y que correspondan al rol del usuario.
- Toda transición y cambio de estado visual **DEBE** ser suave ([sección 6.4](#64-movimiento-y-transiciones)). No se permiten cambios bruscos de color, tamaño, posición ni opacidad.
- Toda acción destructiva o de salida **DEBE** pedir confirmación ([sección 8.5](#85-confirmaciones-obligatorias)). Esto incluye cerrar sesión, cancelar una cita, eliminar o anular registros, y cerrar formularios con cambios sin guardar.

---

## 2. Referencia visual

La referencia es un dashboard de taller mecánico con:

- Sidebar oscuro con ítem activo resaltado, ícono + etiqueta, usuario y "Cerrar sesión" al fondo.
- Tarjetas de resumen arriba con un número grande y un indicador de cambio.
- Una gráfica principal clara (tipo dona) en lugar de muchas gráficas pequeñas.
- Mucho espacio en blanco y poca decoración.

**Diferencias obligatorias respecto a la referencia:**

- La paleta **no** es azul índigo; es el rojo grisáceo definido en la [sección 5](#5-paleta-de-color).
- El contenido es el de Motorix (órdenes, citas, mantenimientos, stock), no módulos de otro sistema.

---

## 3. Stack de diseño en Flutter

### Base obligatoria

- Flutter + Dart, estado con **Provider**.
- Material Design 3 (`useMaterial3: true`) con `ThemeData` propio.

### Librerías complementarias permitidas

Material 3 es la base. Además, la app puede usar librerías de apoyo para el diseño, siempre que no reemplacen el tema M3 y se justifique su uso.

| Necesidad | Opción sugerida | Nota |
|---|---|---|
| Tipografía | `google_fonts` | Para IBM Plex Sans |
| Gráficas (dona, barras) | `fl_chart` | Para el dashboard |
| Tablas avanzadas | `data_table_2` | Alternativa: `PaginatedDataTable` nativo |
| Íconos | Un único set consistente (p. ej. `phosphor_flutter` o `lucide_icons_flutter`) | No mezclar sets |
| Componentes de UI complementarios | `shadcn_ui` (puede convivir con widgets Material) | Opcional; decidir en equipo |

**Reglas:**

- Máximo **una** librería de componentes de UI complementaria, y solo si aporta algo que Material 3 no cubre bien.
- Si se agrega una librería de componentes, debe configurarse con la misma paleta y tipografía de este documento.
- Antes de agregarla, CLAUDE propone opciones (con ventajas y desventajas) y espera decisión del equipo.
- Verificar compatibilidad con la versión de Flutter del proyecto antes de instalar.

---

## 4. Tema de Material 3

El tema vive en `client/lib/utils/` (por ejemplo `app_theme.dart`) y es la **única fuente de estilos**.

```dart
final ColorScheme motorixScheme = ColorScheme.fromSeed(
  seedColor: const Color(0xFF9B4F55),
  brightness: Brightness.light,
).copyWith(
  primary: const Color(0xFF9B4F55),
  surface: const Color(0xFFFFFFFF),
  surfaceContainerLowest: const Color(0xFFF5F2F1),
  outlineVariant: const Color(0xFFDDD5D4),
  onSurface: const Color(0xFF231F20),
  error: const Color(0xFFC0392B),
);
```

Componentes que se configuran **en el tema** (no pantalla por pantalla):

- `NavigationRailThemeData` (sidebar)
- `DataTableThemeData`
- `ChipThemeData`
- `InputDecorationTheme`
- `FilledButtonThemeData`, `OutlinedButtonThemeData`, `TextButtonThemeData`
- `CardTheme` / `CardThemeData` (según la versión de Flutter)
- `DividerThemeData`
- `TooltipThemeData`
- `PageTransitionsTheme` (transiciones suaves entre pantallas, ver [6.4](#64-movimiento-y-transiciones))

---

## 5. Paleta de color

Color de marca: **rojo grisáceo (apagado)**. El rojo de alerta es distinto: más vivo, para que no se confunda con la marca.

| Token | Uso | Hex |
|---|---|---|
| `primary` | Marca, botones principales, ítem activo, enlaces | `#9B4F55` |
| `sidebar` | Fondo del sidebar | `#2B2325` |
| `sidebarActive` | Fondo del ítem activo del sidebar | `#43353A` |
| `background` | Fondo de la aplicación | `#F5F2F1` |
| `surface` | Paneles y formularios | `#FFFFFF` |
| `outline` | Bordes y divisores | `#DDD5D4` |
| `textPrimary` | Texto principal | `#231F20` |
| `textSecondary` | Texto secundario | `#6F6566` |
| `warning` | Advertencia / "próximo" | `#C9892B` |
| `success` | Éxito / "completado" | `#4F7A5A` |
| `danger` | Error / "vencido" / stock crítico | `#C0392B` |

> **Variantes alternativas del primario** (solo si el equipo decide cambiar): terracota apagada `#A0554A`, vino grisáceo `#7D4A53`.

### Reglas de uso del color

- El rojo grisáceo se usa en acciones principales, ítem activo y enlaces. **No en fondos grandes.**
- Los estados usan únicamente `warning`, `success` y `danger`.
- Colores planos. **Sin degradados.**
- Verificar contraste suficiente entre texto y fondo.

### Colores de estado de órdenes y citas

| Estado | Color |
|---|---|
| Pendiente / Recibido | Gris (`textSecondary`) |
| Diagnóstico / En proceso | `warning` |
| En reparación | `primary` |
| Esperando refacción | `warning` |
| Terminado / Completada / Entregado | `success` |
| Cancelada | `danger` |
| Mantenimiento próximo | `warning` |
| Mantenimiento vencido / Stock crítico | `danger` |

---

## 6. Tipografía, espacio, forma y movimiento

### 6.1 Tipografía

**Fuente:** IBM Plex Sans (vía `google_fonts`), con fuente de respaldo del sistema.

Escala fija de **4 tamaños**:

| Rol | Tamaño | Peso |
|---|---|---|
| Caption / etiquetas | 12 | Regular |
| Cuerpo | 14 | Regular / Medium |
| Título de sección | 18 | SemiBold |
| Indicador grande (KPI) / título de página | 28 | SemiBold |

### 6.2 Espaciado

Escala base de 4 px: **4, 8, 12, 16, 24, 32**. No usar otros valores.

### 6.3 Forma (bordes redondeados)

- Radio de botones e inputs: **6 px**.
- Radio de paneles: **8 px**.
- Radio de tarjetas, chips, avisos (snackbars, dialogs) y contenedores en general: **8 px**.
- Radio de barras de progreso y elementos tipo "pill": **12 px** o completamente redondeado.
- Nada de esquinas rectas salvo en separadores finos y líneas de tabla.
- Bordes finos (1 px) con `outline`. Sombras mínimas o ninguna.

### 6.4 Movimiento y transiciones

Toda transición **DEBE** ser suave. No se permiten cambios bruscos de color, tamaño, posición ni opacidad.

**Duraciones de referencia:**

| Tipo de cambio | Duración |
|---|---|
| Cambios de estado (hover, focus, selección) | 150 ms |
| Aparición o desaparición de elementos (snackbars, dialogs, tooltips) | 200 ms |
| Navegación entre pantallas | 250 ms |
| Cambio de ancho del sidebar (expandido/colapsado) | 200 ms |

**Reglas:**

- **Curva estándar:** `Curves.easeInOut` o `Curves.easeOutCubic`. No usar rebotes ni curvas exageradas.
- **Transiciones entre pantallas:** usar `PageTransitionsTheme` con una transición discreta (fade + slide leve). Nada de zooms, giros ni efectos vistosos.
- Los elementos interactivos (botones, ítems de menú, filas) **DEBEN** reaccionar visualmente a hover y focus con un cambio suave de color de fondo (por ejemplo, usando `InkWell`, `MouseRegion` o `AnimatedContainer`).
- Los indicadores numéricos del dashboard (KPI) pueden animar la aparición del número (contador) si el equipo lo decide; si se anima, debe ser discreto y durar **máximo 400 ms**.
- **No animar por animar:** cada transición debe tener una función (indicar cambio de estado, guiar la atención, dar retroalimentación).

---

## 7. Layout y navegación

### Estructura general

```text
┌──────────┬───────────────────────────────────────────┐
│          │ Header: título de sección · buscador ·    │
│ Sidebar  │ notificaciones · usuario · rol            │
│          ├───────────────────────────────────────────┤
│          │                                           │
│          │ Contenido                                 │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

### Sidebar colapsable

- Botón en la parte superior para expandir / contraer.
- **Expandido:** ~260 px, ícono + etiqueta.
- **Colapsado:** ~72 px, solo íconos con `Tooltip` al pasar el cursor.
- Si el ancho de la ventana es menor a ~1000 px, arranca colapsado.
- El estado (expandido/colapsado) se guarda en un `Provider` y se conserva al navegar.
- Animar el cambio de ancho (~200 ms).
- **Implementación base:** `NavigationRail` con la propiedad `extended`, `leading` para el botón y `trailing` para "Cerrar sesión".
- Fondo `sidebar`, ítem activo con `sidebarActive`, texto e íconos claros.
- Usuario actual y "Cerrar sesión" al fondo.

### Elementos del menú

```text
Dashboard
Clientes
Vehículos
Citas
Órdenes de servicio
Mantenimientos
Inventario
Pagos
Tickets
Usuarios
Configuración
Cerrar sesión
```

**Reglas:**

- Mostrar solo los módulos implementados en el sprint actual.
- Mostrar solo los módulos permitidos para el rol del usuario.
- Ocultar un botón **no es seguridad**: los permisos se validan también en backend.

### Header

Nombre de sección, buscador cuando sea útil, notificaciones, usuario actual y rol.

---

## 8. Componentes y patrones

### 8.1 Dashboard

- Fila de indicadores arriba (**máximo 4**): órdenes en reparación, citas de hoy, mantenimientos vencidos, refacciones con stock bajo. Número grande y, si aplica, indicador de cambio.
- Al menos una gráfica principal (por ejemplo, dona de órdenes por estado). Puede acompañarse de una o dos gráficas secundarias sencillas (por ejemplo, barras de servicios por mes, línea de ingresos), siempre que aporten información real.
- Una lista o tabla de actividad reciente (últimas órdenes, últimas citas).
- Los datos vienen de los módulos reales; no duplicar información solo para estadísticas.
- Las gráficas **DEBEN** usar la paleta de la [sección 5](#5-paleta-de-color) y animarse suavemente al aparecer ([sección 6.4](#64-movimiento-y-transiciones)).

### 8.2 Tablas (clientes, vehículos, órdenes, inventario, pagos)

- Tabla densa con filtros y búsqueda arriba.
- Estado como chip de color discreto.
- Columna de acciones al final.
- Stock por debajo del mínimo se marca en `danger`.
- Paginación cuando haya volumen.
- Hover de fila con un cambio de fondo suave ([sección 6.4](#64-movimiento-y-transiciones)).

### 8.3 Formularios

- Etiquetas claras, validación visible, mensajes de error en español.
- Botón principal a la derecha, secundario a su izquierda.
- Confirmación antes de operaciones destructivas.

### 8.4 Estados de la interfaz

| Estado | Comportamiento |
|---|---|
| Vacío | Mensaje útil y acción sugerida, sin ilustraciones genéricas. |
| Cargando | Indicador de progreso discreto. |
| Error | Mensaje claro en español, sin trazas internas. |
| Éxito | Confirmación breve (snackbar). |

### 8.5 Confirmaciones obligatorias

Antes de ejecutar cualquiera de las siguientes acciones, el sistema **DEBE** mostrar un diálogo de confirmación (con las palabras **"Confirmar"** y **"Cancelar"**) y esperar la decisión del usuario:

- Cerrar sesión.
- Cancelar una cita.
- Cancelar, anular o marcar como entregada una orden de servicio.
- Eliminar o desactivar cualquier registro (clientes, vehículos, usuarios, refacciones).
- Registrar un pago de forma definitiva.
- Salir de un formulario con cambios sin guardar (por ejemplo, al pulsar "atrás" o cerrar la ventana).
- Cualquier otra operación que el equipo considere destructiva o irreversible.

El diálogo debe ser breve, claro y en español. Texto sugerido:

> "¿Seguro que quieres [acción]? Esta acción no se puede deshacer." *(cuando aplique)*

### 8.6 Tarjetas

Usar `Card` solo para agrupar contenido que lo necesite (indicadores del dashboard, resúmenes). **Por defecto, no usar tarjetas:** preferir tablas, listas y divisores.

---

## 9. Qué evitar (señales de "hecho por IA")

- Degradados morados, azul-morado o cian sobre fondo oscuro.
- Glassmorphism, brillos neón y texto con degradado.
- Todo dentro de tarjetas y tarjetas dentro de tarjetas.
- Filas de tarjetas idénticas con ícono + título + texto repetidas.
- Esquinas muy redondeadas y sombras difusas grandes.
- Emojis como íconos.
- Mezclar varios sets de íconos o usar íconos decorativos sin función.
- Más de 4 tamaños de letra o más de un color de acento.
- Gráficas diminutas que no aportan información.
- Textos genéricos de marketing ("potencia", "optimiza", "soluciones inteligentes").
- Fuente por defecto sin decisión explícita.
- Animaciones vistosas, rebotes o efectos que distraigan del contenido.
- Cambios de estado bruscos (sin transición) en botones, filas o menús.

---

## 10. Accesibilidad y escritorio

- Contraste adecuado entre texto y fondo.
- Áreas de clic suficientes y foco visible con teclado.
- `Tooltip` en botones que solo tienen ícono.
- Scrollbars visibles y texto seleccionable donde tenga sentido.
- Atajos y menús contextuales solo si aportan valor real.
- Las animaciones y transiciones **DEBEN** respetar la preferencia del sistema de reducir movimiento cuando sea posible.

---

## 11. Criterios de "terminado" para UI

Una pantalla se considera terminada cuando:

- [ ] Usa únicamente tokens de este documento.
- [ ] Respeta la lista de "qué evitar".
- [ ] Funciona con el sidebar expandido y colapsado.
- [ ] Muestra estados vacío, cargando y error.
- [ ] Tiene transiciones suaves en cambios de estado, navegación y aparición de elementos.
- [ ] Pide confirmación en todas las acciones listadas en [8.5](#85-confirmaciones-obligatorias).
- [ ] Es consistente con el resto de la aplicación.
- [ ] Se verificó visualmente en escritorio y en una ventana angosta.

---

## 12. Decisiones pendientes

- [x] Librería complementaria de componentes: ninguna (decidido el 2026-10-19 en `/speckit-clarify`).
- [x] Set de íconos definitivo: `lucide_icons_flutter` (decidido el 2026-10-19).
- [ ] Si habrá modo oscuro después del MVP (por ahora, solo tema claro).
- [ ] Logotipo e identidad de Motorix.
- [ ] Tipos exactos de gráficas del dashboard (dona, barras, línea) y qué indicadores se muestran en cada sprint.
- [ ] Si los indicadores numéricos del dashboard animan el contador al aparecer.

> CLAUDE puede proponer opciones para estas decisiones, pero **no debe asumir una solución irreversible**.