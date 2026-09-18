// ─────────────────────────────────────────────────────────────
// Menú compartido (☰) — se inyecta en todas las páginas del sitio.
// Usa rutas ABSOLUTAS desde la raíz del repo (/catalogo/...) para que
// funcione igual sin importar qué tan "profunda" esté la página actual.
// Si el repo alguna vez cambia de nombre, este es el único lugar a ajustar.
// ─────────────────────────────────────────────────────────────
const SITE_LINKS = [
  { href: "/catalogo/inicio/", label: "Inicio" },
  { href: "/catalogo/", label: "Inventario" },
  { href: "/catalogo/solicitudes/", label: "Solicitudes" },
  { href: "/catalogo/consulta/", label: "¿Buscas algo específico?" },
];

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

renderSiteNav();
