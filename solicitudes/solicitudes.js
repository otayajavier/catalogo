function normalizeHeader(h) {
  return (h || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
function findCol(headers, ...keywords) {
  return headers.findIndex((h) => keywords.some((k) => h.includes(k)));
}
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }

async function fetchSolicitudes() {
  // Pestaña real: "Requerimientos" (no "Solicitudes")
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/Requerimientos!A1:J300?key=${CONFIG.API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Error HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.values || [];
}

// Interpreta fechas cortas tipo "15/9" o "15/9/2026" (sin año = año actual,
// o el anterior si esa fecha todavía no ha pasado este año)
function parseFechaCorta(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const hoy = new Date();
  let anio = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : hoy.getFullYear();
  let fecha = new Date(anio, Number(mo) - 1, Number(d));
  if (!y && fecha > hoy) fecha = new Date(anio - 1, Number(mo) - 1, Number(d));
  return isNaN(fecha) ? null : fecha;
}

function haceCuanto(fecha) {
  if (!fecha) return "";
  const dias = Math.round((new Date() - fecha) / 86400000);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Hace 1 día";
  if (dias < 30) return `Hace ${dias} días`;
  return "Hace más de un mes";
}

function rowsToSolicitudes(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(normalizeHeader);
  const col = {
    tipo: findCol(headers, "tipo"),
    barrios: findCol(headers, "barrio"),
    zona: findCol(headers, "zona"),
    presupuesto: findCol(headers, "presup"),
    formaPago: findCol(headers, "forma de pago", "forma pago"),
    entidad: findCol(headers, "entidad"),
    observaciones: findCol(headers, "observacion"),
    ultimoContacto: findCol(headers, "contacto"),
    estado: findCol(headers, "estado"), // opcional — puede no existir todavía
    // "Cliente" y "Teléfono" existen en el Sheet pero deliberadamente NO se
    // leen aquí: nunca deben mostrarse en la página.
  };

  return values
    .slice(1)
    .filter((row) => row.some((c) => c && c.trim && c.trim() !== ""))
    .map((row) => ({
      tipo: (row[col.tipo] || "Inmueble").trim(),
      barrios: (row[col.barrios] || "").trim(),
      zona: (row[col.zona] || "").trim(),
      presupuesto: parseFloat(row[col.presupuesto]) || 0,
      formaPago: (row[col.formaPago] || "").trim(),
      entidad: (row[col.entidad] || "").trim(),
      observaciones: (row[col.observaciones] || "").trim(),
      fechaContacto: parseFechaCorta(row[col.ultimoContacto]),
      estado: col.estado > -1 ? (row[col.estado] || "").trim() : "",
    }))
    // Si algún día agregas una columna "Estado", esto oculta las "Cerrada".
    // Mientras no exista esa columna, se muestran todas.
    .filter((s) => s.estado.toLowerCase() !== "cerrada");
}

function cardHtml(s, i) {
  const detalleZona = [s.barrios, s.zona].filter(Boolean).join(" · ");
  const pago = s.formaPago && s.entidad ? `${s.formaPago} · ${s.entidad}` : s.formaPago;
  const actualizado = haceCuanto(s.fechaContacto);

  return `
    <article class="solicitud-card">
      <span class="solicitud-tag">Busco para Compra</span>
      <h3 class="solicitud-titulo">${escapeHtml(s.tipo)}</h3>
      ${s.presupuesto ? `<p class="solicitud-precio">Presupuesto: $${s.presupuesto}M</p>` : ""}
      ${detalleZona ? `<p class="solicitud-detalle"><strong>Zona:</strong> ${escapeHtml(detalleZona)}</p>` : ""}
      ${pago ? `<p class="solicitud-detalle"><strong>Pago:</strong> ${escapeHtml(pago)}</p>` : ""}
      ${s.observaciones ? `<p class="solicitud-obs">${escapeHtml(s.observaciones)}</p>` : ""}
      <div class="solicitud-actions">
        <a class="solicitud-whatsapp track-contact" data-tipo="${escapeAttr(s.tipo)}" data-barrio="${escapeAttr(s.barrios)}" data-price="${s.presupuesto * 1e6}" href="#" data-i="${i}">Tengo un inmueble para esto →</a>
        <button type="button" class="solicitud-copy" data-i="${i}">Copiar para WhatsApp</button>
      </div>
      ${actualizado ? `<span class="solicitud-fecha">${actualizado}</span>` : ""}
    </article>
  `;
}

function emojiFormaPago(formaPago) {
  const f = (formaPago || "").toLowerCase();
  if (f.includes("credito") || f.includes("crédito")) return "💳";
  if (f.includes("contado")) return "💵";
  return "";
}

function whatsappTextFor(s) {
  const lineas = [
    `Busco 🔍${s.tipo.toUpperCase()} para COMPRA:`,
    "",
    `•⁠ Sector: ${s.barrios || s.zona || "Cualquiera"}`,
  ];
  if (s.formaPago) lineas.push(`•⁠ ${s.formaPago}${s.entidad ? " " + s.entidad : ""} ${emojiFormaPago(s.formaPago)}`.trim());
  if (s.observaciones) lineas.push(`•⁠ ${s.observaciones}`);
  lineas.push("");
  if (s.presupuesto) lineas.push(`Precio: $${s.presupuesto} millones.`);
  lineas.push("");
  lineas.push("Ver más solicitudes");
  lineas.push(`👉 https://otayajavier.github.io/catalogo/solicitudes/`);
  return lineas.join("\n");
}

function mensajeTengoInmueble(s) {
  return `Hola, tengo un inmueble que podría servir para esta solicitud: ${s.tipo} en ${s.barrios || s.zona}, presupuesto ~$${s.presupuesto}M.`;
}

let solicitudesData = [];
let filterState = { search: "", formaPago: "", presupuestoMin: null, presupuestoMax: null };

function fillSelect(id, values, placeholder) {
  const el = document.getElementById(id);
  const current = el.value;
  el.innerHTML = `<option value="">${placeholder}</option>` + values.map((v) => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join("");
  if (values.includes(current)) el.value = current;
}

function applyFilters(data) {
  return data.filter((s) => {
    if (filterState.formaPago && s.formaPago !== filterState.formaPago) return false;
    if (filterState.presupuestoMin != null && s.presupuesto < filterState.presupuestoMin) return false;
    if (filterState.presupuestoMax != null && s.presupuesto > filterState.presupuestoMax) return false;
    if (filterState.search) {
      const hay = `${s.tipo} ${s.barrios} ${s.zona} ${s.formaPago} ${s.entidad} ${s.observaciones}`.toLowerCase();
      if (!hay.includes(filterState.search.toLowerCase())) return false;
    }
    return true;
  });
}

function renderSolicitudes() {
  const filtradas = applyFilters(solicitudesData);
  const grid = document.getElementById("solicitudes-grid");
  grid.innerHTML = filtradas.map((s) => cardHtml(s, solicitudesData.indexOf(s))).join("");
  document.getElementById("solicitudes-empty").hidden = filtradas.length > 0;
  wireCardButtons(grid);

  const banner = document.getElementById("solicitudes-banner");
  banner.hidden = false;
  banner.textContent = `🔍 ${solicitudesData.length} solicitud${solicitudesData.length === 1 ? "" : "es"} habilitada${solicitudesData.length === 1 ? "" : "s"}${filtradas.length !== solicitudesData.length ? ` — ${filtradas.length} coinciden con tu búsqueda` : ""}`;
}

function wireCardButtons(grid) {
  grid.querySelectorAll(".solicitud-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const texto = whatsappTextFor(solicitudesData[Number(btn.dataset.i)]);
      try {
        await navigator.clipboard.writeText(texto);
      } catch {
        const tmp = document.createElement("textarea");
        tmp.value = texto;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand("copy");
        document.body.removeChild(tmp);
      }
      const original = btn.textContent;
      btn.textContent = "¡Copiado!";
      setTimeout(() => { btn.textContent = original; }, 1800);
    });
  });

  grid.querySelectorAll(".solicitud-whatsapp").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const s = solicitudesData[Number(link.dataset.i)];
      trackPixel("Contact", {
        content_name: `${link.dataset.tipo} en ${link.dataset.barrio}`,
        value: Number(link.dataset.price) || undefined,
        currency: "COP",
      });
      const href = whatsappConfigured()
        ? `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(mensajeTengoInmueble(s))}`
        : "#";
      setTimeout(() => { window.location.href = href; }, 300);
    });
  });
}

