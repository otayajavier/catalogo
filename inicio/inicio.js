// ─────────────────────────────────────────────────────────────
// Portada: buscador, cifras, destacados y zonas.
// Lee el mismo espejo público que el catálogo (solo lectura).
// ─────────────────────────────────────────────────────────────
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
  el.href = whatsappHref(CONFIG.WHATSAPP_MESSAGE);
  el.hidden = false;
}

const $ = (id) => document.getElementById(id);

// ── Textos que dependen del config ──────────────────────────────
function aplicarConfig() {
  if (CONFIG.AGENTE_COLEGAS) document.querySelectorAll("[data-colegas]").forEach((el) => { el.textContent = CONFIG.AGENTE_COLEGAS; });

  if (CONFIG.FOTO_AGENTE_URL) {
    $("inicio-foto").src = rutaSitio(CONFIG.FOTO_AGENTE_URL);
    $("inicio-foto").alt = CONFIG.MARCA_NOMBRE || "";
    $("foto-nombre").textContent = CONFIG.MARCA_NOMBRE || "";
    $("foto-cargo").textContent = [CONFIG.AGENTE_CARGO, CONFIG.AGENTE_ANIOS ? CONFIG.AGENTE_ANIOS + " años de experiencia" : ""].filter(Boolean).join(" · ");
    $("hero-foto").hidden = false;
    document.querySelector(".hero").classList.add("con-foto");
  }

  const cifras = [];
  if (CONFIG.AGENTE_ANIOS) cifras.push([String(CONFIG.AGENTE_ANIOS), "años de experiencia"]);
  if (CONFIG.AGENTE_TRANSACCIONES) cifras.push(["+" + CONFIG.AGENTE_TRANSACCIONES, "transacciones acompañadas" + (CONFIG.AGENTE_ANIO_REFERENCIA ? " en " + CONFIG.AGENTE_ANIO_REFERENCIA : "")]);
  if (CONFIG.AGENTE_COLEGAS) cifras.push(["+" + CONFIG.AGENTE_COLEGAS, "colegas e inmobiliarias en mi red de respaldo"]);
  if (cifras.length) {
    $("cifras-inner").innerHTML = cifras.map((c) => `<div class="cifra"><strong>${esc(c[0])}</strong><span>${esc(c[1])}</span></div>`).join("");
    $("cifras").hidden = false;
  }
}

// ── Buscador ────────────────────────────────────────────────────
const PRECIOS = {
  venta: [["", "Sin límite"], ["500", "$500 millones"], ["350", "$350 millones"], ["250", "$250 millones"]],
  arriendo: [["", "Sin límite"], ["4", "$4 millones / mes"], ["3", "$3 millones / mes"], ["2", "$2 millones / mes"]],
};

function pintarPrecios(modo) {
  const sel = $("b-precio");
  const opciones = PRECIOS[modo] || PRECIOS.venta;
  // La primera opción útil queda seleccionada; "Sin límite" sigue disponible.
  sel.innerHTML = opciones.map((o, i) => `<option value="${o[0]}"${i === 1 ? " selected" : ""}>${o[1]}</option>`).join("");
}

function iniciarBuscador() {
  const zonas = CONFIG.ZONAS_DESTACADAS || [];
  $("b-zona").innerHTML = `<option value="">Todas las zonas</option>` + zonas.map((z) => `<option value="${esc(z)}">${esc(z)}</option>`).join("");
  pintarPrecios("venta");
  document.querySelectorAll('input[name="servicio"]').forEach((r) => r.addEventListener("change", () => pintarPrecios(r.value)));

  // Los campos vacíos no viajan en la URL del catálogo.
  $("buscador").addEventListener("submit", () => {
    $("buscador").querySelectorAll("select").forEach((s) => { if (s.value === "") s.disabled = true; });
  });
  // Si la persona vuelve con "atrás", se reactivan.
  window.addEventListener("pageshow", () => $("buscador").querySelectorAll("select").forEach((s) => { s.disabled = false; }));
}

