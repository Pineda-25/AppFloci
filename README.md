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
