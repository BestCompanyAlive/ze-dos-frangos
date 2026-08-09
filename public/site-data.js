// Leitura partilhada (Netlify Blobs) para as páginas do site.
// Usa o localStorage como reserva quando a função do servidor não está disponível.
async function dataGet(key) {
  try {
    var res = await fetch('/.netlify/functions/data?key=' + encodeURIComponent(key));
    if (res.ok) {
      var body = await res.json();
      if (body.value !== null && body.value !== undefined) {
        try { localStorage.setItem(key, body.value); } catch (e) {}
        return body.value;
      }
    }
  } catch (e) { /* sem ligação à função do servidor — usa o que estiver guardado localmente */ }
  return localStorage.getItem(key);
}
