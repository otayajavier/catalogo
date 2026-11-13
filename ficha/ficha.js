// ─────────────────────────────────────────────────────────────
// Ficha técnica neutra (para colegas). Lee la hoja pública y muestra
// el inmueble por su ID: .../ficha/?id=P0098
// Sin datos de contacto, sin marca, sin Pixel.
// ─────────────────────────────────────────────────────────────

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function seguroUrl(u) { return /^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : ""; }
function numero(v) { const d = String(v || "").replace(/[^\d]/g, ""); return d ? parseInt(d, 10) : 0; }
function cop(n) { return "$" + Math.round(n).toLocaleString("es-CO"); }

async function leerHoja() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.RANGE)}?key=${CONFIG.API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo cargar la información.");
  return (await res.json()).values || [];
}

function buscarInmueble(values, id) {
  if (values.length < 2) return null;
  const h = values[0].map(norm);
  const col = (pred) => h.findIndex(pred);
  const c = {
    tipo: col((x) => x === "tipo"),
    barrio: col((x) => x.includes("barrio") || x.includes("zona")),
    precio: col((x) => x.includes("precio") && !x.includes("arriendo")),
    canon: col((x) => x.includes("canon")),
    area: col((x) => x.startsWith("area")),
    habitaciones: col((x) => x.includes("habitacion")),
    banos: col((x) => x.includes("bano")),
    parqueadero: col((x) => x.includes("parqueadero")),
    piso: col((x) => x.includes("piso")),
    estrato: col((x) => x.includes("estrato")),
    estado: col((x) => x === "estado"),
    servicio: col((x) => x === "servicio"),
    credito: col((x) => x.includes("credito")),
    imagen: col((x) => x.startsWith("imagen")),
    fotos: col((x) => x.includes("fotos")),
    id: col((x) => x === "id"),
    descripcion: col((x) => x.startsWith("observacion") || x.startsWith("descripcion")),
    captacion: col((x) => x.startsWith("captacion")),
  };
  if (c.id < 0) return null;
  const buscado = norm(id);
  const fila = values.slice(1).find((r) => norm(r[c.id]) === buscado);
  if (!fila) return null;
  const g = (k) => (c[k] >= 0 ? String(fila[c[k]] || "").trim() : "");
  const fotos = [g("imagen"), ...g("fotos").split(/[\s,]+/)].map((u) => seguroUrl(u)).filter((u, i, a) => u && a.indexOf(u) === i);
  return {
    id: g("id"), tipo: g("tipo") || "Inmueble", barrio: g("barrio"), precio: numero(g("precio")), canon: numero(g("canon")),
    area: g("area"), habitaciones: g("habitaciones"), banos: g("banos"), parqueadero: g("parqueadero"), piso: g("piso"),
    estrato: g("estrato"), estado: g("estado"), servicio: g("servicio"), credito: g("credito"),
    descripcion: g("descripcion"), captacion: g("captacion"), fotos,
  };
}

function noDisponible() {
  document.title = "Ficha no disponible";
  document.getElementById("ficha").innerHTML =
    '<div class="estado"><h1>Esta ficha ya no está disponible</h1><p>El inmueble ya no se encuentra en oferta.</p></div>';
}

function textoCredito(v) {
  const n = norm(v);
  if (!n) return "";
  if (/^(si|sí|aplica)/.test(n) || n.includes("aplica credito")) return "Aplica crédito";
  if (/^no/.test(n) || n.includes("contado")) return "Solo contado";
  return v;
}

function pintar(inm) {
  const negocio = /arriendo/i.test(inm.servicio) && !/venta/i.test(inm.servicio) ? "Arriendo"
    : /venta/i.test(inm.servicio) && /arriendo/i.test(inm.servicio) ? "Venta y arriendo" : (inm.servicio || (inm.canon && !inm.precio ? "Arriendo" : "Venta"));
  const titulo = `${inm.tipo}${inm.barrio ? " en " + inm.barrio : ""}`;
  document.title = `${titulo} — Ficha técnica`;

  const datos = [
    [inm.area ? inm.area.replace(/\s*m(²|2)?$/i, "") + " m²" : "", "Área"],
    [inm.habitaciones, "Habitaciones"],
    [inm.banos, "Baños"],
    [inm.parqueadero, "Parqueadero"],
    [inm.piso, "Piso"],
    [inm.estrato, "Estrato"],
    [textoCredito(inm.credito), "Financiación"],
  ].filter((d) => String(d[0] || "").trim());

  const precios = [];
  if (inm.precio) precios.push(`<div class="precio"><div class="rotulo">Precio de venta</div><div class="valor">${cop(inm.precio)}</div></div>`);
  if (inm.canon) precios.push(`<div class="precio"><div class="rotulo">Canon mensual</div><div class="valor">${cop(inm.canon)}</div></div>`);

  const hayFotos = inm.fotos.length > 0;
  document.getElementById("ficha").innerHTML = `
    ${hayFotos ? `
      <div class="galeria">
        <img id="foto-principal" src="${esc(inm.fotos[0])}" alt="${esc(titulo)}">
        ${inm.fotos.length > 1 ? `
          <button type="button" class="gal-btn gal-ant" id="gal-ant" aria-label="Foto anterior">‹</button>
          <button type="button" class="gal-btn gal-sig" id="gal-sig" aria-label="Foto siguiente">›</button>
          <span class="gal-contador" id="gal-contador">1 / ${inm.fotos.length}</span>` : ""}
        <button type="button" class="gal-ampliar" id="gal-ampliar">Ampliar</button>
      </div>
      ${inm.fotos.length > 1 ? `<div class="miniaturas" id="miniaturas">
        ${inm.fotos.map((u, i) => `<button type="button" data-i="${i}" aria-label="Foto ${i + 1}"${i === 0 ? ' class="activa"' : ""}><img loading="lazy" src="${esc(u)}" alt=""></button>`).join("")}
      </div>` : ""}` : ""}
    <div class="cuerpo">
      <div class="etiquetas"><span class="etiqueta negocio">${esc(negocio)}</span>${inm.estrato ? `<span class="etiqueta">Estrato ${esc(inm.estrato)}</span>` : ""}</div>
      <h1 class="titulo">${esc(titulo)}</h1>
      ${precios.length ? `<div class="precios">${precios.join("")}</div>` : ""}
      ${datos.length ? `<div class="datos">${datos.map((d) => `<div class="dato"><div class="v">${esc(d[0])}</div><div class="r">${esc(d[1])}</div></div>`).join("")}</div>` : ""}
      ${inm.descripcion ? `<h2>Descripción</h2><p class="descripcion">${esc(inm.descripcion)}</p>` : ""}
      <div class="pie">
        <span>Código ${esc(inm.id)} · Información sujeta a cambios sin previo aviso.</span>
        <button type="button" class="imprimir" onclick="window.print()">Imprimir o guardar PDF</button>
      </div>
    </div>`;

  if (hayFotos) activarGaleria(inm.fotos);
}