// ── Datos del espejo ────────────────────────────────────────────
function norm(h) { return (h || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); }
function slug(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function cop(raw) { const c = String(raw || "").replace(/[^\d]/g, ""); return c ? parseInt(c, 10) : 0; }
function fmt(v) { return v ? "$" + Math.round(v).toLocaleString("es-CO") : "Consultar precio"; }

async function cargarInmuebles() {
  if (!CONFIG.API_KEY || /^PENDIENTE|^PEGA_AQUI/.test(CONFIG.API_KEY) || !CONFIG.SPREADSHEET_ID || /^PENDIENTE/.test(CONFIG.SPREADSHEET_ID)) return [];
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.RANGE)}?key=${CONFIG.API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const values = (await res.json()).values || [];
  if (values.length < 2) return [];
  const h = values[0].map(norm);
  const idx = (...ks) => h.findIndex((x) => ks.some((k) => x.includes(k)));
  const c = {
    id: h.findIndex((x) => x === "id"), tipo: idx("tipo"), barrio: idx("barrio", "zona"),
    precio: h.findIndex((x) => x.includes("precio") && !x.includes("arriendo")), canon: idx("canon", "arriendo"),
    area: idx("area"), hab: idx("habitacion"), banos: idx("bano"), parq: idx("parqueadero"),
    estado: idx("estado"), servicio: idx("servicio"), credito: idx("credito"), fotos: idx("fotos", "foto"), imagen: idx("imagen"),
  };
  const cel = (r, i) => (i > -1 ? String(r[i] || "").trim() : "");
  return values.slice(1)
    .filter((r) => r.some((x) => x && String(x).trim()))
    .map((r) => {
      const fotos = cel(r, c.fotos).split(/[\s,]+/).filter(Boolean);
      const foto = cel(r, c.imagen) || fotos[0] || "";
      const servicio = cel(r, c.servicio);
      const arriendo = /arriendo/i.test(servicio) && !/venta/i.test(servicio);
      const precio = cop(r[c.precio]); const canon = cop(r[c.canon]);
      return {
        id: cel(r, c.id), tipo: cel(r, c.tipo) || "Inmueble", barrio: cel(r, c.barrio) || "Cali",
        arriendo, monto: arriendo && canon ? canon : (precio || canon), sufijo: arriendo && canon ? " / mes" : "",
        area: parseFloat(r[c.area]) || 0, hab: parseInt(r[c.hab], 10) || 0, banos: parseInt(r[c.banos], 10) || 0,
        parq: cel(r, c.parq), estado: cel(r, c.estado), credito: /^s[ií]$/i.test(cel(r, c.credito)), foto,
      };
    })
    .filter((l) => !l.estado || /disponible/i.test(l.estado));
}

function tarjeta(l) {
  const catalogId = [slug(l.tipo), slug(l.barrio), l.id].filter(Boolean).join("-").replace(/-+/g, "-");
  const href = l.id ? `../?ver=${encodeURIComponent(catalogId)}` : "../";
  const meta = [
    l.hab ? `<span>${l.hab} hab.</span>` : "", l.banos ? `<span>${l.banos} baños</span>` : "",
    l.area ? `<span>${l.area} m²</span>` : "",
    l.parq && l.parq.toLowerCase() !== "no" ? `<span>${esc(l.parq)} parq.</span>` : "",
  ].join("");
  return `
    <a class="d-card" href="${href}">
      <div class="d-foto">
        ${l.foto ? `<img src="${esc(l.foto)}" alt="${esc(l.tipo)} en ${esc(l.barrio)}" loading="lazy">` : ""}
        <span class="d-badge ${l.arriendo ? "arriendo" : "venta"}">${l.arriendo ? "Arriendo" : "Venta"}</span>
      </div>
      <div class="d-cuerpo">
        <div class="d-fila"><strong class="d-precio">${fmt(l.monto)}<small>${l.sufijo}</small></strong>${l.credito ? `<span class="d-credito">Aplica crédito</span>` : ""}</div>
        <h3>${esc(l.tipo)} en ${esc(l.barrio)}</h3>
        <div class="d-meta">${meta}</div>
        <span class="d-ver">Ver ficha completa →</span>
      </div>
    </a>`;
}

function pintarDestacados(lista) {
  const conFoto = lista.filter((l) => l.foto);
  const base = conFoto.length >= 3 ? conFoto : lista;
  // Orden al azar en cada visita, para que todos los inmuebles tengan vitrina.
  const mezcla = base.map((l) => [Math.random(), l]).sort((a, b) => a[0] - b[0]).map((p) => p[1]).slice(0, 3);
  if (!mezcla.length) return;
  $("destacados").innerHTML = mezcla.map(tarjeta).join("");
  $("bloque-destacados").hidden = false;
}

function pintarZonas(lista) {
  const zonas = (CONFIG.ZONAS_DESTACADAS || []).map((z) => {
    const n = lista.filter((l) => slug(l.barrio) === slug(z)).length;
    return { nombre: z, n };
  });
  if (!zonas.length) return;
  const otros = lista.length - zonas.reduce((a, z) => a + z.n, 0);
  const items = zonas.concat(otros > 0 ? [{ nombre: "Otras zonas del sur", n: otros, todas: true }] : []);
  $("zonas").innerHTML = items.map((z) => `
    <a class="zona" href="${z.todas ? "../" : "../?q=" + encodeURIComponent(z.nombre)}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
      <strong>${esc(z.nombre)}</strong>
      <span>${z.n} ${z.n === 1 ? "inmueble" : "inmuebles"}</span>
    </a>`).join("");
  $("bloque-zonas").hidden = false;
}

async function cargarPortada() {
  try {
    const lista = await cargarInmuebles();
    pintarDestacados(lista);
    pintarZonas(lista);
  } catch (err) {
    console.error(err); // la portada funciona sin los datos en vivo
  }
}

initMetaPixelIfConfigured();
setupWhatsappFloat();
aplicarConfig();
iniciarBuscador();
cargarPortada();
