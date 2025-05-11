const puppeteer = require('puppeteer');

const TIENDA_POKEMON_URL = 'https://www.amazon.es/stores/page/B6BBCF35-68EA-4F2C-8440-227644DCBAF1';
const SECCION_PROHIBIDA = '9DAE367E-008E-4F93-8D0A-6F556F2F77A0';

async function buscarProductosAuto() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  console.log("🔍 Escaneando tienda Pokémon...");
  await page.goto(TIENDA_POKEMON_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  const productos = [];

  // 🚀 1. Escanear la página principal
  console.log(`➡️ Visitando página principal de la tienda...`);
  await autoScroll(page);
  const principales = await extraerProductos(page, 'Página principal');
  productos.push(...principales);

  // 🚀 2. Buscar subsecciones
  const secciones = await page.evaluate((SECCION_PROHIBIDA) => {
    const links = Array.from(document.querySelectorAll('a[href*="/stores/page/"]'));
    const urls = links.map(a => a.href.split('?')[0]);
    return [...new Set(
      urls.filter(url =>
        url.includes("B6BBCF35-68EA-4F2C-8440-227644DCBAF1") &&
        !url.includes(SECCION_PROHIBIDA)
      )
    )];
  }, SECCION_PROHIBIDA);

  console.log(`📄 Secciones encontradas: ${secciones.length}`);

  for (const seccion of secciones) {
    console.log(`➡️ Visitando sección: ${seccion}`);
    await page.goto(seccion, { waitUntil: 'networkidle2', timeout: 60000 });

    await autoScroll(page);
    const nuevos = await extraerProductos(page, seccion);
    productos.push(...nuevos);
  }

  await browser.close();

  const unicos = Array.from(new Map(productos.map(p => [p.url, p])).values());

  console.log(`✅ Total productos detectados: ${unicos.length}`);
  return unicos;
}

// 🔥 Función para extraer productos de una página cualquiera, ahora con LOG de nombres
// 🔥 Función para extraer productos de una página cualquiera, filtrando resultados basura
async function extraerProductos(page, nombreSeccion) {
  const productos = await page.evaluate(() => {
    const items = [];
    const cards = document.querySelectorAll('a[href*="/dp/"]');
    cards.forEach(card => {
      const title = card.innerText?.trim() || '';
      const link = card.href?.split('?')[0] || '';
      
      // Filtro extra: ignorar si el título está vacío, es muy corto o es un número
      if (
        title &&
        link &&
        title.length > 5 &&  // debe tener más de 5 caracteres
        isNaN(title)         // no debe ser solo un número
      ) {
        items.push({
          nombre: title,
          url: link
        });
      }
    });
    return items;
  });

  productos.forEach(p => {
    console.log(`   🛒 Producto encontrado en [${nombreSeccion}]: ${p.nombre}`);
  });

  console.log(`   🧩 ${productos.length} productos encontrados en esta sección.`);
  return productos;
}


// 🔥 Scroll automático para cargar todo
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

module.exports = buscarProductosAuto;