function closeAllPopovers() {
  document.querySelectorAll(".pill-popover").forEach((p) => { p.hidden = true; });
  document.querySelectorAll(".pill-toggle").forEach((b) => b.setAttribute("aria-expanded", "false"));
}

function togglePopover(pillId, popoverId) {
  const popover = document.getElementById(popoverId);
  const pillBtn = document.getElementById(pillId);
  const wasHidden = popover.hidden;
  closeAllPopovers();
  if (!wasHidden) return;
  const rect = pillBtn.getBoundingClientRect();
  popover.style.top = `${rect.bottom + 8}px`;
  popover.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 240))}px`;
  popover.hidden = false;
  pillBtn.setAttribute("aria-expanded", "true");
}

function wireFilters() {
  document.getElementById("s-search").addEventListener("input", (e) => { filterState.search = e.target.value; renderSolicitudes(); });
  document.getElementById("s-forma-pago").addEventListener("change", (e) => { filterState.formaPago = e.target.value; renderSolicitudes(); });
  document.getElementById("s-presupuesto-min").addEventListener("input", (e) => { filterState.presupuestoMin = e.target.value === "" ? null : Number(e.target.value); renderSolicitudes(); });
  document.getElementById("s-presupuesto-max").addEventListener("input", (e) => { filterState.presupuestoMax = e.target.value === "" ? null : Number(e.target.value); renderSolicitudes(); });
  document.getElementById("pill-presupuesto").addEventListener("click", () => togglePopover("pill-presupuesto", "popover-presupuesto"));
  document.querySelectorAll(".popover-done").forEach((btn) => btn.addEventListener("click", closeAllPopovers));
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".pill-popover-wrap")) closeAllPopovers();
  });
  document.getElementById("s-reset").addEventListener("click", () => {
    filterState = { search: "", formaPago: "", presupuestoMin: null, presupuestoMax: null };
    document.getElementById("s-search").value = "";
    document.getElementById("s-forma-pago").value = "";
    document.getElementById("s-presupuesto-min").value = "";
    document.getElementById("s-presupuesto-max").value = "";
    renderSolicitudes();
  });
}

async function cargarSolicitudes() {
  try {
    const values = await fetchSolicitudes();
    solicitudesData = rowsToSolicitudes(values);
    document.getElementById("solicitudes-loading").hidden = true;
    fillSelect("s-forma-pago", [...new Set(solicitudesData.map((s) => s.formaPago).filter(Boolean))].sort(), "Forma de pago");
    renderSolicitudes();
  } catch (err) {
    console.error(err);
    document.getElementById("solicitudes-loading").hidden = false;
    document.getElementById("solicitudes-loading").textContent = "No se pudo cargar: " + err.message;
  }
}

function whatsappConfigured() {
  return CONFIG.WHATSAPP_NUMBER && CONFIG.WHATSAPP_NUMBER !== "PEGA_AQUI_TU_NUMERO";
}

function trackPixel(event, params) {
  if (typeof fbq !== "function") return;
  const eventId = window.crypto && crypto.randomUUID ? crypto.randomUUID() : "ev-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  fbq("track", event, params || {}, { eventID: eventId });
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

function setupWhatsappFloat() {
  const el = document.getElementById("whatsapp-float");
  if (!el || !CONFIG.WHATSAPP_NUMBER || CONFIG.WHATSAPP_NUMBER === "PEGA_AQUI_TU_NUMERO") return;
  el.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent("Hola, tengo un inmueble que podría servir para una de las solicitudes del tablero.")}`;
  el.hidden = false;
}

initMetaPixelIfConfigured();
setupWhatsappFloat();
wireFilters();
cargarSolicitudes();
setInterval(cargarSolicitudes, CONFIG.REFRESH_INTERVAL_MS || 60000);
