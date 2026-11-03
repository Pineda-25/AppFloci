# AppFloci

Aplicación web para automatizar la gestión de comprobantes usando Express y servicios de AWS emulados con Floci. El proyecto se construirá paso a paso.

## Servicios previstos

- Textract: análisis simulado de los comprobantes.
- S3: almacenamiento de imágenes.
- DynamoDB: almacenamiento de los datos y el resultado del análisis.
- SQS: cola de tareas de revisión.
- Lambda: procesamiento de las tareas de revisión.

## Requisitos

- Node.js y npm.
- Docker y Floci para las etapas de integración con AWS.

## Ejecutar la aplicación

```bash
npm install
cp .env.example .env
npm run dev
```

Abrir <http://localhost:3000>. Para detener el servidor, pulsar Ctrl+C en la terminal. `npm start` permite iniciarlo sin reinicio automático.

El formulario registra comprobantes en Textract, S3 y DynamoDB. La tabla muestra los registros y permite abrir su imagen, consultar el JSON y eliminar el comprobante junto con su imagen.

Después de guardar un registro, la aplicación envía su identificador a SQS para su revisión. Si falla el envío, el comprobante permanece guardado y se muestra un aviso; la conexión automática de Lambda se incorporará después.

## Comprobar S3 en Floci

Inicia Floci y crea el bucket indicado en `.env` si todavía no existe:

```bash
floci start
env AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1 \
  aws --endpoint-url http://localhost:4566 s3 mb s3://appfloci-comprobantes
```

Después, ejecuta `npm run check:s3` para comprobar la conexión. Las credenciales de ejemplo son para el emulador local; no publiques credenciales reales ni el archivo `.env`.

## Comprobar DynamoDB en Floci

Crea la tabla indicada en `.env` si todavía no existe:

```bash
env AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1 \
  aws --endpoint-url http://localhost:4566 dynamodb create-table \
  --table-name comprobantes \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Ejecuta `npm run check:dynamodb` para comprobar la conexión y el estado de la tabla.

## Probar Textract en Floci

Con Floci iniciado, indica la ruta de una imagen JPG o PNG:

```bash
npm run check:textract -- /ruta/a/imagen.jpg
```

El comando muestra la respuesta JSON de la operación `DetectDocumentText`. En Floci el análisis puede ser simulado; no se debe asumir que el texto devuelto corresponde a la imagen.

## Comprobar SQS en Floci

Crea la cola indicada en `.env` si todavía no existe:

```bash
env AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1 \
  aws --endpoint-url http://localhost:4566 sqs create-queue \
  --queue-name revision-comprobantes
```

Ejecuta `npm run check:sqs` para comprobar que la cola esté disponible.

## Probar Lambda en Floci

La función inicial confirma que Lambda puede ejecutarse; todavía no procesa la cola ni revisa comprobantes. Con Floci iniciado, crea la función si no existe:

```bash
zip -j /tmp/appfloci-revision.zip lambda/revision/index.js
env AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1 \
  aws --endpoint-url http://localhost:4566 lambda create-function \
  --function-name revision-comprobantes --runtime nodejs20.x \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --handler index.handler --zip-file fileb:///tmp/appfloci-revision.zip
```

Para ejecutarla con un evento de prueba:

```bash
env AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1 \
  aws --endpoint-url http://localhost:4566 lambda invoke \
  --function-name revision-comprobantes --cli-binary-format raw-in-base64-out \
  --payload '{"prueba":"Hola Lambda"}' /tmp/appfloci-respuesta-lambda.json
cat /tmp/appfloci-respuesta-lambda.json
```
