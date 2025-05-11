//Revisar que productos esta añadiendo 
//Cuanto mas link mas llamadas son? esto implica mas probabilidad que bloqueo por parte de amazon?
//Pasar esto a otras tiendas
//Poder poner comandos desde el grupo para que el bot muestre lo que hay disponible actualmente (no se si es posible)

const puppeteer = require('puppeteer-core');
const { executablePath } = require('puppeteer'); // <- esto importa la ruta real de Chrome
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const buscarProductosAuto = require('./buscar_productos_tienda');


const TELEGRAM_BOT_TOKEN = '7720982135:AAFWomlulmpiUSUIQ6BSbrXW7s0FBlKSJMg';
const TELEGRAM_CHAT_ID = '-4763913178';
const ESTADOS_PATH = path.join(__dirname, 'stock_status.json');

const etbPrincipales = [
  {
    nombre: "Pokémon Caja de Entrenador Élite de Escarlata y Púrpura - Juntos de Aventuras de JCC Pokémon",
    url: "https://www.amazon.es/dp/B0DT7C24XM"
  },
  {
    nombre: "Caja de Entrenador Élite - Evoluciones Prismáticas",
    url: "https://www.amazon.es/dp/B0DM6HQ8X5"
  },
  {
    nombre: "Caja de Entrenador Élite - Chispas Fulgurantes",
    url: "https://www.amazon.es/dp/B0DNNC5STT"
  },
  {
    nombre: "Caja de Ilustración Especial - Llamas Obsidianas",
    url: "https://www.amazon.es/dp/B0C64HDD6D"
  },
  {
    nombre: "Pokémon JCC: Caja de Entrenador Élite de Escarlata y Púrpura-Evoluciones en Paldea de JCC",
    url: "https://www.amazon.es/dp/B0C646BFTG"
  },
  {
    nombre: "Caja de Entrenador Élite Cartas Pokemon Corona Zenit TCG",
    url: "https://www.amazon.es/dp/B0BPYWWNJZ"
  }
];

const etbOtros = [
  {
    nombre: "Pokémon TCG: Scarlet & Violet—Temporal Forces Elite Trainer Box - Hojas de Hierro (Ingles)",
    url: "https://www.amazon.es/dp/B0CS7P4W8C"
  },
  {
    nombre: "Pokémon TCG: Scarlet & Violet—Temporal Forces Elite Trainer Box – Walking Wake (Ingles)",
    url: "https://www.amazon.es/dp/B0CS7M871R?th=1"
  },
  {
    nombre: "Lata Coleccionable - Miraidon (Scarlet & Violet) (Ingles)",
    url: "https://www.amazon.es/dp/B0BTJ9VYC6"
  },
  {
    nombre: "Caja de Entrenador Élite - Fábula Velada (Shrouded Fable) (Ingles)",
    url: "https://www.amazon.es/dp/B0D4B4SL9X"
  }
];

const coleccionesPrincipales = [
  {
    nombre: "Caja Ilustración - Scarlet & Violet Illustration Collection (Heartforcards)",
    url: "https://www.amazon.es/dp/B0DBVNGZ4R"
  },
  
];

const coleccionesOtros = [];



//const productos = [];


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



async function checkStock(producto, page) {
  await page.goto(producto.url, { waitUntil: 'networkidle2', timeout: 60000 });

  const disponible = await page.evaluate(() => {
    const buyBtn = document.getElementById('buy-now-button') || document.getElementById('add-to-cart-button');
    const sinStockText = document.body.innerText.toLowerCase().includes("no disponible");
    return buyBtn && !sinStockText;
  });

  return {
    nombre: producto.nombre,
    url: producto.url,
    disponible
  };
}

async function scrapeStock(listaProductos) {
  console.log("🧭 Ejecutable de Chrome:", executablePath());
const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: executablePath(),
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

  
  
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
  
    const resultados = [];
    for (const producto of listaProductos) {
      console.log(`🔎 Revisando ${producto.nombre}`);
      const estado = await checkStock(producto, page);
      resultados.push(estado);
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

    // 🚀 ENVIAR TODOS para pruebas:
    await sendToTelegram(producto);

    // 👇 VERSIÓN ORIGINAL (descomenta si querés volver al comportamiento anterior)
    /*
    if (anterior === undefined) {
      console.log(`🔍 Estado nuevo registrado para ${producto.nombre}`);
      continue;
    }

    if (!anterior && producto.disponible) {
      await sendToTelegram(producto);
    }
    */
  }

  guardarEstadoActual(nuevosEstados);
}


// 🔁 Ejecutar cada 1 minutos
cron.schedule('*/1 * * * *', () => {
  console.log("⏱️ Ejecutando comprobación con comparación de estado...");
  comprobarYNotificar().catch(err => console.error("❌ Error:", err));
});
