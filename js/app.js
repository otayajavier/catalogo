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
  };

  return values
    .slice(1)
    .filter((row) => row.some((cell) => cell && cell.trim && cell.trim() !== ""))
    .map((row) => ({
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
      imagen: (row[col.imagen] || "").trim(),
    }))
    // Solo se listan inmuebles disponibles (si la columna Estado lo dice)
    .filter((r) => !r.estado || r.estado.toLowerCase().includes("disponible"));
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

  const linkHref = listing.linkFicha || "#";
  const linkable = Boolean(listing.linkFicha);
  const waHref = whatsappConfigured() ? whatsappLink(whatsappMessageForListing(listing)) : "";

  return `
    <article class="card">
      ${
        linkable
          ? `<a class="card-image-link track-view-content" data-tipo="${escapeAttr(listing.tipo)}" data-barrio="${escapeAttr(listing.barrio)}" data-price="${price.amount}" href="${escapeAttr(linkHref)}" target="_blank" rel="noopener" aria-label="Ver ficha completa de este inmueble">`
          : `<span class="card-image-link">`
      }
        <img src="${escapeAttr(img)}" alt="${escapeAttr(listing.tipo)} en ${escapeAttr(listing.barrio)}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">
        <span class="card-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      ${linkable ? "</a>" : "</span>"}
      <div class="card-body">
        <p class="card-price">${formatCOP(price.amount)}${price.suffix ? `<small>${price.suffix}</small>` : ""}</p>
        <h3 class="card-title">${escapeHtml(listing.tipo)} en ${escapeHtml(listing.barrio)}</h3>
        <div class="card-specs">${specs.map((s) => `<span>${s}</span>`).join("")}</div>
        <div class="card-actions">
          ${linkable ? `<a class="card-link track-view-content" data-tipo="${escapeAttr(listing.tipo)}" data-barrio="${escapeAttr(listing.barrio)}" data-price="${price.amount}" href="${escapeAttr(linkHref)}" target="_blank" rel="noopener">Ver ficha completa →</a>` : ""}
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
// Filtros + orden + persistencia en la URL
// ─────────────────────────────────────────────────────────────
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
function wireCardTracking() {
  document.getElementById("gallery").addEventListener("click", (e) => {
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
    const viewEl = e.target.closest(".track-view-content");
    if (viewEl) {
      trackPixel("ViewContent", {
        content_name: `${viewEl.dataset.tipo} en ${viewEl.dataset.barrio}`,
        value: Number(viewEl.dataset.price) || undefined,
        currency: "COP",
      });
    }
  });
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

  // Cerrar el popover abierto si se toca fuera de él, o si la página o la
  // fila de pills hacen scroll (para que no quede mal ubicado)
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".pill-popover-wrap")) closeAllPopovers();
  });
  window.addEventListener("scroll", closeAllPopovers, true);
  window.addEventListener("resize", closeAllPopovers);

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
    allListings = rowsToPublicListings(values);

    document.getElementById("loading-state").hidden = true;
    populateFilters(allListings);

    if (!filtersInitialized) {
      readFiltersFromURL();
      syncControlsFromState();
      filtersInitialized = true;
    }

    renderGallery();
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
loadAndRender();
setInterval(loadAndRender, CONFIG.REFRESH_INTERVAL_MS);
