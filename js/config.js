// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN — edita solo esta sección
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  // Tomado de tu URL: docs.google.com/spreadsheets/d/ESTE_ID/edit
  SPREADSHEET_ID: "180UEG3GExXiWr5VwaTQ7zMsPZuihOujym73dEijeyI4",

  // Tu API key de Google Cloud (Sheets API habilitada, restringida por dominio).
  API_KEY: "AIzaSyD9dcqg2slJPnkawSjLnLpEVdhVvmmUGrA",

  // Rango a leer. Si tu hoja tiene más de 500 filas, sube el número.
  // No hace falta poner el nombre de la pestaña: por defecto lee la primera.
  RANGE: "A1:U500",

  // Cada cuánto se refresca solo (en milisegundos). 60000 = 1 minuto.
  REFRESH_INTERVAL_MS: 60000,

    // Meta Pixel (opcional). Si lo dejas vacío, el sitio funciona igual sin
  // tracking. Lo encuentras en Meta Events Manager → tu pixel → ID.
  META_PIXEL_ID: "4002181883395918",

  // Número de WhatsApp CENTRAL de la inmobiliaria (no el celular de un
  // agente en particular). Formato: código de país + número, sin "+",
  // espacios ni guiones. Ejemplo Colombia: "573001234567".
  WHATSAPP_NUMBER: "573164854961",

  // Mensaje genérico para el botón flotante de WhatsApp (el de cada
  // tarjeta arma su propio mensaje mencionando ese inmueble).
  WHATSAPP_MESSAGE: "Hola, quiero más información sobre los inmuebles disponibles.",
};
