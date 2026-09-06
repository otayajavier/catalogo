// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN — edita solo esta sección
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  // Tomado de tu URL: docs.google.com/spreadsheets/d/ESTE_ID/edit
  SPREADSHEET_ID: "180UEG3GExXiWr5VwaTQ7zMsPZuihOujym73dEijeyI4",

  // Tu API key de Google Cloud (Sheets API habilitada, restringida por dominio).
  API_KEY: "PEGA_AQUI_TU_API_KEY",

  // Rango a leer. Si tu hoja tiene más de 500 filas, sube el número.
  // No hace falta poner el nombre de la pestaña: por defecto lee la primera.
  RANGE: "A1:U500",

  // Cada cuánto se refresca solo (en milisegundos). 60000 = 1 minuto.
  REFRESH_INTERVAL_MS: 60000,
};
