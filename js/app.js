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

function trackPixel(event, params) {
  if (typeof fbq === "function") fbq("track", event, params || {});
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

function whatsappMessageForListing(listing) {
  const price = formatCOP(priceForCard(listing).amount);
  return `Hola, quiero más información sobre este ${listing.tipo} en ${listing.barrio} (${price}).`;
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

// ─────────────────────────────────────────────────────────────
// Carga de datos desde Google Sheets API
// ─────────────────────────────────────────────────────────────
async function fetchSheetData() {
  if (!CONFIG.API_KEY || CONFIG.API_KEY === "PEGA_AQUI_TU_API_KEY") {
    document.getElementById("loading-state").textContent =
      "Falta configurar la API key en js/config.js (ver README.md).";
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

  const col = {
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
    imagen: findCol(headers, "imagen"),
    masFotos: findCol(headers, "foto"),
    fechaVenta: findCol(headers, "fecha"),
  };

  const allRows = values
    .slice(1)
    .filter((row) => row.some((cell) => cell && cell.trim && cell.trim() !== ""))
    .map((row) => {
      const imagenPrincipal = (row[col.imagen] || "").trim();
      const masFotos = (row[col.masFotos] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const photos = [imagenPrincipal, ...masFotos].filter((v, i, arr) => v && arr.indexOf(v) === i);

      return {
        catalogId: makeCatalogId(row[col.tipo], row[col.barrio], row[col.precio], row[col.linkFicha]),
        tipo: row[col.tipo] || "Inmueble",
        barrio: row[col.barrio] || "Cali",
        precio: parseCOP(row[col.precio]),
        canon: parseCOP(row[col.canon]),
        area: parseFloat(row[col.area]) || 0,
        habitaciones: parseInt(row[col.habitaciones], 10) || 0,
        banos: parseInt(row[col.banos], 10) || 0,
        parqueadero: (row[col.parqueadero] || "").trim(),
        piso: (row[col.piso] || "").trim(),
        estrato: (row[col.estrato] || "").trim(),
        estado: (row[col.estado] || "").trim(),
        servicio: (row[col.servicio] || "").trim(),
        credito: (row[col.credito] || "").trim().toLowerCase(),
        linkFicha: (row[col.linkFicha] || "").trim(),
        imagen: imagenPrincipal,
        photos,
        fechaVenta: (row[col.fechaVenta] || "").trim(),
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

function cardHtml(listing) {
  const img = listing.imagen || PLACEHOLDER_IMG;
  const price = priceForCard(listing);
  const badgeClass = isArriendo(listing.servicio) && !isVenta(listing.servicio) ? "arriendo" : "venta";
  const badgeText = listing.servicio || "Disponible";

  const specs = [];
  if (listing.area) specs.push(`${listing.area} m²`);
  if (listing.habitaciones) specs.push(`${listing.habitaciones} hab.`);
  if (listing.banos) specs.push(`${listing.banos} baños`);
  if (listing.piso) specs.push(pisoOrNivelesLabel(listing));
  if (listing.parqueadero && listing.parqueadero.toLowerCase() !== "no") specs.push(`Parqueadero ${escapeHtml(listing.parqueadero)}`);
  if (listing.credito === "si" || listing.credito === "sí") specs.push("Aplica crédito");

  const waHref = whatsappConfigured() ? whatsappLink(whatsappMessageForListing(listing)) : "";

  return `
    <article class="card">
      <button type="button" class="card-image-link open-detail" data-id="${escapeAttr(listing.catalogId)}" aria-label="Ver detalle de este inmueble">
        <img src="${escapeAttr(img)}" alt="${escapeAttr(listing.tipo)} en ${escapeAttr(listing.barrio)}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">
        <span class="card-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      </button>
      <div class="card-body">
        <p class="card-price">${formatCOP(price.amount)}${price.suffix ? `<small>${price.suffix}</small>` : ""}</p>
        <h3 class="card-title">${escapeHtml(listing.tipo)} en ${escapeHtml(listing.barrio)}</h3>
        <div class="card-specs">${specs.map((s) => `<span>${s}</span>`).join("")}</div>
        <div class="card-actions">
          <button type="button" class="card-link open-detail" data-id="${escapeAttr(listing.catalogId)}">Ver ficha completa →</button>
          ${
            waHref
              ? `<a class="card-whatsapp track-contact" data-tipo="${escapeAttr(listing.tipo)}" data-barrio="${escapeAttr(listing.barrio)}" data-price="${price.amount}" href="${waHref}" target="_blank" rel="noopener" aria-label="Preguntar por WhatsApp sobre este inmueble">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.94 7.94 0 0 0-6.9 11.9L4 20l4.2-1.1a7.9 7.9 0 0 0 3.85 1h.01a7.94 7.94 0 0 0 5.54-13.58ZM12.06 18.4h-.01a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.65.67-2.43-.16-.25a6.6 6.6 0 0 1 10.2-8.24 6.55 6.55 0 0 1 1.94 4.67 6.62 6.62 0 0 1-6.54 6.66Zm3.62-4.94c-.2-.1-1.17-.58-1.35-.64-.18-.07-.32-.1-.45.1-.13.19-.51.64-.63.78-.11.13-.23.15-.43.05-.2-.1-.83-.31-1.58-.98a5.9 5.9 0 0 1-1.1-1.36c-.11-.2 0-.3.09-.4.09-.1.2-.24.3-.36.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.45-1.08-.62-1.48-.16-.39-.33-.34-.45-.34h-.38c-.13 0-.35.05-.53.25-.18.19-.7.68-.7 1.66s.72 1.93.82 2.06c.1.13 1.4 2.14 3.4 3 .47.2.85.32 1.14.42.48.15.91.13 1.26.08.38-.06 1.17-.48 1.34-.94.16-.46.16-.86.11-.94-.05-.08-.18-.13-.38-.23Z"/></svg>
                  WhatsApp
                </a>`
              : ""
          }
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
  dots.querySelectorAll("button").forEach((d, i) => d.classList.toggle("active", i === carouselIndex));
}

function moveCarousel(delta) {
  carouselIndex = (carouselIndex + delta + carouselPhotos.length) % carouselPhotos.length;
  renderCarousel();
}

function detailHtml(listing) {
  const price = priceForCard(listing);
  const badgeClass = isArriendo(listing.servicio) && !isVenta(listing.servicio) ? "arriendo" : "venta";
  const similares = findSimilar(listing, allListings, 2);

  return `
    <div class="detail-carousel">
      <div class="detail-carousel-track" id="detail-carousel-track">
        ${carouselPhotos.map((src) => `<img src="${escapeAttr(src)}" alt="${escapeAttr(listing.tipo)} en ${escapeAttr(listing.barrio)}" onerror="this.src='${PLACEHOLDER_IMG}'">`).join("")}
      </div>
      ${carouselPhotos.length > 1 ? `
        <button type="button" class="carousel-arrow prev" id="carousel-prev" aria-label="Foto anterior">‹</button>
        <button type="button" class="carousel-arrow next" id="carousel-next" aria-label="Foto siguiente">›</button>
        <div class="detail-carousel-dots" id="detail-carousel-dots">
          ${carouselPhotos.map((_, i) => `<button type="button" data-i="${i}" aria-label="Foto ${i + 1}"></button>`).join("")}
        </div>
      ` : ""}
      <span class="card-badge ${badgeClass} detail-badge">${escapeHtml(listing.servicio || "Disponible")}</span>
    </div>

    <div class="detail-body">
      <p class="detail-price">${formatCOP(price.amount)}${price.suffix ? `<small>${price.suffix}</small>` : ""}</p>
      <h2 class="detail-title">${escapeHtml(listing.tipo)} en ${escapeHtml(listing.barrio)}</h2>

      <div class="detail-stats">
        ${detailStat("area", listing.area ? `${listing.area} m²` : "", "Área")}
        ${detailStat("bed", listing.habitaciones || "", listing.habitaciones === 1 ? "Habitación" : "Habitaciones")}
        ${detailStat("bath", listing.banos || "", listing.banos === 1 ? "Baño" : "Baños")}
        ${detailStat("layers", listing.piso || "", isCasa(listing.tipo) ? "Niveles" : "Piso")}
        ${listing.parqueadero && listing.parqueadero.toLowerCase() !== "no" ? detailStat("car", listing.parqueadero, "Parqueadero") : ""}
        ${listing.credito === "si" || listing.credito === "sí" ? detailStat("credito", "Sí", "Aplica crédito") : ""}
      </div>

      <div class="detail-cta">
        ${whatsappConfigured() ? `
          <a class="detail-whatsapp track-contact" id="detail-whatsapp-btn" data-tipo="${escapeAttr(listing.tipo)}" data-barrio="${escapeAttr(listing.barrio)}" data-price="${price.amount}" href="${whatsappLink(whatsappMessageForListing(listing))}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.94 7.94 0 0 0-6.9 11.9L4 20l4.2-1.1a7.9 7.9 0 0 0 3.85 1h.01a7.94 7.94 0 0 0 5.54-13.58ZM12.06 18.4h-.01a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.65.67-2.43-.16-.25a6.6 6.6 0 0 1 10.2-8.24 6.55 6.55 0 0 1 1.94 4.67 6.62 6.62 0 0 1-6.54 6.66Zm3.62-4.94c-.2-.1-1.17-.58-1.35-.64-.18-.07-.32-.1-.45.1-.13.19-.51.64-.63.78-.11.13-.23.15-.43.05-.2-.1-.83-.31-1.58-.98a5.9 5.9 0 0 1-1.1-1.36c-.11-.2 0-.3.09-.4.09-.1.2-.24.3-.36.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.45-1.08-.62-1.48-.16-.39-.33-.34-.45-.34h-.38c-.13 0-.35.05-.53.25-.18.19-.7.68-.7 1.66s.72 1.93.82 2.06c.1.13 1.4 2.14 3.4 3 .47.2.85.32 1.14.42.48.15.91.13 1.26.08.38-.06 1.17-.48 1.34-.94.16-.46.16-.86.11-.94-.05-.08-.18-.13-.38-.23Z"/></svg>
            Contactar por WhatsApp
          </a>` : ""}
        ${listing.linkFicha ? `<a class="detail-crm-link" href="${escapeAttr(listing.linkFicha)}" target="_blank" rel="noopener">Ver ficha técnica completa →</a>` : ""}
      </div>

      ${similares.length ? `
        <div class="detail-similar">
          <h3>Inmuebles similares</h3>
          <div class="detail-similar-grid">${similares.map(miniCardHtml).join("")}</div>
        </div>` : ""}
    </div>
  `;
}

function wireDetailCarousel() {
  const prev = document.getElementById("carousel-prev");
  const next = document.getElementById("carousel-next");
  if (prev) prev.addEventListener("click", () => moveCarousel(-1));
  if (next) next.addEventListener("click", () => moveCarousel(1));
  document.querySelectorAll("#detail-carousel-dots button").forEach((dot) => {
    dot.addEventListener("click", () => { carouselIndex = Number(dot.dataset.i); renderCarousel(); });
  });

  // Deslizar con el dedo en mobile
  const track = document.getElementById("detail-carousel-track");
  if (!track) return;
  let startX = null;
  track.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener("touchend", (e) => {
    if (startX == null) return;
    const delta = e.changedTouches[0].clientX - startX;
    if (Math.abs(delta) > 40) moveCarousel(delta < 0 ? 1 : -1);
    startX = null;
  });
}

function verParamFromURL() {
  return new URLSearchParams(window.location.search).get("ver");
}

function urlWithVer(id) {
  const p = new URLSearchParams(window.location.search);
  if (id) p.set("ver", id); else p.delete("ver");
  const q = p.toString();
  return window.location.pathname + (q ? "?" + q : "");
}

function openDetail(id, { mode = "push" } = {}) {
  const listing = allListings.find((l) => l.catalogId === id);
  if (!listing) return;

  currentDetailId = id;
  carouselIndex = 0;
  carouselPhotos = listing.photos.length ? listing.photos : [PLACEHOLDER_IMG];

  const overlay = document.getElementById("detail-overlay");
  document.getElementById("detail-content").innerHTML = detailHtml(listing);
  overlay.hidden = false;
  document.body.classList.add("no-scroll");
  overlay.scrollTop = 0;
  wireDetailCarousel();

  // "push" solo se usa al abrir desde el catálogo (agrega una entrada al
  // historial, así "atrás" cierra la ficha). Al navegar a un "inmueble
  // similar" desde dentro de una ficha ya abierta usamos "replace" para no
  // apilar entradas — así un solo "atrás" siempre vuelve al catálogo, sin
  // importar cuántos sugeridos haya visto la persona. "none" se usa cuando
  // el cambio de URL ya ocurrió por otro lado (ej. al recibir un popstate).
  if (mode === "push") window.history.pushState({ ver: id }, "", urlWithVer(id));
  else if (mode === "replace") window.history.replaceState({ ver: id }, "", urlWithVer(id));

  trackPixel("ViewContent", {
    content_ids: [listing.catalogId],
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
    if (e.key === "Escape" && !document.getElementById("detail-overlay").hidden) closeDetail();
  });
  window.addEventListener("popstate", () => {
    const id = verParamFromURL();
    if (id) openDetail(id, { mode: "none" });
    else closeDetail({ goBack: false });
  });
}
let allListings = [];
let filtersInitialized = false;
let filterState = {
  tipo: "", parqueadero: "", servicio: "",
  precioMin: null, precioMax: null,
  pisoMin: null, pisoMax: null,
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

function applyFilters(listings) {
  return listings.filter((l) => {
    if (filterState.tipo && l.tipo !== filterState.tipo) return false;
    if (filterState.parqueadero && l.parqueadero !== filterState.parqueadero) return false;
    if (filterState.servicio === "venta" && !isVenta(l.servicio)) return false;
    if (filterState.servicio === "arriendo" && !isArriendo(l.servicio)) return false;
    if (!matchesPriceRange(l)) return false;
    if (!matchesPisoRange(l)) return false;
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
  filterState.tipo = p.get("tipo") || "";
  filterState.parqueadero = p.get("parqueadero") || "";
  filterState.servicio = p.get("servicio") || "";
  filterState.precioMin = p.has("precioMin") ? Number(p.get("precioMin")) : null;
  filterState.precioMax = p.has("precioMax") ? Number(p.get("precioMax")) : null;
  filterState.pisoMin = p.has("pisoMin") ? Number(p.get("pisoMin")) : null;
  filterState.pisoMax = p.has("pisoMax") ? Number(p.get("pisoMax")) : null;
  filterState.sort = p.get("sort") || "random";
}

function updateURL() {
  const p = new URLSearchParams();
  if (filterState.tipo) p.set("tipo", filterState.tipo);
  if (filterState.parqueadero) p.set("parqueadero", filterState.parqueadero);
  if (filterState.servicio) p.set("servicio", filterState.servicio);
  if (filterState.precioMin != null) p.set("precioMin", filterState.precioMin);
  if (filterState.precioMax != null) p.set("precioMax", filterState.precioMax);
  if (filterState.pisoMin != null) p.set("pisoMin", filterState.pisoMin);
  if (filterState.pisoMax != null) p.set("pisoMax", filterState.pisoMax);
  if (filterState.sort && filterState.sort !== "random") p.set("sort", filterState.sort);

  const query = p.toString();
  const newUrl = window.location.pathname + (query ? "?" + query : "");
  window.history.replaceState(null, "", newUrl);
}

function syncControlsFromState() {
  document.getElementById("f-tipo").value = filterState.tipo;
  document.getElementById("f-parqueadero").value = filterState.parqueadero;
  document.getElementById("f-servicio").value = filterState.servicio;
  document.getElementById("f-precio-min").value = filterState.precioMin ?? "";
  document.getElementById("f-precio-max").value = filterState.precioMax ?? "";
  document.getElementById("f-piso-min").value = filterState.pisoMin ?? "";
  document.getElementById("f-piso-max").value = filterState.pisoMax ?? "";
  document.getElementById("f-sort").value = filterState.sort;
  updatePillStates();
}

// Resalta cada "pill" cuando tiene un filtro aplicado, y actualiza el
// texto de los pills de Precio/Piso para reflejar el rango elegido.
function updatePillStates() {
  ["f-tipo", "f-parqueadero", "f-servicio"].forEach((id) => {
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
  document.getElementById("f-tipo").addEventListener("change", (e) => { filterState.tipo = e.target.value; onFilterChange(); });
  document.getElementById("f-parqueadero").addEventListener("change", (e) => { filterState.parqueadero = e.target.value; onFilterChange(); });
  document.getElementById("f-servicio").addEventListener("change", (e) => { filterState.servicio = e.target.value; onFilterChange(); });
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
    filterState = { tipo: "", parqueadero: "", servicio: "", precioMin: null, precioMax: null, pisoMin: null, pisoMax: null, sort: "random" };
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

initMetaPixel();
setupWhatsappFloat();
wireCardTracking();
wireFilters();
wireDetailOverlay();
loadAndRender();
setInterval(loadAndRender, CONFIG.REFRESH_INTERVAL_MS);
