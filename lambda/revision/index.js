exports.handler = async (event) => {
  console.log('Evento recibido:', JSON.stringify(event));

  return {
    mensaje: 'La función de revisión está disponible.',
    evento: event
  };
};
