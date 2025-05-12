//Revisar que productos esta añadiendo 
//Cuanto mas link mas llamadas son? esto implica mas probabilidad que bloqueo por parte de amazon?
//Pasar esto a otras tiendas
//Poder poner comandos desde el grupo para que el bot muestre lo que hay disponible actualmente (no se si es posible)

const puppeteer = require('puppeteer');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const buscarProductosAuto = require('./buscar_productos_tienda');

const TELEGRAM_BOT_TOKEN = '7720982135:AAFWomlulmpiUSUIQ6BSbrXW7s0FBlKSJMg';
const TELEGRAM_CHAT_ID = '-4763913178';
const ESTADOS_PATH = path.join(__dirname, 'stock_status.json');

const XLSX = require('xlsx');

function cargarProductosDesdeExcel(path = './productos.xlsx') {
  const workbook = XLSX.readFile(path);
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

  return data.map(row => ({
    nombre: row.nombre,
    url: row.url
  }));
}

async function scrapeStock(listaProductos) {
const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/opt/render/project/.render/chrome/opt/google/chrome/google-chrome',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
});




  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  const resultados = [];

  for (const producto of listaProductos) {
    console.log(`🔎 Revisando ${producto.nombre}`);
    try {
      await page.goto(producto.url, { waitUntil: 'networkidle2', timeout: 60000 });

      const disponible = await page.evaluate(() => {
        const buyBtn = document.getElementById('buy-now-button') || document.getElementById('add-to-cart-button');
        const sinStockText = document.body.innerText.toLowerCase().includes("no disponible");
        return buyBtn && !sinStockText;
      });

      resultados.push({
        nombre: producto.nombre,
        url: producto.url,
        disponible
      });
    } catch (err) {
      console.error(`❌ Error al revisar ${producto.nombre}:`, err.message);
      resultados.push({
        nombre: producto.nombre,
        url: producto.url,
        disponible: false
      });
    }
  }

  await browser.close();
  return resultados;
}

function cargarEstadoAnterior() {
  try {
    return JSON.parse(fs.readFileSync(ESTADOS_PATH));
  } catch (e) {
    return {};
  }
}

function guardarEstadoActual(estados) {
  fs.writeFileSync(ESTADOS_PATH, JSON.stringify(estados, null, 2));
}

async function sendToTelegram(producto) {
  const status = producto.disponible ? "✅ *Disponible*" : "❌ *No disponible*";
  const mensaje = `${status}\n[${producto.nombre}](${producto.url})`;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: mensaje,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    }),
  });

  console.log(`📢 Notificado: ${producto.nombre} - ${status}`);
}

async function comprobarYNotificar() {
  const estadoAnterior = cargarEstadoAnterior();
  const nuevosEstados = {};

  const todosLosProductos = cargarProductosDesdeExcel();
  const resultados = await scrapeStock(todosLosProductos);

  for (const producto of resultados) {
    const anterior = estadoAnterior[producto.url];
    nuevosEstados[producto.url] = producto.disponible;

    const icono = producto.disponible ? "✅" : "❌";
    console.log(`📦 ${producto.nombre} → ${icono} ${producto.disponible ? "Disponible" : "No disponible"}`);

    // Enviar siempre para pruebas
    await sendToTelegram(producto);

    // 👉 Restaurar lógica original si lo deseas
    /*
    if (anterior === undefined) continue;
    if (!anterior && producto.disponible) {
      await sendToTelegram(producto);
    }
    */
  }

  guardarEstadoActual(nuevosEstados);
}

// 🔁 Ejecutar cada minuto (ajusta según necesidad)
cron.schedule('*/1 * * * *', () => {
  console.log("⏱️ Ejecutando comprobación con comparación de estado...");
  comprobarYNotificar().catch(err => console.error("❌ Error:", err));
});
