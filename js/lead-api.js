// ─────────────────────────────────────────────────────────────
// Envío de leads al backend (Apps Script de la cuenta del cliente).
// Lo usan la ficha de inmueble (app.js) y el formulario de /consulta.
// Depende de datosParaMeta(), definida en app.js y consulta.js: aporta
// fbc, fbp, página y navegador para que Meta reconozca a la persona.
// ─────────────────────────────────────────────────────────────
function enviarLeadBackend(datos) {
  const url = CONFIG.LEADS_WEBAPP_URL;
  if (!url || /^PENDIENTE/.test(url)) return;

  const d = datos || {};
  let presupuesto = d.presupuesto || "";
  if (!presupuesto && (d.presupuestoMin || d.presupuestoMax)) {
    presupuesto = `$${d.presupuestoMin || 0}M – $${d.presupuestoMax || "?"}M`;
  }

  const payload = Object.assign(
    {
      accion: "guardarLead",
      origen: d.origen || "catalogo",
      nombre: d.nombre,
      whatsapp: d.whatsapp,
      inmueble: d.inmueble || "",
      linkInmueble: d.inmuebleUrl || d.linkInmueble || "",
      credito: d.estadoCredito || d.credito || "",
      presupuesto,
      zona: d.zona || "",
      eventId: d.eventId || "",
    },
    typeof datosParaMeta === "function" ? datosParaMeta() : {}
  );

  // "no-cors": no hace falta leer la respuesta, solo que quede guardado.
  // "keepalive": el envío termina aunque enseguida se abra WhatsApp.
  fetch(url, {
    method: "POST",
    mode: "no-cors",
    keepalive: true,
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload),
  }).catch(() => {}); // si falla, no se bloquea la experiencia de quien consulta
}
