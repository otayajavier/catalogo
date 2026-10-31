// ─────────────────────────────────────────────────────────────
// Meta Pixel (opcional — no rompe nada si no está configurado)
// ─────────────────────────────────────────────────────────────
function initMetaPixel() {
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

// Devuelve el ID del evento, para guardarlo junto con el lead en la hoja.
// Así, cuando el lead se califica, el aviso que sale desde la hoja se puede
// relacionar con este mismo Lead.
function trackPixel(event, params) {
  const eventId = generateEventId();
  if (typeof fbq === "function") fbq("track", event, params || {}, { eventID: eventId });
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

// Si la visita llegó desde un anuncio, la URL trae "fbclid". Se guarda por si
// el navegador no deja crear la cookie _fbc (o la persona navega a otra página).
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

// ID único por evento — necesario para que Meta pueda "deduplicar" cuando
// el mismo evento le llega tanto desde el navegador (este código) como
// desde su sistema de API de Conversiones del lado del servidor (que Meta
// activa automáticamente para muchas cuentas). Sin este ID compartido,
// Meta cuenta el mismo evento dos veces.
function generateEventId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "ev-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

// ─────────────────────────────────────────────────────────────
// WhatsApp
// ─────────────────────────────────────────────────────────────
function whatsappConfigured() {
  return CONFIG.WHATSAPP_NUMBER && CONFIG.WHATSAPP_NUMBER !== "PEGA_AQUI_TU_NUMERO";
}

function whatsappLink(message) {
  return `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function setupWhatsappFloat() {
  const el = document.getElementById("whatsapp-float");
  if (!whatsappConfigured()) return;
  const href = whatsappLink(CONFIG.WHATSAPP_MESSAGE);
  el.href = href;
  el.hidden = false;
  el.addEventListener("click", (e) => fireContactAndGo(e, href, { content_name: "boton_flotante" }));
}

// Al abrir WhatsApp el celular cambia de aplicación casi de inmediato, y eso
// puede cancelar la petición del Pixel antes de que salga. Por eso se
// intercepta el clic, se dispara el evento, y se espera una fracción de
// segundo antes de navegar — así el evento sí alcanza a enviarse.
function fireContactAndGo(e, href, params) {
  e.preventDefault();
  trackPixel("Contact", params);
  setTimeout(() => { window.location.href = href; }, 300);
}

// ─────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────
function normalizeHeader(h) {
  return (h || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function findCol(headers, ...keywords) {
  return headers.findIndex((h) => keywords.some((k) => h.includes(k)));
}

function parseCOP(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^\d]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

function formatCOP(value) {
  if (!value) return "Consultar precio";
  return "$" + Math.round(value).toLocaleString("es-CO");
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}

// Imagen de respaldo si la columna "Imagen Previa" viene vacía
const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#ddd7c6"/><text x="50%" y="50%" font-family="sans-serif" font-size="16" fill="#6d6759" text-anchor="middle" dy=".3em">Sin imagen disponible</text></svg>`
  );

// ID estable por inmueble, usado para la URL de la ficha de detalle
// (?ver=...) y reutilizable más adelante como el "id" del catálogo de
// Meta. Se arma con tipo+barrio+precio (legible) más un hash corto del
// link de la ficha externa (o, si no hay link, de otros datos del
// inmueble) — así dos inmuebles que coincidan en tipo/barrio/precio/piso
// (ej. Alheli y Tamarindo) no terminan compartiendo el mismo ID.
function slugify(str) {
  return String(str || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}
function shortHash(str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
function makeCatalogId(rawTipo, rawBarrio, rawPrecio, uniqueSeed) {
  return `${slugify(`${rawTipo}-${rawBarrio}-${rawPrecio}`)}-${shortHash(uniqueSeed)}`;
}
// Con el ID del Portafolio (P0001…) el enlace queda "tipo-barrio-P0001", igual
// que los links del feed de Meta (?ver=...). El ID no cambia aunque se edite
// el precio, el barrio o el tipo.
function slugLimpio(str) {
  return slugify(str).replace(/^-+|-+$/g, "");
}
function makeCatalogIdFromId(rawTipo, rawBarrio, id) {
  return [slugLimpio(rawTipo), slugLimpio(rawBarrio), id].filter(Boolean).join("-").replace(/-+/g, "-");
}

// ─────────────────────────────────────────────────────────────
// Carga de datos desde Google Sheets API
// ─────────────────────────────────────────────────────────────
async function fetchSheetData() {
  if (!CONFIG.API_KEY || /^PENDIENTE|^PEGA_AQUI/.test(CONFIG.API_KEY) || !CONFIG.SPREADSHEET_ID || /^PENDIENTE/.test(CONFIG.SPREADSHEET_ID)) {
    document.getElementById("loading-state").textContent =
      "Falta configurar SPREADSHEET_ID y API_KEY en js/config.js (ver INSTALAR-CLIENTE-NUEVO.md).";
    return null;
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.RANGE)}?key=${CONFIG.API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Error HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.values || [];
}

// Solo se extraen los campos que la vitrina pública puede mostrar o necesita
// para funcionar (link e imagen). Origen, Proyecto/Nombre, Comisión,
// Observaciones, encargado y celular nunca se leen hacia el objeto público.
function rowsToPublicListings(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(normalizeHeader);

  // Encabezados del espejo público (los pone el backend desde la hoja Maestra).
  const col = {
    id: headers.findIndex((h) => h === "id"),
    tipo: findCol(headers, "tipo"),
    barrio: findCol(headers, "barrio", "zona"),
    precio: headers.findIndex((h) => h.includes("precio") && !h.includes("arriendo")),
    canon: findCol(headers, "canon", "arriendo"),
    area: findCol(headers, "area"),
    habitaciones: findCol(headers, "habitacion"),
    banos: findCol(headers, "bano"),
    parqueadero: findCol(headers, "parqueadero"),
    piso: findCol(headers, "piso"),
    estrato: findCol(headers, "estrato"),
    estado: findCol(headers, "estado"),
    servicio: findCol(headers, "servicio"),
    credito: findCol(headers, "credito"),
    linkFicha: findCol(headers, "link", "ficha"),
    imagen: findCol(headers, "imagen"), // columna antigua; el espejo nuevo solo trae "Fotos"
    fotos: findCol(headers, "fotos", "foto"),
    fechaVenta: findCol(headers, "fecha"),
    observaciones: findCol(headers, "observacion"),
  };
  const celda = (row, i) => (i > -1 ? String(row[i] || "").trim() : "");

  const allRows = values
    .slice(1)
    .filter((row) => row.some((cell) => cell && cell.trim && cell.trim() !== ""))
    .map((row) => {
      // "Fotos" trae todas las URLs separadas por salto de línea (o coma);
      // la primera es la imagen principal de la tarjeta.
      const fotosCelda = celda(row, col.fotos).split(/[\s,]+/).map((u) => u.trim()).filter(Boolean);
      const photos = [celda(row, col.imagen), ...fotosCelda].filter((v, i, arr) => v && arr.indexOf(v) === i);
      const id = celda(row, col.id);
      const tipo = celda(row, col.tipo) || "Inmueble";
      const barrio = celda(row, col.barrio) || "Cali";

      return {
        id,
        catalogId: id
          ? makeCatalogIdFromId(tipo, barrio, id)
          : makeCatalogId(tipo, barrio, row[col.precio], row[col.linkFicha]),
        tipo,
        barrio,
        precio: parseCOP(row[col.precio]),
        canon: parseCOP(row[col.canon]),
        area: parseFloat(row[col.area]) || 0,
        habitaciones: parseInt(row[col.habitaciones], 10) || 0,
        banos: parseInt(row[col.banos], 10) || 0,
        parqueadero: celda(row, col.parqueadero),
        piso: celda(row, col.piso),
        estrato: celda(row, col.estrato),
        estado: celda(row, col.estado),
        servicio: celda(row, col.servicio),
        credito: celda(row, col.credito).toLowerCase(),
        linkFicha: celda(row, col.linkFicha),
        imagen: photos[0] || "",
        photos,
        fechaVenta: celda(row, col.fechaVenta),
        observaciones: celda(row, col.observaciones),
      };
    });

  return allRows;
}

// Cuenta inmuebles marcados como "Vendido" (o "Arrendado") con Fecha Venta
// dentro de los últimos `dias` días. Se usa para el banner de prueba social
// — no toca la lista que se muestra en el catálogo.
function parseFlexibleDate(str) {
  if (!str) return null;
  // Soporta "DD/MM/AAAA" (formato típico de Sheets en español) y formatos
  // que Date() ya entiende (ISO, etc.)
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? "20" + y : y;
    return new Date(Number(year), Number(m) - 1, Number(d));
  }
  const parsed = new Date(str);
  return isNaN(parsed) ? null : parsed;
}

function countRecentSales(allRows, dias) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dias);
  return allRows.filter((r) => {
    const estadoLower = r.estado.toLowerCase();
    const esVendido = estadoLower.includes("vendido") || estadoLower.includes("arrendado");
    if (!esVendido) return false;
    const fecha = parseFlexibleDate(r.fechaVenta);
    return fecha && fecha >= cutoff;
  }).length;
}

function renderSalesBanner(allRows) {
  const count = countRecentSales(allRows, 90);
  const el = document.getElementById("sales-banner");
  if (!el) return;
  if (count > 0) {
    el.hidden = false;
    el.textContent = `🏠 ${count} inmueble${count === 1 ? "" : "s"} vendido${count === 1 ? "" : "s"} en los últimos 3 meses`;
  } else {
    el.hidden = true;
  }
}

// ─────────────────────────────────────────────────────────────
// Tarjetas
// ─────────────────────────────────────────────────────────────
function isArriendo(servicio) {
  return (servicio || "").toLowerCase().includes("arriendo");
}
function isVenta(servicio) {
  return (servicio || "").toLowerCase().includes("venta");
}

function priceForCard(listing) {
  if (isArriendo(listing.servicio) && listing.canon > 0) {
    return { amount: listing.canon, suffix: " / mes" };
  }
  if (listing.precio > 0) return { amount: listing.precio, suffix: "" };
  if (listing.canon > 0) return { amount: listing.canon, suffix: " / mes" };
  return { amount: 0, suffix: "" };
}

// Siempre hay una respuesta sobre crédito que mostrar: "Sí" aplica, "No"
// (solo contado), o "Por revisar" cuando la celda del Sheet viene vacía —
// nunca se omite el dato por completo.
function creditoBucket(credito) {
  const c = (credito || "").toLowerCase().trim();
  if (c === "si" || c === "sí") return "si";
  if (c === "no") return "no";
  return "revisar";
}
function creditoLabel(credito) {
  const bucket = creditoBucket(credito);
  if (bucket === "si") return "Aplica crédito";
  if (bucket === "no") return "Solo al contado";
  return "Por revisar";
}

function isCasa(tipo) {
  return (tipo || "").toLowerCase().includes("casa");
}

// En apartamentos, "# Piso" es el nivel sobre el suelo ("Piso 3").
// En casas, la misma columna representa cuántos niveles tiene la casa
// ("2 niveles"), así que el texto cambia según el tipo de inmueble.
function pisoOrNivelesLabel(listing) {
  if (isCasa(listing.tipo)) {
    const n = parseInt(listing.piso, 10);
    const unidad = n === 1 ? "nivel" : "niveles";
    return `${escapeHtml(listing.piso)} ${unidad}`;
  }
  return `Piso ${escapeHtml(listing.piso)}`;
}

function cardMeta(icon, texto) {
  return `<span class="card-meta-item">${ICONS[icon]}${texto}</span>`;
}

function cardHtml(listing) {
  const img = listing.imagen || PLACEHOLDER_IMG;
  const price = priceForCard(listing);
  const badgeClass = isArriendo(listing.servicio) && !isVenta(listing.servicio) ? "arriendo" : "venta";
  const badgeText = isArriendo(listing.servicio) && !isVenta(listing.servicio) ? "Arriendo" : (listing.servicio || "Disponible");
  const titulo = `${listing.tipo} en ${listing.barrio}`;
  const credito = creditoBucket(listing.credito);

  const meta = [];
  if (listing.habitaciones) meta.push(cardMeta("bed", `${listing.habitaciones} hab.`));
  if (listing.banos) meta.push(cardMeta("bath", `${listing.banos} baños`));
  if (listing.area) meta.push(cardMeta("area", `${listing.area} m²`));
  if (listing.parqueadero && listing.parqueadero.toLowerCase() !== "no") meta.push(cardMeta("car", `${escapeHtml(listing.parqueadero)} parq.`));
  if (listing.piso) meta.push(cardMeta("layers", pisoOrNivelesLabel(listing)));

  const waMsg = `Hola Javier, me interesa el ${titulo}${listing.id ? ` (Ref. ${listing.id})` : ""}.`;
  const wa = whatsappConfigured()
    ? `<a class="card-whatsapp track-contact" href="${escapeAttr(whatsappLink(waMsg))}" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp sobre este inmueble" data-tipo="${escapeAttr(listing.tipo)}" data-barrio="${escapeAttr(listing.barrio)}" data-price="${price.amount || ""}">${ICONS.wa}</a>`
    : "";

  return `
    <article class="card">
      <button type="button" class="card-image-link open-detail" data-id="${escapeAttr(listing.catalogId)}" aria-label="Ver detalle de este inmueble">
        <img src="${escapeAttr(img)}" alt="${escapeAttr(titulo)}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">
        <span class="card-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      </button>
      <div class="card-body">
        <div class="card-top">
          <p class="card-price">${formatCOP(price.amount)}${price.suffix ? `<small>${price.suffix}</small>` : ""}</p>
          ${credito === "si" ? `<span class="card-credit">Aplica crédito</span>` : ""}
        </div>
        <h3 class="card-title">${escapeHtml(titulo)}</h3>
        <p class="card-zona">${ICONS.pin}${escapeHtml(listing.barrio)}</p>
        <div class="card-meta">${meta.join("")}</div>
        <div class="card-actions">
          <button type="button" class="card-link open-detail" data-id="${escapeAttr(listing.catalogId)}">Ver ficha completa <span aria-hidden="true">→</span></button>
          ${wa}
        </div>
      </div>
    </article>
  `;
}

// ─────────────────────────────────────────────────────────────
// Íconos (línea simple, heredan el color del texto vía currentColor)
// ─────────────────────────────────────────────────────────────
const ICONS = {
  area: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`,
  bed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18v2M21 18v2M3 12V8a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v2"/></svg>`,
  bath: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 12V6a2 2 0 0 1 2-2c1 0 1.6.6 2 1M3 19h18"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5"/></svg>`,
  car: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17h16M5 17l1.5-5.5A2 2 0 0 1 8.4 10h7.2a2 2 0 0 1 1.9 1.5L19 17M6 17v2M18 17v2"/><circle cx="7.5" cy="17" r="1.3"/><circle cx="16.5" cy="17" r="1.3"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>`,
  calc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>`,
  wa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.3-4A8 8 0 1 1 8.5 19L4 20z"/></svg>`,
  credito: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>`,
};

function detailStat(icon, value, label) {
  if (!value) return "";
  return `<div class="detail-stat">${ICONS[icon]}<span class="detail-stat-value">${escapeHtml(value)}</span><span class="detail-stat-label">${escapeHtml(label)}</span></div>`;
}

// ─────────────────────────────────────────────────────────────
// Ficha de detalle (se abre sobre la misma página, sin recargar)
// ─────────────────────────────────────────────────────────────
let currentDetailId = null;
let detailInitializedFromURL = false;
let carouselIndex = 0;
let carouselPhotos = [];

function findSimilar(listing, pool, count) {
  return pool
    .filter((l) => l.catalogId !== listing.catalogId && l.tipo === listing.tipo)
    .sort((a, b) => Math.abs(priceForCard(a).amount - priceForCard(listing).amount) - Math.abs(priceForCard(b).amount - priceForCard(listing).amount))
    .slice(0, count);
}

function miniCardHtml(listing) {
  const img = listing.imagen || PLACEHOLDER_IMG;
  const price = priceForCard(listing);
  return `
    <button type="button" class="mini-card open-detail" data-id="${escapeAttr(listing.catalogId)}">
      <img src="${escapeAttr(img)}" alt="${escapeAttr(listing.tipo)} en ${escapeAttr(listing.barrio)}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">
      <span class="mini-card-body">
        <strong>${formatCOP(price.amount)}</strong>
        <span>${escapeHtml(listing.tipo)} en ${escapeHtml(listing.barrio)}</span>
      </span>
    </button>
  `;
}

function renderCarousel() {
  const track = document.getElementById("detail-carousel-track");
  const dots = document.getElementById("detail-carousel-dots");
  if (!track) return;
  track.style.transform = `translateX(-${carouselIndex * 100}%)`;
  document.querySelectorAll("#fi-miniaturas button").forEach((m, i) => m.classList.toggle("active", i === carouselIndex));
  if (!dots) return; // con una sola foto no hay puntos
  dots.querySelectorAll("button").forEach((d, i) => d.classList.toggle("active", i === carouselIndex));
}

function moveCarousel(delta) {
  carouselIndex = (carouselIndex + delta + carouselPhotos.length) % carouselPhotos.length;
  renderCarousel();
}

// Cuota de ejemplo con los mismos valores iniciales de la calculadora
// (80 % financiado, 14 % E.A., 20 años). Solo es ilustrativa.
const CUOTA_EJEMPLO = { financiado: 0.8, tasaEA: 14, anios: 20 };
function cuotaEjemplo(precio) {
  const i = Math.pow(1 + CUOTA_EJEMPLO.tasaEA / 100, 1 / 12) - 1;
  const n = CUOTA_EJEMPLO.anios * 12;
  const monto = precio * CUOTA_EJEMPLO.financiado;
  return Math.round((monto * i) / (1 - Math.pow(1 + i, -n)));
}

let visitaElegida = "";

function nombreAsesorCorto() {
  return ((CONFIG.MARCA_NOMBRE || "").split(/\s+/)[0]) || "";
}

function mensajeInteres(listing) {
  const titulo = `${listing.tipo} en ${listing.barrio}`;
  const ref = listing.id ? ` (Ref. ${listing.id})` : "";
  return `Hola${nombreAsesorCorto() ? " " + nombreAsesorCorto() : ""}, me interesa el ${titulo}${ref}.`;
}

function hechoHtml(icon, valor, etiqueta) {
  if (!valor) return "";
  return `<div class="fi-hecho">${ICONS[icon]}<div><strong>${escapeHtml(valor)}</strong><span>${escapeHtml(etiqueta)}</span></div></div>`;
}

function asesorHtml() {
  if (!CONFIG.MARCA_NOMBRE) return "";
  const foto = CONFIG.FOTO_AGENTE_URL ? `<img src="${escapeAttr(rutaSitio(CONFIG.FOTO_AGENTE_URL))}" alt="" class="fi-asesor-foto">` : "";
  const partes = [];
  if (CONFIG.AGENTE_ANIOS) partes.push(`${CONFIG.AGENTE_ANIOS} años de experiencia`);
  const cargo = [CONFIG.AGENTE_CARGO, partes.join("")].filter(Boolean).join(" · ");
  const lineas = [];
  if (CONFIG.AGENTE_COLEGAS) lineas.push(`Respaldado por una red de más de ${CONFIG.AGENTE_COLEGAS} colegas e inmobiliarias.`);
  if (CONFIG.AGENTE_TRANSACCIONES) lineas.push(`+${CONFIG.AGENTE_TRANSACCIONES} transacciones acompañadas${CONFIG.AGENTE_ANIO_REFERENCIA ? " en " + CONFIG.AGENTE_ANIO_REFERENCIA : ""}.`);
  return `
    <div class="fi-asesor">
      ${foto}
      <div>
        <strong>${escapeHtml(CONFIG.MARCA_NOMBRE)}</strong>
        ${cargo ? `<span class="fi-asesor-cargo">${escapeHtml(cargo)}</span>` : ""}
        ${lineas.length ? `<p>${escapeHtml(lineas.join(" "))}</p>` : ""}
      </div>
    </div>`;
}

function detailHtml(listing) {
  const price = priceForCard(listing);
  const soloArriendo = isArriendo(listing.servicio) && !isVenta(listing.servicio);
  const badgeClass = soloArriendo ? "arriendo" : "venta";
  const badgeText = soloArriendo ? "Arriendo" : (listing.servicio || "Disponible");
  const similares = findSimilar(listing, allListings, 3);
  const titulo = `${listing.tipo} en ${listing.barrio}`;
  const credito = creditoBucket(listing.credito);
  const tieneFotos = carouselPhotos[0] !== PLACEHOLDER_IMG;

  // Cifras calculadas (solo cuando hay datos suficientes)
  const precioM2 = !soloArriendo && listing.precio > 0 && listing.area > 0 ? Math.round(listing.precio / listing.area) : 0;
  const cuota = !soloArriendo && credito !== "no" && listing.precio > 0 ? cuotaEjemplo(listing.precio) : 0;
  const numeros = (precioM2 || cuota) ? `
    <section class="fi-seccion">
      <h3>Los números, claros</h3>
      <div class="fi-numeros">
        ${precioM2 ? `<div class="fi-numero"><span class="fi-numero-etq">Precio por metro cuadrado</span><strong>${formatCOP(precioM2)}</strong><small>Se calcula solo: precio ÷ área.</small></div>` : ""}
        ${cuota ? `<div class="fi-numero"><span class="fi-numero-etq">Cuota estimada con crédito</span><strong>≈ ${formatCOP(cuota)} <small class="inline">/ mes</small></strong><small>Ejemplo ilustrativo (${Math.round(CUOTA_EJEMPLO.financiado * 100)} % financiado, ${CUOTA_EJEMPLO.anios} años, tasa ${CUOTA_EJEMPLO.tasaEA} % E.A.). <a href="${SITE_BASE}credito/?valor=${listing.precio}">Ajustar en la calculadora →</a></small></div>` : ""}
      </div>
    </section>` : "";

  const sobre = listing.observaciones ? `
    <section class="fi-seccion">
      <h3>Sobre este inmueble</h3>
      <p class="fi-texto">${escapeHtml(listing.observaciones).replace(/\n+/g, "<br>")}</p>
    </section>` : "";

  const etiquetaPrecio = soloArriendo ? "Canon de arriendo" : "Precio de venta";

  return `
    <div class="fi">
      <button type="button" class="fi-volver" id="fi-volver">← Todos los inmuebles</button>
      <div class="fi-grid">
        <div class="fi-main">
          <div class="detail-carousel">
            <div class="detail-carousel-track" id="detail-carousel-track">
              ${carouselPhotos.map((src) => `<img src="${escapeAttr(src)}" alt="${escapeAttr(titulo)}" onerror="this.src='${PLACEHOLDER_IMG}'">`).join("")}
            </div>
            ${carouselPhotos.length > 1 ? `
              <button type="button" class="carousel-arrow prev" id="carousel-prev" aria-label="Foto anterior">‹</button>
              <button type="button" class="carousel-arrow next" id="carousel-next" aria-label="Foto siguiente">›</button>
              <div class="detail-carousel-dots" id="detail-carousel-dots">
                ${carouselPhotos.map((_, i) => `<button type="button" data-i="${i}" aria-label="Foto ${i + 1}"></button>`).join("")}
              </div>
            ` : ""}
            ${tieneFotos ? `
              <button type="button" class="carousel-zoom" id="carousel-zoom" aria-label="Ampliar foto">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                ${carouselPhotos.length > 1 ? `Ver las ${carouselPhotos.length} fotos` : "Ampliar"}
              </button>` : ""}
          </div>
          ${carouselPhotos.length > 1 ? `
            <div class="fi-miniaturas" id="fi-miniaturas">
              ${carouselPhotos.slice(0, 8).map((src, i) => `<button type="button" data-i="${i}" aria-label="Ver foto ${i + 1}"><img src="${escapeAttr(src)}" alt="" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'"></button>`).join("")}
            </div>` : ""}

          <div class="fi-cabecera">
            <div class="fi-etiquetas">
              <span class="fi-etq ${badgeClass}">${escapeHtml(badgeText)}</span>
              ${credito === "si" ? `<span class="fi-etq credito">Aplica crédito</span>` : ""}
              <span class="fi-etq disp">Disponible</span>
            </div>
            <h2 class="detail-title">${escapeHtml(titulo)}</h2>
            <p class="fi-ubicacion">${ICONS.pin}${escapeHtml(listing.barrio)}, Sur de Cali${listing.id ? ` · Ref. ${escapeHtml(listing.id)}` : ""}</p>
          </div>

          <div class="fi-hechos">
            ${hechoHtml("bed", listing.habitaciones ? String(listing.habitaciones) : "", listing.habitaciones === 1 ? "Habitación" : "Habitaciones")}
            ${hechoHtml("bath", listing.banos ? String(listing.banos) : "", listing.banos === 1 ? "Baño" : "Baños")}
            ${hechoHtml("area", listing.area ? `${listing.area} m²` : "", "Área")}
            ${listing.parqueadero && listing.parqueadero.toLowerCase() !== "no" ? hechoHtml("car", listing.parqueadero, "Parqueadero") : ""}
            ${hechoHtml("layers", listing.piso, isCasa(listing.tipo) ? "Niveles" : "Piso")}
            ${hechoHtml("star", listing.estrato, "Estrato")}
          </div>

          ${numeros}
          ${sobre}
          ${listing.linkFicha ? `<a class="detail-crm-link" href="${escapeAttr(listing.linkFicha)}" target="_blank" rel="noopener">Ver ficha técnica completa →</a>` : ""}
        </div>

        <aside class="fi-aside">
          <div class="fi-reserva">
            <span class="fi-reserva-etq">${etiquetaPrecio}</span>
            <p class="detail-price">${formatCOP(price.amount)}${price.suffix ? `<small>${price.suffix}</small>` : ""}</p>
            <div class="detail-cta">
              ${whatsappConfigured() ? `
                <button type="button" class="detail-whatsapp" id="detail-lead-toggle">
                  ${ICONS.wa}
                  Quiero conocer este inmueble
                </button>
                <form class="detail-lead-form" id="detail-lead-form" hidden>
                  <input class="detail-lead-input" type="text" id="dl-nombre" placeholder="Tu nombre" required autocomplete="name">
                  <input class="detail-lead-input" type="tel" id="dl-whatsapp" placeholder="Tu WhatsApp" required inputmode="numeric" autocomplete="tel">
                  <select class="detail-lead-input" id="dl-credito" required>
                    <option value="">¿Ya tienes crédito aprobado o estás por gestionarlo?</option>
                    <option value="Aprobado">Sí, ya lo tengo aprobado</option>
                    <option value="En trámite">Lo estoy gestionando</option>
                    <option value="Contado">Voy a pagar de contado</option>
                  </select>
                  <button type="submit" class="detail-lead-submit">Enviar y continuar a WhatsApp →</button>
                  <p class="detail-lead-error" id="detail-lead-error" hidden>Completa los 3 campos para continuar.</p>
                </form>
                <div class="fi-mensaje">
                  <span>Mensaje listo para enviar:</span>
                  <p id="fi-mensaje-texto">“${escapeHtml(mensajeInteres(listing))}”</p>
                </div>
                <div class="fi-visita">
                  <span>¿Cuándo quieres visitarlo?</span>
                  <div class="fi-chips" id="fi-chips">
                    ${["Hoy", "Mañana", "Este fin de semana"].map((t) => `<button type="button" class="fi-chip" data-visita="${t}" aria-pressed="false">${t}</button>`).join("")}
                  </div>
                </div>` : ""}
            </div>
            <div class="fi-acciones">
              <button type="button" class="fi-accion" id="fi-compartir">${ICONS.share}<span>Compartir</span></button>
              <a class="fi-accion" href="${SITE_BASE}credito/?valor=${listing.precio || ""}">${ICONS.calc}<span>Simular crédito</span></a>
            </div>
          </div>
          ${asesorHtml()}
        </aside>
      </div>

      ${similares.length ? `
        <div class="detail-similar">
          <h3>Inmuebles similares</h3>
          <div class="detail-similar-grid">${similares.map(miniCardHtml).join("")}</div>
        </div>` : ""}
      ${whatsappConfigured() ? `
        <div class="fi-barra">
          <div><span>${etiquetaPrecio}</span><strong>${formatCOP(price.amount)}${price.suffix ? `<small>${price.suffix}</small>` : ""}</strong></div>
          <button type="button" class="fi-barra-wa" id="fi-barra-wa">${ICONS.wa}Quiero conocerlo</button>
        </div>` : ""}
    </div>
  `;
}

function enviarLeadASheet(data) {
  enviarLeadBackend(data); // js/lead-api.js
}

// Volver, chips de visita y compartir (parte nueva de la ficha)
function wireDetailExtras(listing) {
  visitaElegida = "";
  const volver = document.getElementById("fi-volver");
  if (volver) volver.addEventListener("click", () => closeDetail());

  const chips = document.querySelectorAll("#fi-chips .fi-chip");
  const texto = document.getElementById("fi-mensaje-texto");
  chips.forEach((chip) => chip.addEventListener("click", () => {
    const ya = chip.classList.contains("activo");
    chips.forEach((c) => { c.classList.remove("activo"); c.setAttribute("aria-pressed", "false"); });
    visitaElegida = ya ? "" : chip.dataset.visita;
    if (!ya) { chip.classList.add("activo"); chip.setAttribute("aria-pressed", "true"); }
    if (texto) texto.textContent = `“${mensajeInteres(listing)}${visitaElegida ? " Me gustaría verlo: " + visitaElegida.toLowerCase() + "." : ""}”`;
  }));

  // Barra fija de celular: abre el mismo formulario de la columna de contacto.
  const barra = document.getElementById("fi-barra-wa");
  if (barra) barra.addEventListener("click", () => {
    const toggle = document.getElementById("detail-lead-toggle");
    if (toggle && !toggle.hidden) toggle.click();
    const form = document.getElementById("detail-lead-form");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const compartir = document.getElementById("fi-compartir");
  if (compartir) compartir.addEventListener("click", async () => {
    const url = `${window.location.origin}${urlWithVer(listing.catalogId)}`;
    const etiqueta = compartir.querySelector("span");
    try {
      if (navigator.share) { await navigator.share({ title: `${listing.tipo} en ${listing.barrio}`, url }); return; }
      await navigator.clipboard.writeText(url);
    } catch (err) {
      if (err && err.name === "AbortError") return;
      const tmp = document.createElement("textarea");
      tmp.value = url; document.body.appendChild(tmp); tmp.select();
      try { document.execCommand("copy"); } catch (e2) { /* sin permiso */ }
      document.body.removeChild(tmp);
    }
    const original = etiqueta.textContent;
    etiqueta.textContent = "¡Enlace copiado!";
    setTimeout(() => { etiqueta.textContent = original; }, 1800);
  });
}

function wireDetailLeadForm(listing) {
  const toggleBtn = document.getElementById("detail-lead-toggle");
  const form = document.getElementById("detail-lead-form");
  if (!toggleBtn || !form) return;

  toggleBtn.addEventListener("click", () => {
    toggleBtn.hidden = true;
    form.hidden = false;
    document.getElementById("dl-nombre").focus();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = document.getElementById("dl-nombre").value.trim();
    const whatsapp = document.getElementById("dl-whatsapp").value.trim();
    const credito = document.getElementById("dl-credito").value;
    const error = document.getElementById("detail-lead-error");

    // Validación explícita: no depende de que el navegador respete el
    // "required" nativo (algunos navegadores integrados, como el de
    // WhatsApp o Instagram, no siempre lo bloquean bien).
    if (!nombre || !whatsapp || !credito) {
      error.hidden = false;
      return;
    }
    error.hidden = true;

    const price = priceForCard(listing).amount;
    const inmuebleTexto = `${listing.tipo} en ${listing.barrio} (${formatCOP(price)})${visitaElegida ? " · Visita: " + visitaElegida : ""}`;
    const inmuebleUrl = `${window.location.origin}${urlWithVer(listing.catalogId)}`;

    const eventId = trackPixel("Lead", {
      content_ids: [listing.id || listing.catalogId],
      content_name: inmuebleTexto,
      value: price || undefined,
      currency: "COP",
    });

    enviarLeadASheet({
      eventId,
      origen: "Ficha de inmueble",
      nombre,
      whatsapp,
      inmueble: inmuebleTexto,
      inmuebleUrl,
      estadoCredito: credito,
    });

    const msg = `Hola, soy ${nombre}. Quiero conocer este inmueble: ${inmuebleTexto}. Estado del crédito: ${credito}.${visitaElegida ? " Me gustaría verlo: " + visitaElegida.toLowerCase() + "." : ""} ${inmuebleUrl}`;
    const waHref = whatsappConfigured() ? `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}` : "#";

    e.submitter.disabled = true;
    e.submitter.textContent = "Enviando…";
    setTimeout(() => { window.location.href = waHref; }, 300);
  });
}

function wireDetailCarousel() {
  const prev = document.getElementById("carousel-prev");
  const next = document.getElementById("carousel-next");
  if (prev) prev.addEventListener("click", () => moveCarousel(-1));
  if (next) next.addEventListener("click", () => moveCarousel(1));
  document.querySelectorAll("#fi-miniaturas button").forEach((m) => {
    m.addEventListener("click", () => { carouselIndex = Number(m.dataset.i); renderCarousel(); });
  });
  document.querySelectorAll("#detail-carousel-dots button").forEach((dot) => {
    dot.addEventListener("click", () => { carouselIndex = Number(dot.dataset.i); renderCarousel(); });
  });

  // Deslizar con el dedo en mobile
  const track = document.getElementById("detail-carousel-track");
  if (!track) return;
  let startX = null;
  let ultimoDeslizamiento = 0;
  track.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener("touchend", (e) => {
    if (startX == null) return;
    const delta = e.changedTouches[0].clientX - startX;
    if (Math.abs(delta) > 40) { moveCarousel(delta < 0 ? 1 : -1); ultimoDeslizamiento = Date.now(); }
    startX = null;
  });

  // Tocar la foto (sin deslizar) o el botón "Ampliar" abre el visor.
  const hayFotos = carouselPhotos[0] !== PLACEHOLDER_IMG;
  if (!hayFotos) return;
  track.addEventListener("click", (e) => {
    if (e.target.tagName !== "IMG" || Date.now() - ultimoDeslizamiento < 400) return;
    openLightbox(carouselIndex);
  });
  const zoomBtn = document.getElementById("carousel-zoom");
  if (zoomBtn) zoomBtn.addEventListener("click", () => openLightbox(carouselIndex));
}

// ─────────────────────────────────────────────────────────────
// Visor de fotos ampliadas: foto completa a pantalla entera, pasar con
// flechas o deslizando, acercar con dos dedos / doble toque / rueda del
// mouse, y cerrar con ✕, Esc o el botón "atrás" del celular.
// ─────────────────────────────────────────────────────────────
const lb = {
  el: null, img: null, stage: null, count: null, hint: null,
  index: 0, scale: 1, tx: 0, ty: 0,
  pointers: new Map(), pinch: null, pan: null, swipeX: null, lastTap: null,
  historial: false, ignorarPopstate: false, tHint: null,
};

function buildLightbox() {
  if (lb.el) return;
  const el = document.createElement("div");
  el.className = "lightbox";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Fotos ampliadas");
  el.innerHTML = `
    <div class="lightbox-top">
      <span class="lightbox-count" id="lightbox-count"></span>
      <button type="button" class="lightbox-btn" id="lightbox-close" aria-label="Cerrar fotos">✕</button>
    </div>
    <div class="lightbox-stage" id="lightbox-stage">
      <img id="lightbox-img" alt="">
    </div>
    <button type="button" class="lightbox-btn lightbox-prev" id="lightbox-prev" aria-label="Foto anterior">‹</button>
    <button type="button" class="lightbox-btn lightbox-next" id="lightbox-next" aria-label="Foto siguiente">›</button>
    <div class="lightbox-hint" id="lightbox-hint"></div>
  `;
  document.body.appendChild(el);
  lb.el = el;
  lb.img = el.querySelector("#lightbox-img");
  lb.stage = el.querySelector("#lightbox-stage");
  lb.count = el.querySelector("#lightbox-count");
  lb.hint = el.querySelector("#lightbox-hint");

  el.querySelector("#lightbox-close").addEventListener("click", () => closeLightbox());
  el.querySelector("#lightbox-prev").addEventListener("click", () => lightboxGo(-1));
  el.querySelector("#lightbox-next").addEventListener("click", () => lightboxGo(1));
  lb.img.addEventListener("error", () => { lb.img.src = PLACEHOLDER_IMG; });

  lb.stage.addEventListener("pointerdown", lbPointerDown);
  lb.stage.addEventListener("pointermove", lbPointerMove);
  lb.stage.addEventListener("pointerup", lbPointerUp);
  lb.stage.addEventListener("pointercancel", lbPointerUp);
  lb.stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    lbZoomAt(lb.scale * factor, e.clientX, e.clientY);
  }, { passive: false });
}

function lightboxOpen() { return lb.el && !lb.el.hidden; }

function openLightbox(index) {
  buildLightbox();
  lb.index = index;
  lb.el.hidden = false;
  lbShow();
  const touch = window.matchMedia("(pointer: coarse)").matches;
  lb.hint.textContent = touch ? "Pellizca o toca dos veces para acercar" : "Doble clic o rueda del mouse para acercar";
  lb.hint.classList.remove("oculto");
  clearTimeout(lb.tHint);
  lb.tHint = setTimeout(() => lb.hint.classList.add("oculto"), 2500);
  // Entrada en el historial: así el botón "atrás" del celular cierra el
  // visor y deja la ficha abierta, en vez de salirse de ella.
  window.history.pushState({ ver: currentDetailId, fotos: true }, "", window.location.href);
  lb.historial = true;
  lb.el.querySelector("#lightbox-close").focus();
}

function closeLightbox({ fromHistory = false } = {}) {
  if (!lightboxOpen()) return;
  lb.el.hidden = true;
  // Deja el carrusel de la ficha en la última foto vista.
  carouselIndex = lb.index;
  renderCarousel();
  if (lb.historial && !fromHistory) {
    lb.historial = false;
    lb.ignorarPopstate = true; // ese "atrás" lo hicimos nosotros: la ficha no se vuelve a abrir
    window.history.back();
  }
  lb.historial = false;
}

function lbShow() {
  const total = carouselPhotos.length;
  lb.img.src = carouselPhotos[lb.index];
  lb.count.textContent = `${lb.index + 1} / ${total}`;
  lb.el.querySelector("#lightbox-prev").hidden = total < 2;
  lb.el.querySelector("#lightbox-next").hidden = total < 2;
  lbReset(false);
  // Precargar las vecinas para que el cambio sea inmediato.
  [lb.index + 1, lb.index - 1].forEach((i) => {
    const src = carouselPhotos[(i + total) % total];
    if (src) { const pre = new Image(); pre.src = src; }
  });
}

function lightboxGo(delta) {
  const total = carouselPhotos.length;
  if (total < 2) return;
  lb.index = (lb.index + delta + total) % total;
  lbShow();
}

function lbApply(animar) {
  lb.stage.classList.toggle("animar", !!animar);
  lb.img.style.transform = `translate(${lb.tx}px, ${lb.ty}px) scale(${lb.scale})`;
  lb.stage.style.cursor = lb.scale > 1 ? "grab" : "zoom-in";
}

function lbReset(animar) { lb.scale = 1; lb.tx = 0; lb.ty = 0; lbApply(animar); }

// Evita que la foto ampliada se salga del todo de la pantalla.
function lbClamp() {
  const maxX = (lb.img.offsetWidth * (lb.scale - 1)) / 2;
  const maxY = (lb.img.offsetHeight * (lb.scale - 1)) / 2;
  lb.tx = Math.max(-maxX, Math.min(maxX, lb.tx));
  lb.ty = Math.max(-maxY, Math.min(maxY, lb.ty));
}

// Acerca o aleja dejando fijo el punto (x, y) de la pantalla.
function lbZoomAt(nuevaEscala, x, y, animar) {
  const s = Math.max(1, Math.min(4, nuevaEscala));
  const r = lb.stage.getBoundingClientRect();
  const cx = x - (r.left + r.width / 2);
  const cy = y - (r.top + r.height / 2);
  lb.tx = cx - ((cx - lb.tx) * s) / lb.scale;
  lb.ty = cy - ((cy - lb.ty) * s) / lb.scale;
  lb.scale = s;
  if (s === 1) { lb.tx = 0; lb.ty = 0; }
  lbClamp();
  lbApply(animar);
}

function lbDist() {
  const [a, b] = [...lb.pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lbPointerDown(e) {
  lb.stage.setPointerCapture(e.pointerId);
  lb.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
  if (lb.pointers.size === 2) {
    const [a, b] = [...lb.pointers.values()];
    lb.pinch = { dist: lbDist(), scale: lb.scale, tx: lb.tx, ty: lb.ty, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    lb.pan = null; lb.swipeX = null;
  } else if (lb.pointers.size === 1) {
    if (lb.scale > 1) lb.pan = { x: e.clientX, y: e.clientY, tx: lb.tx, ty: lb.ty };
    else lb.swipeX = e.clientX;
  }
}

function lbPointerMove(e) {
  const p = lb.pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (lb.pinch && lb.pointers.size === 2) {
    // Zoom relativo al inicio del pellizco.
    lb.scale = lb.pinch.scale; lb.tx = lb.pinch.tx; lb.ty = lb.pinch.ty;
    lbZoomAt(lb.pinch.scale * (lbDist() / lb.pinch.dist), lb.pinch.mx, lb.pinch.my);
  } else if (lb.pan) {
    lb.tx = lb.pan.tx + (e.clientX - lb.pan.x);
    lb.ty = lb.pan.ty + (e.clientY - lb.pan.y);
    lbClamp();
    lbApply(false);
  } else if (lb.swipeX != null) {
    lb.img.style.transform = `translateX(${e.clientX - lb.swipeX}px)`; // la foto sigue al dedo
  }
}

function lbPointerUp(e) {
  const p = lb.pointers.get(e.pointerId);
  lb.pointers.delete(e.pointerId);
  if (!p) return;
  if (lb.pinch) {
    if (lb.pointers.size < 2) lb.pinch = null;
    if (lb.scale < 1.05) lbReset(true);
    return;
  }
  const movio = Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 12;
  if (lb.swipeX != null) {
    const dx = e.clientX - lb.swipeX;
    lb.swipeX = null;
    if (Math.abs(dx) > 50 && carouselPhotos.length > 1) { lightboxGo(dx < 0 ? 1 : -1); lb.lastTap = null; return; }
    lbApply(true); // vuelve a su sitio si el deslizamiento fue corto
  }
  lb.pan = null;
  if (movio) { lb.lastTap = null; return; }
  // Doble toque / doble clic: acercar ahí, o volver al tamaño normal.
  const ahora = Date.now();
  if (lb.lastTap && ahora - lb.lastTap.t < 320 && Math.hypot(e.clientX - lb.lastTap.x, e.clientY - lb.lastTap.y) < 30) {
    if (lb.scale > 1) lbReset(true); else lbZoomAt(2.5, e.clientX, e.clientY, true);
    lb.lastTap = null;
  } else {
    lb.lastTap = { t: ahora, x: e.clientX, y: e.clientY };
  }
}

document.addEventListener("keydown", (e) => {
  if (!lightboxOpen()) return;
  if (e.key === "ArrowRight") lightboxGo(1);
  else if (e.key === "ArrowLeft") lightboxGo(-1);
});

function verParamFromURL() {
  return new URLSearchParams(window.location.search).get("ver");
}

function urlWithVer(id) {
  const p = new URLSearchParams(window.location.search);
  if (id) p.set("ver", id); else p.delete("ver");
  const q = p.toString();
  return window.location.pathname + (q ? "?" + q : "");
}

// ─────────────────────────────────────────────────────────────
// Enlaces viejos (?ver=...) de inmuebles que cambiaron o ya no están
// ─────────────────────────────────────────────────────────────
// El ID termina en un código corto sacado del link de la ficha externa, que
// no cambia aunque se edite el precio, el barrio o el tipo. Si el ID completo
// no coincide, se busca por ese código para seguir abriendo el mismo inmueble.
function codigoDeId(id) {
  const partes = String(id || "").split("-");
  return partes.length > 1 ? partes[partes.length - 1] : "";
}

function buscarPorCodigo(lista, id) {
  const cod = codigoDeId(id);
  if (!cod || cod === "0") return null; // "0" = inmuebles sin link: no es único
  const encontrados = lista.filter((l) => codigoDeId(l.catalogId) === cod);
  return encontrados.length === 1 ? encontrados[0] : null;
}

// Si el inmueble ya no está en la hoja, se recupera tipo, barrio y precio
// leyendo el propio enlace (ej. "apartamento-valle-del-lili-245-000-000-x9k2").
function datosDesdeId(id) {
  const sinCodigo = String(id || "").split("-").slice(0, -1).join("-");
  const m = /^(.*?)-*((?:\d+-)*\d+)?$/.exec(sinCodigo) || [];
  let texto = (m[1] || "").replace(/-+$/, "");
  let precio = m[2] ? parseInt(m[2].replace(/-/g, ""), 10) : 0;
  // Los enlaces nuevos no llevan precio; un número chico al final es parte del barrio.
  if (precio < 1000000) { texto = sinCodigo.replace(/-+$/, ""); precio = 0; }
  let tipo = "";
  let barrio = texto;
  const tipos = [...new Set(todosLosInmuebles.map((l) => l.tipo))].sort((a, b) => b.length - a.length);
  for (const t of tipos) {
    const s = slugify(t).replace(/-+$/, "");
    if (s && (texto === s || texto.startsWith(s + "-"))) { tipo = t; barrio = texto.slice(s.length + 1); break; }
  }
  const barrioReal = todosLosInmuebles.map((l) => l.barrio).find((b) => slugify(b).replace(/^-+|-+$/g, "") === barrio);
  const bonito = (s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { tipo, barrio: barrioReal || (barrio ? bonito(barrio) : ""), precio };
}

function similaresA(ref, cantidad) {
  const conPrecio = ref.precio > 0;
  return allListings
    .map((l) => {
      const p = priceForCard(l).amount;
      let puntos = 0;
      if (ref.tipo && l.tipo === ref.tipo) puntos += 3;
      if (ref.barrio && slugify(l.barrio) === slugify(ref.barrio)) puntos += 2;
      if (conPrecio && p) {
        const dif = Math.abs(p - ref.precio) / ref.precio;
        if (dif <= 0.15) puntos += 3; else if (dif <= 0.3) puntos += 2; else if (dif <= 0.5) puntos += 1;
      }
      return { l, puntos, dif: conPrecio && p ? Math.abs(p - ref.precio) : 0 };
    })
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || a.dif - b.dif)
    .slice(0, cantidad)
    .map((x) => x.l);
}

function noDisponibleHtml(ref, sugeridos) {
  const precioTxt = ref.precio ? ` · ${formatCOP(ref.precio)}` : "";
  const descripcion = ref.tipo || ref.barrio
    ? `${escapeHtml(ref.tipo || "Inmueble")}${ref.barrio ? " en " + escapeHtml(ref.barrio) : ""}${precioTxt}`
    : "";
  // Enlace al inventario ya filtrado por tipo y un rango de precio parecido.
  const p = new URLSearchParams();
  if (ref.tipo) p.set("tipo", ref.tipo);
  if (ref.precio >= 20000000) {
    p.set("precioMin", Math.floor((ref.precio * 0.75) / 1e6));
    p.set("precioMax", Math.ceil((ref.precio * 1.25) / 1e6));
  }
  const urlParecidos = window.location.pathname + (p.toString() ? "?" + p.toString() : "");
  const msg = `Hola, abrí un inmueble que ya no está disponible${descripcion ? " (" + descripcion.replace(/<[^>]+>/g, "") + ")" : ""}. ¿Me ayudas a encontrar algo parecido?`;
  return `
    <div class="nodisp">
      <div class="nodisp-icono" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>
      </div>
      <h2 class="nodisp-titulo">Este inmueble ya no está disponible</h2>
      ${descripcion ? `<p class="nodisp-ref">${descripcion}</p>` : ""}
      <p class="nodisp-texto">Ya se vendió, se arrendó o salió del inventario.</p>
      ${sugeridos.length ? `
        <h3 class="nodisp-sub">Opciones parecidas disponibles</h3>
        <div class="detail-similar-grid nodisp-grid">${sugeridos.map(miniCardHtml).join("")}</div>
      ` : ""}
      <div class="nodisp-acciones">
        ${ref.tipo || ref.precio ? `<a class="nodisp-btn primario" href="${escapeAttr(urlParecidos)}">Ver más opciones parecidas</a>` : ""}
        <a class="nodisp-btn" href="${escapeAttr(window.location.pathname)}">Ver todo el inventario</a>
        ${whatsappConfigured() ? `
          <a class="nodisp-btn whatsapp track-contact" target="_blank" rel="noopener"
             data-tipo="${escapeAttr(ref.tipo || "Inmueble")}" data-barrio="${escapeAttr(ref.barrio || "")}" data-price="${ref.precio || ""}"
             href="${escapeAttr(whatsappLink(msg))}">Pedir ayuda por WhatsApp</a>` : ""}
      </div>
    </div>
  `;
}

function showNoDisponible(id, mode) {
  // Si sigue en la hoja (vendido/arrendado), sus datos reales; si se borró,
  // lo que se pueda leer del enlace.
  const enHoja = todosLosInmuebles.find((l) => l.catalogId === id) || buscarPorCodigo(todosLosInmuebles, id);
  const ref = enHoja
    ? { tipo: enHoja.tipo, barrio: enHoja.barrio, precio: priceForCard(enHoja).amount }
    : datosDesdeId(id);
  currentDetailId = id;
  const overlay = document.getElementById("detail-overlay");
  document.getElementById("detail-content").innerHTML = noDisponibleHtml(ref, similaresA(ref, 4));
  overlay.hidden = false;
  document.body.classList.add("no-scroll");
  overlay.scrollTop = 0;
  if (mode === "push") window.history.pushState({ ver: id }, "", urlWithVer(id));
  else if (mode === "replace") window.history.replaceState({ ver: id }, "", urlWithVer(id));
}

function openDetail(id, { mode = "push" } = {}) {
  let listing = allListings.find((l) => l.catalogId === id);
  if (!listing) {
    // ¿Es un enlace viejo del mismo inmueble (cambió el precio/barrio/tipo)?
    listing = buscarPorCodigo(allListings, id);
    if (listing) {
      if (mode === "none") mode = "replace"; // corrige la URL al ID nuevo
    } else {
      showNoDisponible(id, mode);
      return;
    }
  }
  id = listing.catalogId;

  currentDetailId = id;
  carouselIndex = 0;
  carouselPhotos = listing.photos.length ? listing.photos : [PLACEHOLDER_IMG];

  const overlay = document.getElementById("detail-overlay");
  document.getElementById("detail-content").innerHTML = detailHtml(listing);
  overlay.hidden = false;
  document.body.classList.add("no-scroll");
  overlay.scrollTop = 0;
  wireDetailCarousel();
  renderCarousel(); // marca el primer punto del carrusel
  wireDetailLeadForm(listing);
  wireDetailExtras(listing);

  // "push" solo se usa al abrir desde el catálogo (agrega una entrada al
  // historial, así "atrás" cierra la ficha). Al navegar a un "inmueble
  // similar" desde dentro de una ficha ya abierta usamos "replace" para no
  // apilar entradas — así un solo "atrás" siempre vuelve al catálogo, sin
  // importar cuántos sugeridos haya visto la persona. "none" se usa cuando
  // el cambio de URL ya ocurrió por otro lado (ej. al recibir un popstate).
  if (mode === "push") window.history.pushState({ ver: id }, "", urlWithVer(id));
  else if (mode === "replace") window.history.replaceState({ ver: id }, "", urlWithVer(id));

  trackPixel("ViewContent", {
    content_ids: [listing.id || listing.catalogId],
    content_type: "product",
    content_name: `${listing.tipo} en ${listing.barrio}`,
    value: priceForCard(listing).amount || undefined,
    currency: "COP",
  });
}

function closeDetail({ goBack = true } = {}) {
  document.getElementById("detail-overlay").hidden = true;
  document.body.classList.remove("no-scroll");
  currentDetailId = null;
  if (goBack && verParamFromURL()) window.history.back();
}

function wireDetailOverlay() {
  document.getElementById("detail-close").addEventListener("click", () => closeDetail());
  document.getElementById("detail-overlay").addEventListener("click", (e) => {
    if (e.target.id === "detail-overlay") closeDetail();
  });
  document.getElementById("detail-content").addEventListener("click", handleTrackableClick);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (lightboxOpen()) closeLightbox(); // Esc primero cierra las fotos ampliadas
    else if (!document.getElementById("detail-overlay").hidden) closeDetail();
  });
  window.addEventListener("popstate", () => {
    // "Atrás" con el visor de fotos abierto: solo se cierra el visor.
    if (lb.ignorarPopstate) { lb.ignorarPopstate = false; return; }
    if (lightboxOpen()) { closeLightbox({ fromHistory: true }); return; }
    const id = verParamFromURL();
    if (id) openDetail(id, { mode: "none" });
    else closeDetail({ goBack: false });
  });
}
let allListings = [];
let todosLosInmuebles = []; // incluye vendidos/arrendados (para enlaces viejos)
let filtersInitialized = false;
let filterState = {
  search: "", tipo: "", parqueadero: "", servicio: "", credito: "",
  precioMin: null, precioMax: null,
  pisoMin: null, pisoMax: null,
  habMin: null,
  sort: "random",
};

// Pesos aleatorios estables durante la sesión: cada inmueble conserva su
// posición al azar entre refrescos automáticos, y solo se vuelve a barajar
// si la persona recarga la página.
const randomWeights = new Map();
function identityKey(l) {
  return [l.tipo, l.barrio, l.precio, l.canon, l.piso, l.area].join("|");
}
function getRandomWeight(l) {
  const key = identityKey(l);
  if (!randomWeights.has(key)) randomWeights.set(key, Math.random());
  return randomWeights.get(key);
}

function fillSelect(id, values, placeholder) {
  const el = document.getElementById(id);
  const current = el.value;
  el.innerHTML = `<option value="">${placeholder}</option>` + values.map((v) => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join("");
  if (values.includes(current)) el.value = current;
}

function populateFilters(listings) {
  fillSelect("f-tipo", [...new Set(listings.map((l) => l.tipo))].sort(), "Todos los tipos");
  fillSelect("f-parqueadero", [...new Set(listings.map((l) => l.parqueadero).filter(Boolean))].sort(), "Cualquier parqueadero");
}

function matchesPriceRange(listing) {
  const amount = priceForCard(listing).amount;
  if (filterState.precioMin != null && amount < filterState.precioMin * 1e6) return false;
  if (filterState.precioMax != null && amount > filterState.precioMax * 1e6) return false;
  return true;
}

function matchesPisoRange(listing) {
  if (filterState.pisoMin == null && filterState.pisoMax == null) return true;
  const piso = parseInt(listing.piso, 10);
  if (isNaN(piso)) return false; // si se filtra por piso, se excluyen los que no tienen piso numérico
  if (filterState.pisoMin != null && piso < filterState.pisoMin) return false;
  if (filterState.pisoMax != null && piso > filterState.pisoMax) return false;
  return true;
}

function matchesSearch(listing) {
  if (!filterState.search) return true;
  const haystack = `${listing.tipo} ${listing.barrio} ${listing.parqueadero} ${listing.servicio} ${listing.estado}`.toLowerCase();
  return haystack.includes(filterState.search.toLowerCase());
}

function applyFilters(listings) {
  return listings.filter((l) => {
    if (!matchesSearch(l)) return false;
    if (filterState.tipo && l.tipo !== filterState.tipo) return false;
    if (filterState.parqueadero && l.parqueadero !== filterState.parqueadero) return false;
    if (filterState.credito && creditoBucket(l.credito) !== filterState.credito) return false;
    if (filterState.servicio === "venta" && !isVenta(l.servicio)) return false;
    if (filterState.servicio === "arriendo" && !isArriendo(l.servicio)) return false;
    if (!matchesPriceRange(l)) return false;
    if (!matchesPisoRange(l)) return false;
    if (filterState.habMin != null && (l.habitaciones || 0) < filterState.habMin) return false;
    return true;
  });
}

function sortListings(listings) {
  const list = [...listings];
  if (filterState.sort === "precio_asc") return list.sort((a, b) => priceForCard(a).amount - priceForCard(b).amount);
  if (filterState.sort === "precio_desc") return list.sort((a, b) => priceForCard(b).amount - priceForCard(a).amount);
  return list.sort((a, b) => getRandomWeight(a) - getRandomWeight(b));
}

function renderGallery() {
  const filtered = sortListings(applyFilters(allListings));
  const gallery = document.getElementById("gallery");
  const empty = document.getElementById("empty-state");

  gallery.innerHTML = filtered.map(cardHtml).join("");
  empty.hidden = filtered.length > 0;
  document.getElementById("filters-count").textContent = `${filtered.length} inmuebles`;
}

// Delegación de eventos: un solo listener cubre todas las tarjetas, aunque
// se vuelvan a dibujar en cada refresco automático.
// Un solo manejador de clics reutilizable: cubre tanto las tarjetas de la
// galería como los elementos dentro de la ficha de detalle (el botón de
// WhatsApp ahí, y los mini-cards de "inmuebles similares").
function handleTrackableClick(e) {
  const contactEl = e.target.closest(".track-contact");
  if (contactEl) {
    const params = {
      content_name: `${contactEl.dataset.tipo} en ${contactEl.dataset.barrio}`,
      value: Number(contactEl.dataset.price) || undefined,
      currency: "COP",
    };
    fireContactAndGo(e, contactEl.href, params);
    return;
  }
  const detailEl = e.target.closest(".open-detail");
  if (detailEl) {
    // Si el clic viene de un "inmueble similar" dentro de una ficha ya
    // abierta, reemplazamos esa entrada del historial en vez de apilar una
    // nueva — así "atrás" siempre vuelve directo al catálogo.
    const yaHayFichaAbierta = e.target.closest("#detail-overlay");
    openDetail(detailEl.dataset.id, { mode: yaHayFichaAbierta ? "replace" : "push" });
  }
}

function wireCardTracking() {
  document.getElementById("gallery").addEventListener("click", handleTrackableClick);
}

// ─────────────────────────────────────────────────────────────
// URL: leer al entrar, escribir al cambiar filtros
// ─────────────────────────────────────────────────────────────
function readFiltersFromURL() {
  const p = new URLSearchParams(window.location.search);
  filterState.search = p.get("q") || "";
  filterState.tipo = p.get("tipo") || "";
  filterState.parqueadero = p.get("parqueadero") || "";
  filterState.credito = p.get("credito") || "";
  filterState.servicio = p.get("servicio") || "";
  filterState.precioMin = p.has("precioMin") ? Number(p.get("precioMin")) : null;
  filterState.precioMax = p.has("precioMax") ? Number(p.get("precioMax")) : null;
  filterState.pisoMin = p.has("pisoMin") ? Number(p.get("pisoMin")) : null;
  filterState.pisoMax = p.has("pisoMax") ? Number(p.get("pisoMax")) : null;
  filterState.habMin = p.has("hab") ? Number(p.get("hab")) : null;
  filterState.sort = p.get("sort") || "random";
}

function updateURL() {
  const p = new URLSearchParams();
  if (filterState.search) p.set("q", filterState.search);
  if (filterState.tipo) p.set("tipo", filterState.tipo);
  if (filterState.parqueadero) p.set("parqueadero", filterState.parqueadero);
  if (filterState.credito) p.set("credito", filterState.credito);
  if (filterState.servicio) p.set("servicio", filterState.servicio);
  if (filterState.precioMin != null) p.set("precioMin", filterState.precioMin);
  if (filterState.precioMax != null) p.set("precioMax", filterState.precioMax);
  if (filterState.pisoMin != null) p.set("pisoMin", filterState.pisoMin);
  if (filterState.pisoMax != null) p.set("pisoMax", filterState.pisoMax);
  if (filterState.habMin != null) p.set("hab", filterState.habMin);
  if (filterState.sort && filterState.sort !== "random") p.set("sort", filterState.sort);

  const query = p.toString();
  const newUrl = window.location.pathname + (query ? "?" + query : "");
  window.history.replaceState(null, "", newUrl);
}

function syncControlsFromState() {
  document.getElementById("f-search").value = filterState.search;
  document.getElementById("f-tipo").value = filterState.tipo;
  document.getElementById("f-parqueadero").value = filterState.parqueadero;
  document.getElementById("f-credito").value = filterState.credito;
  document.getElementById("f-servicio").value = filterState.servicio;
  document.getElementById("f-precio-min").value = filterState.precioMin ?? "";
  document.getElementById("f-precio-max").value = filterState.precioMax ?? "";
  document.getElementById("f-piso-min").value = filterState.pisoMin ?? "";
  document.getElementById("f-piso-max").value = filterState.pisoMax ?? "";
  document.getElementById("f-hab").value = filterState.habMin == null ? "" : String(filterState.habMin);
  document.getElementById("f-sort").value = filterState.sort;
  updatePillStates();
}

// Resalta cada "pill" cuando tiene un filtro aplicado, y actualiza el
// texto de los pills de Precio/Piso para reflejar el rango elegido.
function updatePillStates() {
  ["f-tipo", "f-parqueadero", "f-credito", "f-servicio", "f-hab"].forEach((id) => {
    const el = document.getElementById(id);
    el.classList.toggle("pill-active", el.value !== "");
  });

  const precioActive = filterState.precioMin != null || filterState.precioMax != null;
  const pillPrecio = document.getElementById("pill-precio");
  pillPrecio.classList.toggle("pill-active", precioActive);
  pillPrecio.textContent = precioActive
    ? `$${filterState.precioMin ?? "0"}M–${filterState.precioMax ?? "∞"}M ▾`
    : "Precio ▾";

  const pisoActive = filterState.pisoMin != null || filterState.pisoMax != null;
  const pillPiso = document.getElementById("pill-piso");
  pillPiso.classList.toggle("pill-active", pisoActive);
  pillPiso.textContent = pisoActive
    ? `Piso ${filterState.pisoMin ?? "0"}–${filterState.pisoMax ?? "∞"} ▾`
    : "Piso ▾";
}

// Solo un popover abierto a la vez; se cierra al elegir "Listo", al tocar
// fuera, o al abrir el otro.
// Los popovers usan position:fixed (no absolute) porque la fila de pills
// tiene scroll horizontal, y eso recorta cualquier hijo posicionado de
// forma relativa a ella. Con fixed, se calcula la posición en cada apertura
// y no queda atrapado por el scroll del contenedor.
function closeAllPopovers() {
  document.querySelectorAll(".pill-popover").forEach((p) => { p.hidden = true; });
  document.querySelectorAll(".pill-toggle").forEach((b) => b.setAttribute("aria-expanded", "false"));
}

function togglePopover(pillId, popoverId) {
  const popover = document.getElementById(popoverId);
  const pillBtn = document.getElementById(pillId);
  const wasHidden = popover.hidden;
  closeAllPopovers();
  if (!wasHidden) return; // ya estaba abierto: closeAllPopovers ya lo cerró

  const rect = pillBtn.getBoundingClientRect();
  popover.style.top = `${rect.bottom + 8}px`;
  popover.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 240))}px`;
  popover.hidden = false;
  pillBtn.setAttribute("aria-expanded", "true");
}

function onFilterChange() {
  updateURL();
  updatePillStates();
  renderGallery();
}

function wireFilters() {
  document.getElementById("f-search").addEventListener("input", (e) => { filterState.search = e.target.value; onFilterChange(); });
  document.getElementById("f-tipo").addEventListener("change", (e) => { filterState.tipo = e.target.value; onFilterChange(); });
  document.getElementById("f-parqueadero").addEventListener("change", (e) => { filterState.parqueadero = e.target.value; onFilterChange(); });
  document.getElementById("f-credito").addEventListener("change", (e) => { filterState.credito = e.target.value; onFilterChange(); });
  document.getElementById("f-servicio").addEventListener("change", (e) => { filterState.servicio = e.target.value; onFilterChange(); });
  document.getElementById("f-hab").addEventListener("change", (e) => { filterState.habMin = e.target.value === "" ? null : Number(e.target.value); onFilterChange(); });
  document.getElementById("f-sort").addEventListener("change", (e) => { filterState.sort = e.target.value; onFilterChange(); });

  document.getElementById("f-precio-min").addEventListener("input", (e) => { filterState.precioMin = e.target.value === "" ? null : Number(e.target.value); onFilterChange(); });
  document.getElementById("f-precio-max").addEventListener("input", (e) => { filterState.precioMax = e.target.value === "" ? null : Number(e.target.value); onFilterChange(); });
  document.getElementById("f-piso-min").addEventListener("input", (e) => { filterState.pisoMin = e.target.value === "" ? null : Number(e.target.value); onFilterChange(); });
  document.getElementById("f-piso-max").addEventListener("input", (e) => { filterState.pisoMax = e.target.value === "" ? null : Number(e.target.value); onFilterChange(); });

  document.getElementById("pill-precio").addEventListener("click", () => togglePopover("pill-precio", "popover-precio"));
  document.getElementById("pill-piso").addEventListener("click", () => togglePopover("pill-piso", "popover-piso"));
  document.querySelectorAll(".popover-done").forEach((btn) => btn.addEventListener("click", closeAllPopovers));

  // Cerrar el popover abierto si se toca fuera de él. (Nota: no lo cerramos
  // al hacer scroll/resize — en mobile, abrir el teclado dispara un evento
  // de resize y eso cerraba el popover justo al tocar un campo para escribir.)
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".pill-popover-wrap")) closeAllPopovers();
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    filterState = { search: "", tipo: "", parqueadero: "", credito: "", servicio: "", precioMin: null, precioMax: null, pisoMin: null, pisoMax: null, habMin: null, sort: "random" };
    syncControlsFromState();
    onFilterChange();
  });

  document.getElementById("btn-copy").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const original = btn.textContent;
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Respaldo para navegadores sin permiso de portapapeles
      const tmp = document.createElement("textarea");
      tmp.value = window.location.href;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      document.body.removeChild(tmp);
    }
    btn.textContent = "¡Copiado!";
    setTimeout(() => { btn.textContent = original; }, 1800);
  });
}

// ─────────────────────────────────────────────────────────────
// Orquestación
// ─────────────────────────────────────────────────────────────
async function loadAndRender() {
  try {
    const values = await fetchSheetData();
    if (!values) return;
    const allRows = rowsToPublicListings(values);
    // Solo se listan inmuebles disponibles (Vendido/Arrendado no se muestran
    // como tarjetas, pero sí cuentan para el banner de ventas recientes)
    allListings = allRows.filter((r) => !r.estado || r.estado.toLowerCase().includes("disponible"));
    todosLosInmuebles = allRows;

    document.getElementById("loading-state").hidden = true;
    renderSalesBanner(allRows);
    populateFilters(allListings);

    if (!filtersInitialized) {
      readFiltersFromURL();
      syncControlsFromState();
      filtersInitialized = true;
    }

    renderGallery();

    if (!detailInitializedFromURL) {
      const verId = verParamFromURL();
      if (verId) {
        // Si alguien entra directo con un link compartido (?ver=...), no
        // hay ningún "catálogo" antes en el historial de este navegador —
        // sin este paso, "atrás" o "cerrar" sacarían a la persona del sitio
        // en vez de mostrarle el catálogo. Anclamos el catálogo primero.
        window.history.replaceState(null, "", urlWithVer(null));
        openDetail(verId, { mode: "push" });
      }
      detailInitializedFromURL = true;
    }

    document.getElementById("last-updated").textContent =
      "Actualizado: " + new Date().toLocaleTimeString("es-CO");
  } catch (err) {
    console.error(err);
    document.getElementById("loading-state").hidden = false;
    document.getElementById("loading-state").textContent = "No se pudo cargar el inventario: " + err.message;
  }
}

guardarClicAnuncio();
initMetaPixel();
setupWhatsappFloat();
wireCardTracking();
wireFilters();
wireDetailOverlay();
loadAndRender();
setInterval(loadAndRender, CONFIG.REFRESH_INTERVAL_MS);
