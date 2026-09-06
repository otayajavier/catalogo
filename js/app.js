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

function cardHtml(listing) {
  const img = listing.imagen || PLACEHOLDER_IMG;
  const price = priceForCard(listing);
  const badgeClass = isArriendo(listing.servicio) && !isVenta(listing.servicio) ? "arriendo" : "venta";
  const badgeText = listing.servicio || "Disponible";

  const specs = [];
  if (listing.area) specs.push(`${listing.area} m²`);
  if (listing.habitaciones) specs.push(`${listing.habitaciones} hab.`);
  if (listing.banos) specs.push(`${listing.banos} baños`);
  if (listing.piso) specs.push(`Piso ${listing.piso}`);
  if (listing.parqueadero && listing.parqueadero.toLowerCase() !== "no") specs.push(`Parqueadero ${escapeHtml(listing.parqueadero)}`);
  if (listing.credito === "si" || listing.credito === "sí") specs.push("Aplica crédito");

  const linkHref = listing.linkFicha || "#";
  const linkable = Boolean(listing.linkFicha);

  return `
    <article class="card">
      ${
        linkable
          ? `<a class="card-image-link" href="${escapeAttr(linkHref)}" target="_blank" rel="noopener" aria-label="Ver ficha completa de este inmueble">`
          : `<span class="card-image-link">`
      }
        <img src="${escapeAttr(img)}" alt="${escapeAttr(listing.tipo)} en ${escapeAttr(listing.barrio)}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">
        <span class="card-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      ${linkable ? "</a>" : "</span>"}
      <div class="card-body">
        <p class="card-price">${formatCOP(price.amount)}${price.suffix ? `<small>${price.suffix}</small>` : ""}</p>
        <h3 class="card-title">${escapeHtml(listing.tipo)} en ${escapeHtml(listing.barrio)}</h3>
        <div class="card-specs">${specs.map((s) => `<span>${s}</span>`).join("")}</div>
        ${linkable ? `<a class="card-link" href="${escapeAttr(linkHref)}" target="_blank" rel="noopener">Ver ficha completa →</a>` : ""}
      </div>
    </article>
  `;
}

// ─────────────────────────────────────────────────────────────
// Filtros
// ─────────────────────────────────────────────────────────────
let allListings = [];
let filterState = { tipo: "", barrio: "", servicio: "", precio: "" };

function fillSelect(id, values, placeholder) {
  const el = document.getElementById(id);
  const current = el.value;
  el.innerHTML = `<option value="">${placeholder}</option>` + values.map((v) => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join("");
  if (values.includes(current)) el.value = current;
}

function populateFilters(listings) {
  fillSelect("f-tipo", [...new Set(listings.map((l) => l.tipo))].sort(), "Todos los tipos");
  fillSelect("f-barrio", [...new Set(listings.map((l) => l.barrio))].sort(), "Toda la ciudad");
}

function matchesPriceBucket(listing, bucketValue) {
  if (!bucketValue) return true;
  const [minStr, maxStr] = bucketValue.split("-");
  const min = Number(minStr);
  const max = maxStr ? Number(maxStr) : Infinity;
  const amount = priceForCard(listing).amount;
  return amount >= min && amount < max;
}

function applyFilters(listings) {
  return listings.filter((l) => {
    if (filterState.tipo && l.tipo !== filterState.tipo) return false;
    if (filterState.barrio && l.barrio !== filterState.barrio) return false;
    if (filterState.servicio === "venta" && !isVenta(l.servicio)) return false;
    if (filterState.servicio === "arriendo" && !isArriendo(l.servicio)) return false;
    if (!matchesPriceBucket(l, filterState.precio)) return false;
    return true;
  });
}

function renderGallery() {
  const filtered = applyFilters(allListings);
  const gallery = document.getElementById("gallery");
  const empty = document.getElementById("empty-state");

  gallery.innerHTML = filtered.map(cardHtml).join("");
  empty.hidden = filtered.length > 0;
  document.getElementById("filters-count").textContent = `${filtered.length} inmuebles`;
}

function wireFilters() {
  document.getElementById("f-tipo").addEventListener("change", (e) => { filterState.tipo = e.target.value; renderGallery(); });
  document.getElementById("f-barrio").addEventListener("change", (e) => { filterState.barrio = e.target.value; renderGallery(); });
  document.getElementById("f-servicio").addEventListener("change", (e) => { filterState.servicio = e.target.value; renderGallery(); });
  document.getElementById("f-precio").addEventListener("change", (e) => { filterState.precio = e.target.value; renderGallery(); });
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
    renderGallery();
    document.getElementById("last-updated").textContent =
      "Actualizado: " + new Date().toLocaleTimeString("es-CO");
  } catch (err) {
    console.error(err);
    document.getElementById("loading-state").hidden = false;
    document.getElementById("loading-state").textContent = "No se pudo cargar el inventario: " + err.message;
  }
}

wireFilters();
loadAndRender();
setInterval(loadAndRender, CONFIG.REFRESH_INTERVAL_MS);
