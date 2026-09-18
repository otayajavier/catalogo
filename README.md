# Catálogo de inmuebles — vitrina pública para clientes

Sitio estático que reemplaza el enlace de spread.name: muestra tu inventario
completo (sin límite de 50 ítems) en una cuadrícula de tarjetas, con imagen,
precio, ubicación y specs — cada tarjeta enlaza a la ficha técnica real del
inmueble (CRMred, Wasi, Domus o la que corresponda), tomada directamente de
la columna **Link Ficha Técnica** de tu Google Sheet.

Se actualiza solo cada minuto, así que refleja los cambios que hagas en la
hoja casi en tiempo real.

## Qué datos se muestran y cuáles no

Se muestran (información de venta/arriendo, útil para el cliente):

- Tipo, Barrio/Zona, Precio, Canon de arriendo, Área, Habitaciones, Baños,
  Parqueadero, Piso, Estrato, Estado, Servicio (Venta/Arriendo), Aplica crédito.

**Nunca se leen ni se muestran** (son de control interno):

- Origen, Proyecto/Nombre, Comisión, Observaciones, encargado, celular.

La columna **Imagen Previa** se usa solo como la foto de la tarjeta (no se
imprime el link como texto en ningún lado del sitio).

Solo se listan inmuebles cuya columna "Estado" contenga la palabra
"Disponible" — si marcas uno como vendido/arrendado, desaparece solo del
catálogo en el siguiente refresco.

## Configuración

Reutiliza la misma API key y el mismo Sheet ID que ya configuraste en el
proyecto anterior (el dashboard interno). Solo edita `js/config.js`:

```js
API_KEY: "PEGA_AQUI_TU_API_KEY",
```

Si esa API key ya está restringida al dominio de GitHub Pages donde vas a
publicar este sitio, no necesitas hacer nada más en Google Cloud. Si vas a
usar un repositorio o dominio distinto al anterior, agrega esa nueva URL a
las restricciones de la clave (Google Cloud → Credenciales → tu clave →
Restricciones del sitio web).

## Reemplazar el sitio anterior

Como decidiste reemplazar el dashboard interno por este catálogo:

1. Si quieres mantener la misma URL (`otayajavier.github.io/inventario-claudia/`),
   simplemente sobrescribe los archivos del repo existente con los de esta
   carpeta y haz push:
   ```bash
   git add .
   git commit -m "Reemplazar dashboard interno por catálogo público"
   git push
   ```
2. Si prefieres una URL distinta, crea un repositorio nuevo en GitHub, sube
   estos archivos, y activa GitHub Pages igual que la vez anterior
   (Settings → Pages → Deploy from a branch → main → / root).

## Probar en tu computador

```bash
cd catalogo-inmuebles
python3 -m http.server 8080
```

Abre `http://localhost:8080`.

## Estructura

```
catalogo-inmuebles/
├── index.html
├── css/style.css
├── js/config.js    ← tu API key
├── js/app.js
└── README.md
```

## Orden y filtros compartibles

- Por defecto, cada vez que alguien abre la página el inventario aparece en
  **orden aleatorio** (así el cliente necesita usar los filtros, no solo
  hacer scroll). El orden se mantiene estable mientras la página sigue
  abierta, incluso con los refrescos automáticos.
- El selector "Ordenar por" permite cambiar a precio ascendente o
  descendente en cualquier momento.
- Cada filtro que uses (tipo, barrio, venta/arriendo, precio mínimo/máximo
  en millones, piso mínimo/máximo, orden) se refleja en la URL. Por ejemplo:
  ```
  .../?tipo=Apartamento&precioMin=200&precioMax=240&pisoMin=1&pisoMax=4
  ```
  Puedes armar el filtro que necesites y usar el botón **"Copiar enlace"**
  para mandárselo tal cual a un cliente — al abrirlo, verá exactamente esa
  combinación ya aplicada.
- **"Resetear filtros"** limpia todo y vuelve a mostrar el inventario
  completo (en un nuevo orden aleatorio la próxima vez que se recargue).

## Filtros plegables

En móvil, los filtros están ocultos por defecto detrás de un botón
**"Filtros"** (con un contador de cuántos filtros tienes activos), para no
tapar las tarjetas de inmuebles. En pantallas grandes (computador) se ven
siempre expandidos en una sola fila, como antes.

## Meta Pixel y WhatsApp

