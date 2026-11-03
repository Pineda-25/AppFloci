const form = document.querySelector('#form-comprobante');
const message = document.querySelector('#mensaje-formulario');
const button = form.querySelector('button[type="submit"]');
const list = document.querySelector('#lista-comprobantes');
const listMessage = document.querySelector('#mensaje-lista');
const jsonDialog = document.querySelector('#dialogo-json');
const jsonContent = document.querySelector('#contenido-json');
document.querySelector('#cerrar-json').addEventListener('click', () => jsonDialog.close());

async function showResult(id) {
  jsonContent.textContent = 'Cargando resultado...';
  jsonDialog.showModal();
  try {
    const response = await fetch(`/api/comprobantes/${encodeURIComponent(id)}/resultado`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el resultado.');
    jsonContent.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    jsonContent.textContent = `Error: ${error.message}`;
  }
}

async function deleteComprobante(id) {
  if (!window.confirm('¿Deseas eliminar este comprobante y su imagen?')) return;
  try {
    const response = await fetch(`/api/comprobantes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo eliminar el comprobante.');
    await loadComprobantes();
    listMessage.textContent = data.mensaje;
  } catch (error) {
    listMessage.textContent = `Error: ${error.message}`;
  }
}

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
      const resultButton = document.createElement('button');
      resultButton.type = 'button';
      resultButton.textContent = 'Ver JSON';
      resultButton.addEventListener('click', () => showResult(comprobante.id));
      actions.append(' ', resultButton);
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.textContent = 'Eliminar';
      deleteButton.addEventListener('click', () => deleteComprobante(comprobante.id));
      actions.append(' ', deleteButton);
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
    message.textContent = `${data.mensaje} Identificador: ${data.id}${data.aviso ? ` ${data.aviso}` : ''}`;
    form.reset();
    await loadComprobantes();
  } catch (error) {
    message.textContent = `Error: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
