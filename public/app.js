const form = document.querySelector('#form-comprobante');
const message = document.querySelector('#mensaje-formulario');
const button = form.querySelector('button[type="submit"]');
const list = document.querySelector('#lista-comprobantes');
const listMessage = document.querySelector('#mensaje-lista');

async function loadComprobantes() {
  try {
    const response = await fetch('/api/comprobantes');
    if (!response.ok) throw new Error('No se pudieron cargar los comprobantes.');
    const comprobantes = await response.json();
    list.replaceChildren();
    if (comprobantes.length === 0) {
      const row = list.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 7;
      cell.textContent = 'Aún no hay comprobantes registrados.';
    }
    for (const comprobante of comprobantes) {
      const row = list.insertRow();
      for (const value of [comprobante.tipo, comprobante.fecha, comprobante.usuario, comprobante.tienda, comprobante.observacion, comprobante.estado]) {
        row.insertCell().textContent = value || '';
      }
      const actions = row.insertCell();
      const preview = document.createElement('a');
      preview.href = `/api/comprobantes/${encodeURIComponent(comprobante.id)}/imagen`;
      preview.target = '_blank';
      preview.rel = 'noopener noreferrer';
      preview.textContent = 'Ver imagen';
      actions.append(preview);
    }
    listMessage.textContent = '';
  } catch (error) {
    listMessage.textContent = error.message;
  }
}

loadComprobantes();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  button.disabled = true;
  message.textContent = 'Registrando comprobante...';

  try {
    const response = await fetch('/api/comprobantes', {
      method: 'POST',
      body: new FormData(form)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo registrar el comprobante.');
    message.textContent = `${data.mensaje} Identificador: ${data.id}`;
    form.reset();
    await loadComprobantes();
  } catch (error) {
    message.textContent = `Error: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
