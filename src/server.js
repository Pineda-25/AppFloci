require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DetectDocumentTextCommand } = require('@aws-sdk/client-textract');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { PutItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { textract } = require('./config/textract');
const { s3, bucket } = require('./config/s3');
const { dynamodb, table } = require('./config/dynamodb');

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.post(['/api/comprobantes/verificar', '/api/comprobantes/analizar', '/api/comprobantes/probar-s3', '/api/comprobantes'], upload.single('imagen'), async (req, res) => {
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

  const comprobante = { tipo, fecha, usuario: usuario.trim(), tienda, observacion };
  const imagen = { nombre: req.file.originalname, tamano: req.file.size };

  if (req.path.endsWith('/verificar')) {
    return res.json({ mensaje: 'Datos recibidos correctamente. Aún no se han guardado.', comprobante, imagen });
  }

  const resultado = await textract.send(new DetectDocumentTextCommand({ Document: { Bytes: image } }));
  if (req.path.endsWith('/probar-s3') || req.path === '/api/comprobantes') {
    const id = randomUUID();
    const key = `comprobantes/${id}.${isJpeg ? 'jpg' : 'png'}`;
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: image, ContentType: isJpeg ? 'image/jpeg' : 'image/png' }));
    if (req.path.endsWith('/probar-s3')) {
      return res.json({ mensaje: 'Análisis recibido e imagen guardada en S3. Los datos aún no se han guardado en DynamoDB.', comprobante, imagen: { ...imagen, bucket, key }, resultado });
    }

    try {
      await dynamodb.send(new PutItemCommand({
        TableName: table,
        Item: {
          id: { S: id }, tipo: { S: tipo }, fecha: { S: fecha }, usuario: { S: usuario.trim() },
          tienda: { S: tienda }, observacion: { S: observacion }, imagenKey: { S: key },
          imagenBucket: { S: bucket }, resultadoJson: { S: JSON.stringify(resultado) },
          estado: { S: 'Pendiente' }
        },
        ConditionExpression: 'attribute_not_exists(id)'
      }));
    } catch (error) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch (cleanupError) {
        console.error(`No se pudo eliminar la imagen ${key} tras fallar DynamoDB:`, cleanupError);
      }
      throw error;
    }

    return res.status(201).json({ mensaje: 'Comprobante guardado correctamente.', id, comprobante, imagen: { ...imagen, bucket, key }, resultado });
  }
  res.json({ mensaje: 'Análisis simulado recibido. Aún no se ha guardado el comprobante.', comprobante, imagen, resultado });
});

app.get('/api/comprobantes', async (req, res) => {
  const items = [];
  let lastKey;
  do {
    const response = await dynamodb.send(new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }));
    items.push(...(response.Items || []));
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);

  res.json(items.map((item) => ({
    id: item.id?.S, tipo: item.tipo?.S, fecha: item.fecha?.S,
    usuario: item.usuario?.S, tienda: item.tienda?.S,
    observacion: item.observacion?.S || '', estado: item.estado?.S || 'Pendiente'
  })));
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
