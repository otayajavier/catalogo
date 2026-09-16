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
  el.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(CONFIG.WHATSAPP_MESSAGE || "Hola, quiero más información.")}`;
  el.hidden = false;
}

initMetaPixelIfConfigured();
setupWhatsappFloat();
