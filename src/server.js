require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('node:path');

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.post('/api/comprobantes/verificar', upload.single('imagen'), (req, res) => {
  const { tipo, fecha, usuario, tienda, observacion = '' } = req.body;
  if (!['boleta', 'factura'].includes(tipo) || !fecha || !usuario?.trim() ||
      !['Chincha', 'Pisco', 'Ica'].includes(tienda)) {
    return res.status(400).json({ error: 'Completa los campos obligatorios con valores válidos.' });
  }

  const image = req.file?.buffer;
  const isJpeg = image?.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  const isPng = image?.length >= 8 && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isJpeg && !isPng) {
    return res.status(400).json({ error: 'Adjunta una imagen JPG o PNG válida.' });
  }

  res.json({ mensaje: 'Datos recibidos correctamente. Aún no se han guardado.', comprobante: { tipo, fecha, usuario: usuario.trim(), tienda, observacion }, imagen: { nombre: req.file.originalname, tamano: req.file.size } });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'La imagen no debe superar 5 MB.' : 'No se pudo recibir el archivo.' });
  }
  console.error(error);
  res.status(500).json({ error: 'Ocurrió un error al recibir el comprobante.' });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(port, () => {
  console.log(`AppFloci disponible en http://localhost:${port}`);
});
