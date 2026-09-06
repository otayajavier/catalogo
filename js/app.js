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
// Filtros + orden + persistencia en la URL
// ─────────────────────────────────────────────────────────────
let allListings = [];
let filtersInitialized = false;
let filterState = {
  tipo: "", barrio: "", servicio: "",
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
  fillSelect("f-barrio", [...new Set(listings.map((l) => l.barrio))].sort(), "Toda la ciudad");
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
    if (filterState.barrio && l.barrio !== filterState.barrio) return false;
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

// ─────────────────────────────────────────────────────────────
// URL: leer al entrar, escribir al cambiar filtros
// ─────────────────────────────────────────────────────────────
function readFiltersFromURL() {
  const p = new URLSearchParams(window.location.search);
  filterState.tipo = p.get("tipo") || "";
  filterState.barrio = p.get("barrio") || "";
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
  if (filterState.barrio) p.set("barrio", filterState.barrio);
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
  document.getElementById("f-barrio").value = filterState.barrio;
  document.getElementById("f-servicio").value = filterState.servicio;
  document.getElementById("f-precio-min").value = filterState.precioMin ?? "";
  document.getElementById("f-precio-max").value = filterState.precioMax ?? "";
  document.getElementById("f-piso-min").value = filterState.pisoMin ?? "";
  document.getElementById("f-piso-max").value = filterState.pisoMax ?? "";
  document.getElementById("f-sort").value = filterState.sort;
}

function onFilterChange() {
  updateURL();
  renderGallery();
}

function wireFilters() {
  document.getElementById("f-tipo").addEventListener("change", (e) => { filterState.tipo = e.target.value; onFilterChange(); });
  document.getElementById("f-barrio").addEventListener("change", (e) => { filterState.barrio = e.target.value; onFilterChange(); });
  document.getElementById("f-servicio").addEventListener("change", (e) => { filterState.servicio = e.target.value; onFilterChange(); });
  document.getElementById("f-sort").addEventListener("change", (e) => { filterState.sort = e.target.value; onFilterChange(); });

  document.getElementById("f-precio-min").addEventListener("input", (e) => { filterState.precioMin = e.target.value === "" ? null : Number(e.target.value); onFilterChange(); });
  document.getElementById("f-precio-max").addEventListener("input", (e) => { filterState.precioMax = e.target.value === "" ? null : Number(e.target.value); onFilterChange(); });
  document.getElementById("f-piso-min").addEventListener("input", (e) => { filterState.pisoMin = e.target.value === "" ? null : Number(e.target.value); onFilterChange(); });
  document.getElementById("f-piso-max").addEventListener("input", (e) => { filterState.pisoMax = e.target.value === "" ? null : Number(e.target.value); onFilterChange(); });

  document.getElementById("btn-reset").addEventListener("click", () => {
    filterState = { tipo: "", barrio: "", servicio: "", precioMin: null, precioMax: null, pisoMin: null, pisoMax: null, sort: "random" };
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

wireFilters();
loadAndRender();
setInterval(loadAndRender, CONFIG.REFRESH_INTERVAL_MS);