// ── Galería y visor ──────────────────────────────────────────
let fotos = [], actual = 0, visorAbierto = false;

function mostrar(i) {
  actual = (i + fotos.length) % fotos.length;
  document.getElementById("foto-principal").src = fotos[actual];
  const cont = document.getElementById("gal-contador");
  if (cont) cont.textContent = `${actual + 1} / ${fotos.length}`;
  document.querySelectorAll("#miniaturas button").forEach((b, j) => b.classList.toggle("activa", j === actual));
  if (visorAbierto) pintarVisor();
}

function pintarVisor() {
  document.getElementById("visor-img").src = fotos[actual];
  document.getElementById("visor-contador").textContent = `${actual + 1} / ${fotos.length}`;
}
function abrirVisor() { visorAbierto = true; document.getElementById("visor").hidden = false; pintarVisor(); }
function cerrarVisor() { visorAbierto = false; document.getElementById("visor").hidden = true; }

function deslizar(el, alIzq, alDer) {
  let x0 = null;
  el.addEventListener("touchstart", (e) => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 45) (dx < 0 ? alIzq : alDer)();
  });
}

function activarGaleria(lista) {
  fotos = lista;
  const principal = document.getElementById("foto-principal");
  principal.addEventListener("click", abrirVisor);
  principal.addEventListener("error", () => { principal.style.opacity = 0.3; });
  document.getElementById("gal-ampliar").addEventListener("click", abrirVisor);
  const ant = document.getElementById("gal-ant"), sig = document.getElementById("gal-sig");
  if (ant) ant.addEventListener("click", () => mostrar(actual - 1));
  if (sig) sig.addEventListener("click", () => mostrar(actual + 1));
  document.querySelectorAll("#miniaturas button").forEach((b) => b.addEventListener("click", () => mostrar(Number(b.dataset.i))));
  deslizar(principal, () => mostrar(actual + 1), () => mostrar(actual - 1));

  document.getElementById("visor-cerrar").addEventListener("click", cerrarVisor);
  document.getElementById("visor-ant").addEventListener("click", () => mostrar(actual - 1));
  document.getElementById("visor-sig").addEventListener("click", () => mostrar(actual + 1));
  document.getElementById("visor").addEventListener("click", (e) => { if (e.target.id === "visor") cerrarVisor(); });
  deslizar(document.getElementById("visor"), () => mostrar(actual + 1), () => mostrar(actual - 1));
  document.addEventListener("keydown", (e) => {
    if (!visorAbierto) return;
    if (e.key === "Escape") cerrarVisor();
    else if (e.key === "ArrowRight") mostrar(actual + 1);
    else if (e.key === "ArrowLeft") mostrar(actual - 1);
  });
  // Precargar el resto de fotos.
  fotos.slice(1).forEach((u) => { const i = new Image(); i.src = u; });
}

// ── Inicio ───────────────────────────────────────────────────
(async function () {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) { noDisponible(); return; }
  try {
    const inm = buscarInmueble(await leerHoja(), id);
    // Solo inmuebles disponibles y que no sean de colegas (esos tienen la ficha de su propio CRM).
    if (!inm || (inm.estado && !/disponible/i.test(inm.estado)) || /colega/i.test(inm.captacion)) { noDisponible(); return; }
    pintar(inm);
  } catch (e) {
    document.getElementById("ficha").innerHTML = '<div class="estado"><h1>No se pudo cargar la ficha</h1><p>Intenta de nuevo en un momento.</p></div>';
  }
})();
