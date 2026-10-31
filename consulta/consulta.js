function formatCOPShort(value) {
  if (!value) return "$0";
  return "$" + Number(value).toLocaleString("es-CO") + "M";
}

function trackPixelLead(params) {
  if (typeof fbq !== "function") return;
  const eventId =
    window.crypto && crypto.randomUUID ? crypto.randomUUID() : "ev-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  fbq("track", "Lead", params, { eventID: eventId });
  return eventId;
}

// ─────────────────────────────────────────────────────────────
// Datos para que Meta reconozca a la persona cuando el lead se califique
// (se guardan en la hoja Leads; el aviso a Meta sale desde Apps Script).
// ─────────────────────────────────────────────────────────────
function leerCookie(nombre) {
  const m = document.cookie.match(new RegExp("(?:^|; )" + nombre + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

function guardarClicAnuncio() {
  try {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    if (fbclid) localStorage.setItem("fbclid_info", JSON.stringify({ id: fbclid, ts: Date.now() }));
  } catch (e) { /* sin almacenamiento: no pasa nada */ }
}

function datosParaMeta() {
  let fbc = leerCookie("_fbc");
  if (!fbc) {
    try {
      const info = JSON.parse(localStorage.getItem("fbclid_info") || "null");
      if (info && info.id && Date.now() - info.ts < 90 * 24 * 3600 * 1000) fbc = `fb.1.${info.ts}.${info.id}`;
    } catch (e) { /* ignorar */ }
  }
  return {
    fbc,
    fbp: leerCookie("_fbp"),
    pagina: window.location.href.slice(0, 500),
    navegador: navigator.userAgent,
  };
}

function initMetaPixelIfConfigured() {
  if (!CONFIG.META_PIXEL_ID || CONFIG.META_PIXEL_ID === "PEGA_AQUI_TU_PIXEL_ID") return;
  /* eslint-disable */
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  fbq('init', CONFIG.META_PIXEL_ID);
  fbq('track', 'PageView');
}

function enviarASheet(data) {
  enviarLeadBackend(data); // ../js/lead-api.js
}

function buildWhatsappMessage(data) {
  return `Hola, soy ${data.nombre}. Busco un inmueble con presupuesto entre ${formatCOPShort(data.presupuestoMin)} y ${formatCOPShort(data.presupuestoMax)}${data.zona ? `, en la zona de ${data.zona}` : ""}.`;
}

function buildCatalogUrl(data) {
  const p = new URLSearchParams();
  if (data.presupuestoMin) p.set("precioMin", data.presupuestoMin);
  if (data.presupuestoMax) p.set("precioMax", data.presupuestoMax);
  const q = p.toString();
  return "../" + (q ? "?" + q : "");
}

function wireForm() {
  document.getElementById("lead-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const data = {
      origen: "Consulta",
      nombre: document.getElementById("f-nombre").value.trim(),
      whatsapp: document.getElementById("f-whatsapp").value.trim(),
      presupuestoMin: document.getElementById("f-presupuesto-min").value,
      presupuestoMax: document.getElementById("f-presupuesto-max").value,
      zona: document.getElementById("f-zona").value.trim(),
    };

    document.getElementById("lead-submit").disabled = true;
    document.getElementById("lead-form").hidden = true;
    document.getElementById("lead-thanks").hidden = false;

    data.eventId = trackPixelLead({
      content_name: data.zona || "Sin zona especificada",
      value: (Number(data.presupuestoMin) + Number(data.presupuestoMax)) / 2 * 1e6 || undefined,
      currency: "COP",
    });

    enviarASheet(data);

    if (CONFIG.WHATSAPP_NUMBER && CONFIG.WHATSAPP_NUMBER !== "PEGA_AQUI_TU_NUMERO") {
      const waUrl = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsappMessage(data))}`;
      window.open(waUrl, "_blank", "noopener");
    }

    // Pequeño margen para que el evento del Pixel alcance a salir antes de
    // navegar (mismo motivo que con el botón de WhatsApp del catálogo).
    setTimeout(() => {
      window.location.href = buildCatalogUrl(data);
    }, 300);
  });
}

guardarClicAnuncio();
initMetaPixelIfConfigured();
wireForm();
