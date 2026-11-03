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

La pantalla actual es una base inicial; los servicios y el formulario se incorporarán en los siguientes pasos.

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
