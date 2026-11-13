// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN — Javier Otaya · Agente inmobiliario, Sur de Cali
// Este es el único archivo que se edita para ajustar el sitio.
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  // ID de la hoja ESPEJO PÚBLICA (la que crea el backend), NO el de la Maestra.
  // Sale en el correo de salud y al ejecutar LC_diagnostico en Apps Script
  // (línea "SPREADSHEET_ID para js/config.js del sitio").
  SPREADSHEET_ID: "1IbX4KKEeC2JarWSZxoZKyr9V1p9qSQfLJE0qU2bPF04",

  // API key de Google Cloud (Sheets API habilitada, restringida al dominio del sitio).
  API_KEY: "AIzaSyD9dcqg2slJPnkawSjLnLpEVdhVvmmUGrA",

  // Pestaña del espejo que se lee. El backend la deja siempre como la primera.
  RANGE: "Portafolio",

  // Cada cuánto se refresca el inventario con la página abierta (milisegundos).
  // 120000 = 2 minutos. Subirlo reduce el consumo de la cuota de la API de Sheets.
  REFRESH_INTERVAL_MS: 120000,

  // Meta Pixel. Vacío = el sitio funciona igual, sin tracking.
  META_PIXEL_ID: "4002181883395918",

  // WhatsApp de la inmobiliaria: código de país + número, sin "+" ni espacios.
  WHATSAPP_NUMBER: "573164854961",
  WHATSAPP_MESSAGE: "Hola, quiero más información sobre los inmuebles disponibles.",

  // URL del despliegue (Web App) de Apps Script de la cuenta de Javier. Recibe los leads. Termina en /exec.
  LEADS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyWf5HNp4cee-XmMLamTEo-PvV1h_fYTew3XVLvx748vNiGDT9Lf4ANH1nDrMlDX-cj/exec",

  // Dirección pública del sitio, con "/" al final. Debe ser igual a catalogoUrl en config.gs.
  BASE_URL: "https://otayajavier.miraleads.pro/",

  // Marca
  MARCA_NOMBRE: "Javier Otaya",
  MARCA_FRASE: "Agente inmobiliario · Sur de Cali",
  LOGO_URL: "",          // ej. "img/logo.png" (ruta relativa a la raíz del sitio)
  FOTO_AGENTE_URL: "img/javier.jpg",   // ruta relativa a la raíz del sitio

  // Datos del asesor para portada y ficha (déjalos vacíos para ocultarlos).
  AGENTE_CARGO: "Asesor inmobiliario",
  AGENTE_ANIOS: 3,
  AGENTE_COLEGAS: 300,
  AGENTE_TRANSACCIONES: 30,
  AGENTE_ANIO_REFERENCIA: 2026,
  // Zonas de la portada ("Explora por zona"): se buscan en el catálogo.
  ZONAS_DESTACADAS: ["Valle del Lili", "Bochalema", "Ciudad Meléndez"],

  // Colores (opcionales). Vacío = los colores originales del catálogo.
  COLOR_PRIMARIO: "",
  COLOR_PRIMARIO_OSCURO: "",
};
