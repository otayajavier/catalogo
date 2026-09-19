// ─────────────────────────────────────────────────────────────
// Referencias vigentes para Cali, 2026 (SMMLV $1.750.905).
// ACTUALIZAR cada enero cuando se decrete el nuevo SMMLV.
// ─────────────────────────────────────────────────────────────
const SMMLV_2026 = 1750905;
const TOPE_VIS_CALI = 150 * SMMLV_2026;   // $262.635.750 — Cali es "ciudad principal"
const TOPE_VIP = 90 * SMMLV_2026;          // $157.581.450
const LIMITE_CUOTA_INGRESO = { vis: 0.40, novis: 0.30 }; // Ley de Vivienda
const CUOTA_INICIAL_MINIMA = { vis: 20, novis: 30 }; // % mínimo exigido por tipo de vivienda

const DOCS_EMPLEADO = [
  "Cédula de ciudadanía (ampliada al 150%)",
  "Certificación laboral reciente (cargo, salario, antigüedad)",
  "Últimos 3 desprendibles de pago",
  "Declaración de renta del último año (o carta de no declarante)",
];
const DOCS_INDEPENDIENTE = [
  "Cédula de ciudadanía",
  "RUT vigente",
  "Declaración de renta de los últimos 2 años",
  "Certificado de ingresos de contador público",
  "Extractos bancarios de los últimos 6-12 meses",
];

function formatCOP(v) {
  if (!v || isNaN(v)) return "$0";
  return "$" + Math.round(v).toLocaleString("es-CO");
}

function tasaMensual(tasaEA) {
  return Math.pow(1 + tasaEA / 100, 1 / 12) - 1;
}