- Para activar el Pixel de Meta, pega tu ID en `js/config.js` →
  `META_PIXEL_ID`. Se trackean automáticamente:
  - `PageView` al cargar el sitio.
  - `ViewContent` cuando alguien hace clic en la imagen o en "Ver ficha
    completa" de un inmueble (incluye tipo, barrio y precio).
  - `Contact` cuando alguien escribe por WhatsApp (botón flotante o el de
    cada tarjeta).
- Para el botón de WhatsApp, pega tu número central (con código de país,
  sin "+" ni espacios) en `WHATSAPP_NUMBER`. Aparece un botón flotante
  general y uno por cada tarjeta con el mensaje ya armado mencionando ese
  inmueble específico.
- Ambos son opcionales: si dejas los campos en blanco (o con el texto de
  ejemplo), el sitio funciona igual sin ellos.

## Ficha de detalle (nueva)

Al hacer clic en la imagen o en "Ver ficha completa" de una tarjeta, ya no
se sale directo al CRM externo — se abre una ficha de detalle dentro del
mismo sitio, con:

- Carrusel de fotos (foto principal + las de "Más Fotos").
- Precio, barrio, área, habitaciones, baños, piso/niveles, parqueadero y si
  aplica crédito, con íconos.
- Botón de WhatsApp (rastreado por el Pixel igual que en la tarjeta).
- El link al CRM externo (Wasi, CRMred, Domus, etc.) queda como el último
  botón, más discreto — solo para el cliente que ya quiere el detalle
  técnico completo.
- 2 inmuebles similares (mismo tipo, precio parecido) al final, para que el
  cliente siga explorando sin salir del sitio.

Cada ficha tiene su propia URL (`...?ver=apartamento-barrio-precio`), así
que también se puede compartir un inmueble puntual — aunque la vista previa
al compartirlo en redes seguirá siendo la genérica del sitio, no la foto de
ese inmueble (limitación de no tener páginas individuales de verdad).

### Nueva columna en tu Sheet: "Más Fotos"

Agrega una columna con ese encabezado. En cada fila, pega ahí las fotos
adicionales (aparte de "Imagen Previa") separadas por coma, por ejemplo:

```
https://link-foto-2.jpg, https://link-foto-3.jpg, https://link-foto-4.jpg
```

Si la dejas vacía, la ficha de detalle simplemente muestra solo la foto de
"Imagen Previa" (sin carrusel).

## Mapa del sitio

```
otayajavier.github.io/catalogo/              → Inventario (sin cambios de URL)
otayajavier.github.io/catalogo/consulta/     → Formulario de calificación (sin cambios de URL)
otayajavier.github.io/catalogo/inicio/       → Página de presentación ("quién soy" + servicios)
otayajavier.github.io/catalogo/solicitudes/  → Tablero de solicitudes de compradores
```

Las cuatro páginas comparten un menú (☰, arriba a la izquierda) via `js/nav.js`.

## Tablero de solicitudes

Lee directamente tu pestaña **"Requerimientos"** (la que ya usabas antes),
con estas columnas: `Tipo | Barrios | Zona | Presup | Forma de Pago | Entidad
| Observaciones | último contacto | Cliente | Teléfono`.

- **Cliente y Teléfono nunca se leen ni se muestran** en la página — es
  intencional: así ningún colega puede saltarte y contactar al cliente
  directo. Cada tarjeta trae un botón **"Tengo un inmueble para esto"** que
  le escribe a TU WhatsApp, no al del cliente.
- El botón **"Copiar para WhatsApp"** sigue disponible para cuando tú
  quieras difundir la solicitud en un grupo, con el mismo formato que ya
  usas.
- Si en algún momento agregas una columna "Estado" y pones "Cerrada" en una
  fila, esa solicitud deja de mostrarse (sin necesidad de borrar la fila).
  Mientras no exista esa columna, se muestran todas las filas con datos.
- (La pestaña "Solicitudes" que se mencionaba en una versión anterior de
  este README ya no se usa — puedes borrarla si la llegaste a crear.)

## Notas

- El catálogo es público a propósito (según lo que confirmaste): cualquiera
  con el link puede verlo, igual que con spread.name.
- Si un inmueble no tiene link en "Link Ficha Técnica", su imagen deja de
  ser clicable (no se rompe, simplemente no navega a ningún lado).
- Si algún inmueble no tiene imagen en "Imagen Previa", se muestra un
  marcador de "Sin imagen disponible" en vez de un ícono roto.
