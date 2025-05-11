// run.js
const express = require('express');
const app = express();
const comprobarYNotificar = require('./scraper').comprobarYNotificar;

app.get('/run', async (req, res) => {
  try {
    await comprobarYNotificar();
    res.send("✅ Bot ejecutado correctamente.");
  } catch (e) {
    console.error("❌ Error en ejecución manual:", e);
    res.status(500).send("❌ Error ejecutando el bot.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
