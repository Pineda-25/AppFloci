const form = document.querySelector('#form-comprobante');
const message = document.querySelector('#mensaje-formulario');
const button = form.querySelector('button[type="submit"]');

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
  } catch (error) {
    message.textContent = `Error: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
