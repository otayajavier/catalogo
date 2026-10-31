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
  { href: SITE_BASE, label: "Inventario" },
  { href: SITE_BASE + "solicitudes/", label: "Solicitudes" },
  { href: SITE_BASE + "credito/", label: "Calculadora de crédito" },
  { href: SITE_BASE + "consulta/", label: "¿Buscas algo específico?" },
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

function renderSiteNav() {
  const root = document.getElementById("site-nav-root");
  if (!root) return;

  const currentPath = window.location.pathname.replace(/\/index\.html$/, "/");

  root.innerHTML = `
    <button type="button" class="site-nav-toggle" id="site-nav-toggle" aria-label="Abrir menú" aria-expanded="false">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <div class="site-nav-panel" id="site-nav-panel" hidden>
      <nav>
        ${SITE_LINKS.map(
          (l) => `<a href="${l.href}" class="${currentPath === l.href ? "active" : ""}">${l.label}</a>`
        ).join("")}
      </nav>
    </div>
    <div class="site-nav-backdrop" id="site-nav-backdrop" hidden></div>
  `;

  const toggle = document.getElementById("site-nav-toggle");
  const panel = document.getElementById("site-nav-panel");
  const backdrop = document.getElementById("site-nav-backdrop");

  function abrir() {
    panel.hidden = false;
    backdrop.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
  }
  function cerrar() {
    panel.hidden = true;
    backdrop.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", () => (panel.hidden ? abrir() : cerrar()));
  backdrop.addEventListener("click", cerrar);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });

  // Se oculta al bajar (para no tapar filtros pegados arriba) y reaparece
  // al subir, o cerca del tope de la página.
  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (y > lastY && y > 80) toggle.classList.add("site-nav-toggle-hidden");
    else toggle.classList.remove("site-nav-toggle-hidden");
    lastY = y;
  }, { passive: true });
}

// ─────────────────────────────────────────────────────────────
// Marca: logo (o monograma con iniciales) + nombre, al inicio del
// encabezado de cada página. Se configura en js/config.js.
// ─────────────────────────────────────────────────────────────
function renderBrand() {
  const inner = document.querySelector(".topbar-inner");
  if (!inner || typeof CONFIG === "undefined" || !CONFIG.MARCA_NOMBRE) return;

  const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const iniciales = CONFIG.MARCA_NOMBRE.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const logo = CONFIG.LOGO_URL
    ? `<img class="brand-logo" src="${esc(CONFIG.LOGO_URL)}" alt="">`
    : `<span class="brand-mono" aria-hidden="true">${esc(iniciales)}</span>`;

  const brand = document.createElement("a");
  brand.className = "brand";
  brand.href = SITE_LINKS[0].href;
  brand.innerHTML = `${logo}<span class="brand-text"><strong>${esc(CONFIG.MARCA_NOMBRE)}</strong>${CONFIG.MARCA_FRASE ? `<span>${esc(CONFIG.MARCA_FRASE)}</span>` : ""}</span>`;
  inner.prepend(brand);
}

aplicarColoresMarca();
renderSiteNav();
renderBrand();
