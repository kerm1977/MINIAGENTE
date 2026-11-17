/* Herramientas de la plantilla: QR, gráficos y PWA (descargas desde la API). */
function _descargar(blob, nombre) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function _postArchivo(url, payload, nombre) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    alert(data.error || "Error " + r.status);
    return;
  }
  _descargar(await r.blob(), nombre);
}

function descargarQR(fmt) {
  const texto = document.getElementById("qrTexto").value.trim();
  if (!texto) { alert("Escribe un texto o enlace"); return; }
  const ruta = fmt === "svg" ? "qrsvg" : "qr";
  _postArchivo("/api/export/" + ruta, { content: texto, title: "qr" }, "qr." + fmt);
}

function descargarGrafico() {
  const etiquetas = document.getElementById("grafEtiquetas").value
    .split(",").map((s) => s.trim()).filter(Boolean);
  const valores = document.getElementById("grafValores").value
    .split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
  if (!etiquetas.length || !valores.length) {
    alert("Pon al menos una etiqueta y un valor numérico");
    return;
  }
  const fmt = document.getElementById("grafFormato").value;
  _postArchivo("/api/graficos", {
    tipo: document.getElementById("grafTipo").value,
    titulo: document.getElementById("grafTitulo").value || "Gráfico",
    etiquetas,
    series: [{ nombre: "Serie 1", valores }],
    formato: fmt,
  }, "grafico." + fmt);
}
