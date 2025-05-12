#!/usr/bin/env bash
set -o errexit

# Instalar dependencias de Node.js
npm install

# Crear directorio para Chrome
mkdir -p /opt/render/project/.render/chrome

# Descargar e instalar Chrome
wget -q -O - https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb > chrome.deb
dpkg -x chrome.deb /opt/render/project/.render/chrome/
rm chrome.deb
