require('dotenv').config();

// Configuración compartida por los clientes que se conectan a Floci.
function configuracionAws(variablesAdicionales = []) {
  const requeridas = ['AWS_REGION', 'AWS_ENDPOINT_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', ...variablesAdicionales];
  const faltantes = requeridas.filter((nombre) => !process.env[nombre]);

  if (faltantes.length > 0) {
    throw new Error(`Faltan variables de entorno: ${faltantes.join(', ')}`);
  }

  return {
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  };
}

module.exports = { configuracionAws };
