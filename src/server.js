require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DetectDocumentTextCommand } = require('@aws-sdk/client-textract');
const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { PutItemCommand, ScanCommand, GetItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { GetQueueUrlCommand, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { textract } = require('./config/textract');
const { s3, bucket } = require('./config/s3');
const { dynamodb, table } = require('./config/dynamodb');
const { sqs, queueName } = require('./config/sqs');

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

    let aviso;
    try {
      const queue = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
      await sqs.send(new SendMessageCommand({ QueueUrl: queue.QueueUrl, MessageBody: JSON.stringify({ comprobanteId: id }) }));
    } catch (error) {
      console.error(`No se pudo enviar a revisión el comprobante ${id}:`, error);
      aviso = 'El comprobante se guardó, pero no se pudo enviar a la cola de revisión.';
    }

    return res.status(201).json({ mensaje: 'Comprobante guardado correctamente.', aviso, id, comprobante, imagen: { ...imagen, bucket, key }, resultado });
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

app.get('/api/comprobantes/:id/imagen', async (req, res) => {
  const record = await dynamodb.send(new GetItemCommand({ TableName: table, Key: { id: { S: req.params.id } } }));
  if (!record.Item?.imagenKey?.S || !record.Item?.imagenBucket?.S) {
    return res.status(404).json({ error: 'No se encontró la imagen del comprobante.' });
  }
  const image = await s3.send(new GetObjectCommand({ Bucket: record.Item.imagenBucket.S, Key: record.Item.imagenKey.S }));
  res.type(image.ContentType || 'application/octet-stream');
  image.Body.on('error', (error) => res.destroy(error));
  image.Body.pipe(res);
});

app.get('/api/comprobantes/:id/resultado', async (req, res) => {
  const record = await dynamodb.send(new GetItemCommand({ TableName: table, Key: { id: { S: req.params.id } } }));
  if (!record.Item?.resultadoJson?.S) {
    return res.status(404).json({ error: 'No se encontró el resultado del comprobante.' });
  }
  res.json(JSON.parse(record.Item.resultadoJson.S));
});

app.delete('/api/comprobantes/:id', async (req, res) => {
  const key = { id: { S: req.params.id } };
  const record = await dynamodb.send(new GetItemCommand({ TableName: table, Key: key }));
  if (!record.Item) return res.status(404).json({ error: 'No se encontró el comprobante.' });
  if (!record.Item.imagenBucket?.S || !record.Item.imagenKey?.S) {
    return res.status(500).json({ error: 'El comprobante no tiene una referencia de imagen válida.' });
  }
  await s3.send(new DeleteObjectCommand({ Bucket: record.Item.imagenBucket.S, Key: record.Item.imagenKey.S }));
  await dynamodb.send(new DeleteItemCommand({ TableName: table, Key: key }));
  res.json({ mensaje: 'Comprobante eliminado correctamente.' });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'La imagen no debe superar 5 MB.' : 'No se pudo recibir el archivo.' });
  }
  console.error(`Error en ${req.method} ${req.path}:`, error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'No se pudo completar la operación. Revisa que Floci esté disponible.' });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(port, () => {
  console.log(`AppFloci disponible en http://localhost:${port}`);
});
