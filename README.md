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

## Notas

- El catálogo es público a propósito (según lo que confirmaste): cualquiera
  con el link puede verlo, igual que con spread.name.
- Si un inmueble no tiene link en "Link Ficha Técnica", su imagen deja de
  ser clicable (no se rompe, simplemente no navega a ningún lado).
- Si algún inmueble no tiene imagen en "Imagen Previa", se muestra un
  marcador de "Sin imagen disponible" en vez de un ícono roto.