function cuotaMensual(monto, tasaEA, plazoAnios) {
  const i = tasaMensual(tasaEA);
  const n = plazoAnios * 12;
  if (monto <= 0 || n <= 0) return 0;
  if (i === 0) return monto / n;
  return (monto * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

// Formatea con puntos de miles mientras la persona escribe (ej. "225000000"
// se ve como "225.000.000"), para que sea más fácil leer el número que se
// está escribiendo. El campo queda como texto; se limpia al leerlo.
function formatearNumeroInput(el) {
  el.addEventListener("input", () => {
    const soloDigitos = el.value.replace(/\D/g, "");
    el.value = soloDigitos ? Number(soloDigitos).toLocaleString("es-CO") : "";
  });
}

function leerNumeroFormateado(id) {
  const raw = document.getElementById(id).value.replace(/\D/g, "");
  return Number(raw) || 0;
}

function leerFormulario() {
  return {
    valor: leerNumeroFormateado("c-valor"),
    tipoVivienda: document.querySelector('input[name="tipoVivienda"]:checked').value,
    cuotaInicialPct: Number(document.getElementById("c-cuota-inicial").value) || 0,
    plazo: Number(document.getElementById("c-plazo").value) || 20,
    tasa: Number(document.getElementById("c-tasa").value) || 0,
    tipoTrabajador: document.querySelector('input[name="tipoTrabajador"]:checked').value,
    ingreso: leerNumeroFormateado("c-ingreso"),
  };
}

function actualizarTagAutomatico(valor) {
  const tag = document.getElementById("credito-auto-tag");
  if (!valor) { tag.hidden = true; return; }
  tag.hidden = false;
  if (valor <= TOPE_VIP) tag.textContent = "Calificaría como VIP";
  else if (valor <= TOPE_VIS_CALI) tag.textContent = "Calificaría como VIS";
  else tag.textContent = "Por precio, sería No VIS";
}

function aplicarMinimoCuotaInicial() {
  const tipo = document.querySelector('input[name="tipoVivienda"]:checked').value;
  const minimo = CUOTA_INICIAL_MINIMA[tipo];
  document.getElementById("credito-cuota-minima-hint").textContent =
    `Mínimo exigido para ${tipo === "vis" ? "VIS/VIP" : "No VIS"}: ${minimo}%`;

  const campo = document.getElementById("c-cuota-inicial");
  if (Number(campo.value) < minimo) campo.value = minimo;
}

function calcularYRenderizar() {
  const d = leerFormulario();
  actualizarTagAutomatico(d.valor);

  const emptyState = document.getElementById("credito-empty-state");
  const resultContent = document.getElementById("credito-resultado-content");
  const bloqueo = document.getElementById("credito-cuota-bloqueo");

  if (d.valor <= 0) {
    emptyState.hidden = false;
    resultContent.hidden = true;
    bloqueo.hidden = true;
    return;
  }
  emptyState.hidden = true;

  // No se calcula nada si la cuota inicial no cumple el mínimo exigido para
  // el tipo de vivienda — mostrar un número ahí sería engañoso.
  const minimoActual = CUOTA_INICIAL_MINIMA[d.tipoVivienda];
  if (d.cuotaInicialPct < minimoActual) {
    resultContent.hidden = true;
    bloqueo.hidden = false;
    bloqueo.textContent = `⚠️ La cuota inicial mínima para vivienda ${d.tipoVivienda === "vis" ? "VIS/VIP" : "No VIS"} es ${minimoActual}%. Ajusta el valor para ver el cálculo.`;
    return;
  }
  bloqueo.hidden = true;
  resultContent.hidden = false;

  const cuotaInicialValor = d.valor * (d.cuotaInicialPct / 100);
  const montoFinanciar = Math.max(0, d.valor - cuotaInicialValor);
  const cuota = cuotaMensual(montoFinanciar, d.tasa, d.plazo);
  const limite = LIMITE_CUOTA_INGRESO[d.tipoVivienda];

  document.getElementById("c-cuota-mensual").textContent = formatCOP(cuota) + " /mes";
  document.getElementById("c-monto-financiar").textContent = formatCOP(montoFinanciar);
  document.getElementById("c-valor-cuota-inicial").textContent = formatCOP(cuotaInicialValor);

  const ingresoMinimo = limite > 0 ? cuota / limite : 0;
  document.getElementById("c-ingreso-minimo").textContent = ingresoMinimo ? formatCOP(ingresoMinimo) : "—";

  const cumplimiento = document.getElementById("credito-cumplimiento");
  const relacionEl = document.getElementById("c-relacion");

  if (d.ingreso > 0) {
    const relacion = (cuota / d.ingreso) * 100;
    relacionEl.textContent = relacion.toFixed(1) + "%";
    cumplimiento.hidden = false;
    if (relacion <= limite * 100) {
      cumplimiento.className = "credito-cumplimiento ok";
      cumplimiento.textContent = `✅ Cumple la Ley de Vivienda (máximo ${(limite * 100).toFixed(0)}% para ${d.tipoVivienda === "vis" ? "VIS" : "No VIS"}).`;
    } else {
      cumplimiento.className = "credito-cumplimiento no-ok";
      cumplimiento.textContent = `⚠️ Supera el ${(limite * 100).toFixed(0)}% recomendado para ${d.tipoVivienda === "vis" ? "VIS" : "No VIS"} — probablemente necesitarías más cuota inicial, más plazo, o mayor ingreso.`;
    }
  } else {
    relacionEl.textContent = "—";
    cumplimiento.hidden = true;
  }

  document.getElementById("credito-independiente-nota").hidden = d.tipoTrabajador !== "independiente";

  const docsList = document.getElementById("credito-docs-list");
  const docs = d.tipoTrabajador === "independiente" ? DOCS_INDEPENDIENTE : DOCS_EMPLEADO;
  docsList.innerHTML = docs.map((doc) => `<li>${doc}</li>`).join("");

  const wa = document.getElementById("credito-whatsapp");
  if (CONFIG.WHATSAPP_NUMBER && CONFIG.WHATSAPP_NUMBER !== "PEGA_AQUI_TU_NUMERO") {
    const msg = `Hola, hice una simulación de crédito: inmueble de ${formatCOP(d.valor)}, cuota estimada ${formatCOP(cuota)}/mes a ${d.plazo} años. Quiero que me ayudes a validarlo.`;
    wa.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    wa.hidden = false;
  }
}

function preseleccionarTipoVivienda(valor) {
  if (!valor) return;
  if (valor <= TOPE_VIS_CALI) document.getElementById("c-vis").checked = true;
  else document.getElementById("c-novis").checked = true;
  actualizarTasaSugerida();
  aplicarMinimoCuotaInicial();
}

function actualizarTasaSugerida() {
  const esVis = document.querySelector('input[name="tipoVivienda"]:checked').value === "vis";
  document.getElementById("c-tasa").value = esVis ? 12.5 : 14;
}

function wireForm() {
  const form = document.getElementById("credito-form");
  form.addEventListener("input", calcularYRenderizar);
  form.addEventListener("change", calcularYRenderizar);

  formatearNumeroInput(document.getElementById("c-valor"));
  formatearNumeroInput(document.getElementById("c-ingreso"));

  document.getElementById("c-plazo").addEventListener("input", (e) => {
    document.getElementById("c-plazo-value").textContent = e.target.value;
  });

  document.getElementById("c-valor").addEventListener("input", () => {
    preseleccionarTipoVivienda(leerNumeroFormateado("c-valor"));
  });

  document.querySelectorAll('input[name="tipoVivienda"]').forEach((r) => {
    r.addEventListener("change", () => {
      actualizarTasaSugerida();
      aplicarMinimoCuotaInicial();
    });
  });
}

function precargarDesdeURL() {
  const p = new URLSearchParams(window.location.search);
  const valor = p.get("valor");
  if (valor) {
    document.getElementById("c-valor").value = Number(valor).toLocaleString("es-CO");
    preseleccionarTipoVivienda(Number(valor));
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

initMetaPixelIfConfigured();
wireForm();
precargarDesdeURL();
aplicarMinimoCuotaInicial();
calcularYRenderizar();
