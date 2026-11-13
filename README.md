# Catálogo — Javier Otaya · Agente inmobiliario, Sur de Cali

Sitio estático (HTML/CSS/JS) para GitHub Pages. Muestra el inventario, la
calculadora de crédito, el tablero de solicitudes y el formulario
"¿Buscas algo específico?". Los leads van al backend de Apps Script de la
cuenta de Javier.

```
Visitante ──► Sitio (GitHub Pages) ──lee──► Hoja ESPEJO pública (Google Sheets API)
                   │
                   └──envía leads──► Web App de Apps Script
                                         ├─► hoja MAESTRA privada (Leads, Portafolio)
                                         └─► Meta (Conversions API, plan Full Ads)
```

El sitio **nunca** lee la hoja Maestra: solo el espejo, que no trae teléfonos,
comisiones ni notas privadas. El panel de administración vive en
`panel.miraleads.pro`, no en este repo.

## Archivos

| Ruta | Para qué |
|---|---|
| `js/config.js` | **Único archivo que se edita.** IDs, API key, WhatsApp, marca, colores. |
| `index.html` + `js/app.js` | Inventario (tarjetas, filtros, ficha emergente). |
| `js/lead-api.js` | Envío de leads al Web App (acción `guardarLead`, con el `eventId` del Pixel). |
| `js/nav.js` | Menú; calcula las rutas solo, funciona en una subcarpeta o en un dominio propio. |
| `ficha/` | Ficha técnica neutra para colegas. |
| `inicio/`, `solicitudes/`, `credito/`, `consulta/` | Páginas del sitio. |

## Configuración (`js/config.js`)

| Campo | Qué poner |
|---|---|
| `SPREADSHEET_ID` | ID del **espejo** (sale en `LC_diagnostico`). NO el de la Maestra. |
| `API_KEY` | API key de Google Cloud (Sheets API, restringida al dominio del sitio). |
| `LEADS_WEBAPP_URL` | URL del Web App (termina en `/exec`). |
| `BASE_URL` | Dirección pública del sitio, con `/` al final. Igual a `catalogoUrl` en `config.gs`. |
| `WHATSAPP_NUMBER` | Código de país + número, sin `+`. |
| `META_PIXEL_ID` | Vacío = sin Pixel. |
| `MARCA_*`, `LOGO_URL`, `COLOR_*` | Marca y colores (vacío = colores originales). |

## Probar en el computador

```bash
python3 -m http.server 8080
```

Abre `http://localhost:8080`.

## Qué se publica del inventario

Solo inmuebles con Estado "Disponible". Las observaciones públicas se limpian
de teléfonos y correos al copiarlas al espejo.
