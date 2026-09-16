function normalizeHeader(h) {
  return (h || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
function findCol(headers, ...keywords) {
  return headers.findIndex((h) => keywords.some((k) => h.includes(k)));
}
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatCOP(value) {
  if (!value) return "$0";
  return "$" + Math.round(value).toLocaleString("es-CO");
}

async function fetchSolicitudes() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/Solicitudes!A1:J200?key=${CONFIG.API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Error HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.values || [];
}

function rowsToSolicitudes(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(normalizeHeader);
  const col = {
    tipoOperacion: findCol(headers, "operacion"),
    tipoInmueble: findCol(headers, "tipo inmueble", "tipoinmueble"),
    zona: findCol(headers, "zona"),
    presupuestoMin: findCol(headers, "min"),
    presupuestoMax: findCol(headers, "max"),
    habitaciones: findCol(headers, "habitacion"),
    notas: findCol(headers, "nota"),
    estado: findCol(headers, "estado"),
    // "Cliente" existe en el Sheet pero deliberadamente no se lee aquí:
    // no debe mostrarse en la página pública.
  };

  return values
    .slice(1)
    .filter((row) => row.some((c) => c && c.trim && c.trim() !== ""))
    .map((row) => ({
      tipoOperacion: (row[col.tipoOperacion] || "").trim(),
      tipoInmueble: (row[col.tipoInmueble] || "Inmueble").trim(),
      zona: (row[col.zona] || "").trim(),
      presupuestoMin: parseFloat(row[col.presupuestoMin]) || 0,
      presupuestoMax: parseFloat(row[col.presupuestoMax]) || 0,
      habitaciones: (row[col.habitaciones] || "").trim(),
      notas: (row[col.notas] || "").trim(),
      estado: (row[col.estado] || "").trim(),
    }))
    .filter((s) => s.estado.toLowerCase() !== "cerrada");
}

function isArriendo(op) { return (op || "").toLowerCase().includes("arriendo"); }

function whatsappTextFor(s) {
  const lineas = [
    `Busco 🔍${s.tipoInmueble.toUpperCase()} para ${isArriendo(s.tipoOperacion) ? "ARRIENDO" : "COMPRA"}:`,
    "",
    `•⁠ Sector: ${s.zona || "Cualquiera"}`,
  ];
  if (s.habitaciones) lineas.push(`•⁠ ${s.habitaciones} alcobas`);
  if (s.notas) lineas.push(`•⁠ ${s.notas}`);
  lineas.push("");
  lineas.push(`Precio: entre ${formatCOP(s.presupuestoMin)} y ${formatCOP(s.presupuestoMax)}${isArriendo(s.tipoOperacion) ? " mensual" : ""}.`);
  return lineas.join("\n");
}

function cardHtml(s, i) {
  const badgeClass = isArriendo(s.tipoOperacion) ? "arriendo" : "";
  const detalle = [s.zona, s.habitaciones ? `${s.habitaciones} hab.` : "", s.notas].filter(Boolean).join(" · ");
  return `
    <article class="solicitud-card">
      <span class="solicitud-tag ${badgeClass}">${isArriendo(s.tipoOperacion) ? "Arriendo" : "Compra"}</span>
      <h3 class="solicitud-titulo">${escapeHtml(s.tipoInmueble)}</h3>
      <p class="solicitud-precio">${formatCOP(s.presupuestoMin)} – ${formatCOP(s.presupuestoMax)}${isArriendo(s.tipoOperacion) ? " /mes" : ""}</p>
      <p class="solicitud-detalle">${escapeHtml(detalle)}</p>
      <button type="button" class="solicitud-copy" data-i="${i}">Copiar para WhatsApp</button>
    </article>
  `;
}

let solicitudesData = [];

async function cargarSolicitudes() {
  try {
    const values = await fetchSolicitudes();
    solicitudesData = rowsToSolicitudes(values);
    document.getElementById("solicitudes-loading").hidden = true;

    const grid = document.getElementById("solicitudes-grid");
    grid.innerHTML = solicitudesData.map(cardHtml).join("");
    document.getElementById("solicitudes-empty").hidden = solicitudesData.length > 0;

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
  } catch (err) {
    console.error(err);
    document.getElementById("solicitudes-loading").hidden = false;
    document.getElementById("solicitudes-loading").textContent = "No se pudo cargar: " + err.message;
  }
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
cargarSolicitudes();
setInterval(cargarSolicitudes, CONFIG.REFRESH_INTERVAL_MS || 60000);
