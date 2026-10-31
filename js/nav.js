// ─────────────────────────────────────────────────────────────
// Menú compartido (☰) — se inyecta en todas las páginas del sitio.
// Las rutas se calculan desde la ubicación de este mismo archivo
// (js/nav.js), así el sitio funciona igual en la raíz de un dominio
// propio o dentro de una subcarpeta (usuario.github.io/repo/).
// ─────────────────────────────────────────────────────────────
const SITE_BASE = (() => {
  try {
    if (document.currentScript && document.currentScript.src) {
      return new URL("../", document.currentScript.src).pathname;
    }
  } catch (e) { /* usa la raíz */ }
  return "/";
})();

const SITE_LINKS = [
  { href: SITE_BASE + "inicio/", label: "Inicio" },
  { href: SITE_BASE, label: "Inmuebles" },
  { href: SITE_BASE + "credito/", label: "Crédito" },
  { href: SITE_BASE + "solicitudes/", label: "Solicitudes" },
  { href: SITE_BASE + "consulta/", label: "Busco algo específico" },
];

// Colores de la marca (opcionales, vienen de js/config.js).
function aplicarColoresMarca() {
  if (typeof CONFIG === "undefined") return;
  const root = document.documentElement.style;
  if (CONFIG.COLOR_PRIMARIO) {
    root.setProperty("--forest", CONFIG.COLOR_PRIMARIO);
    root.setProperty("--tag-venta", CONFIG.COLOR_PRIMARIO);
  }
  if (CONFIG.COLOR_PRIMARIO_OSCURO) root.setProperty("--forest-dark", CONFIG.COLOR_PRIMARIO_OSCURO);
}

const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Rutas de imagen del config: si son relativas, se resuelven desde la raíz del sitio.
function rutaSitio(url) {
  if (!url) return "";
  return /^(https?:)?\/\//.test(url) || url.charAt(0) === "/" ? url : SITE_BASE + url;
}

function whatsappHref(texto) {
  if (typeof CONFIG === "undefined" || !CONFIG.WHATSAPP_NUMBER || CONFIG.WHATSAPP_NUMBER === "PEGA_AQUI_TU_NUMERO") return "";
  return "https://wa.me/" + CONFIG.WHATSAPP_NUMBER + "?text=" + encodeURIComponent(texto || CONFIG.WHATSAPP_MESSAGE || "Hola, quiero más información.");
}

const ICONO_WA = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8.5 19L4 20z"/></svg>';

// ─────────────────────────────────────────────────────────────
// Marca (logo o monograma + nombre)
// ─────────────────────────────────────────────────────────────
function marcaHtml(claro) {
  if (typeof CONFIG === "undefined" || !CONFIG.MARCA_NOMBRE) return "";
  const iniciales = CONFIG.MARCA_NOMBRE.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const logo = CONFIG.LOGO_URL
    ? `<img class="brand-logo" src="${esc(rutaSitio(CONFIG.LOGO_URL))}" alt="">`
    : `<span class="brand-mono" aria-hidden="true">${esc(iniciales)}</span>`;
  return `<a class="brand${claro ? " brand-claro" : ""}" href="${SITE_LINKS[0].href}">${logo}<span class="brand-text"><strong>${esc(CONFIG.MARCA_NOMBRE)}</strong>${CONFIG.MARCA_FRASE ? `<span>${esc(CONFIG.MARCA_FRASE)}</span>` : ""}</span></a>`;
}

// ─────────────────────────────────────────────────────────────
// Encabezado del sitio: marca + enlaces + botón de WhatsApp.
// En celular los enlaces pasan a un menú desplegable.
// ─────────────────────────────────────────────────────────────
function renderSiteNav() {
  const root = document.getElementById("site-nav-root");
  if (!root) return;

  const currentPath = window.location.pathname.replace(/\/index\.html$/, "/");
  const wa = whatsappHref(CONFIG.WHATSAPP_MESSAGE);

  root.innerHTML = `
    <header class="sitebar">
      <div class="sitebar-inner">
        ${marcaHtml(false)}
        <nav class="sitebar-links" id="sitebar-links" aria-label="Principal">
          ${SITE_LINKS.map((l) => `<a href="${l.href}" class="${currentPath === l.href ? "active" : ""}">${l.label}</a>`).join("")}
        </nav>
        ${wa ? `<a class="sitebar-cta" id="sitebar-cta" href="${esc(wa)}" target="_blank" rel="noopener">${ICONO_WA}<span>Escríbeme</span></a>` : ""}
        <button type="button" class="sitebar-toggle" id="site-nav-toggle" aria-label="Abrir menú" aria-expanded="false" aria-controls="sitebar-links">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
        </button>
      </div>
    </header>
  `;

  const bar = root.querySelector(".sitebar");
  const toggle = document.getElementById("site-nav-toggle");
  const cerrar = () => { bar.classList.remove("abierto"); toggle.setAttribute("aria-expanded", "false"); };
  toggle.addEventListener("click", () => {
    const abierto = bar.classList.toggle("abierto");
    toggle.setAttribute("aria-expanded", abierto ? "true" : "false");
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".sitebar")) cerrar(); });

  // El botón de WhatsApp del encabezado también cuenta como contacto para el Pixel.
  const cta = document.getElementById("sitebar-cta");
  if (cta) cta.addEventListener("click", (e) => {
    if (typeof fbq === "function") { e.preventDefault(); fbq("track", "Contact", { content_name: "encabezado" }); setTimeout(() => { window.location.href = cta.href; }, 300); }
  });
}

// ─────────────────────────────────────────────────────────────
// Pie de página común (se agrega al final de cada página).
// ─────────────────────────────────────────────────────────────
function renderSiteFooter() {
  if (document.querySelector(".sitefoot") || typeof CONFIG === "undefined") return;
  const wa = whatsappHref(CONFIG.WHATSAPP_MESSAGE);
  const foot = document.createElement("footer");
  foot.className = "sitefoot";
  foot.innerHTML = `
    <div class="sitefoot-inner">
      ${marcaHtml(true)}
      <nav class="sitefoot-links" aria-label="Pie">
        ${SITE_LINKS.slice(1).map((l) => `<a href="${l.href}">${l.label}</a>`).join("")}
        ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      </nav>
    </div>
    <p class="sitefoot-nota">© ${new Date().getFullYear()} ${esc(CONFIG.MARCA_NOMBRE || "")}. Inmuebles sujetos a disponibilidad.</p>
  `;
  const flotante = document.getElementById("whatsapp-float");
  document.body.insertBefore(foot, flotante || document.body.querySelector("script"));
}

aplicarColoresMarca();
renderSiteNav();
renderSiteFooter();
