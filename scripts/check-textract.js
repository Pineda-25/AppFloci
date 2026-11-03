const { readFile } = require('node:fs/promises');
const { DetectDocumentTextCommand } = require('@aws-sdk/client-textract');
const { textract } = require('../src/config/textract');

async function checkTextract() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    throw new Error('Indica la ruta de una imagen JPG o PNG: npm run check:textract -- ruta/imagen.jpg');
  }

  const image = await readFile(imagePath);
  const response = await textract.send(new DetectDocumentTextCommand({ Document: { Bytes: image } }));
  console.log(JSON.stringify(response, null, 2));
}

checkTextract().catch((error) => {
  console.error(`No se pudo analizar la imagen: ${error.message || error.name}`);
  if (error.cause) console.error(`Causa: ${error.cause.message || error.cause.name}`);
  if (error.errors) {
    for (const cause of error.errors) {
      console.error(`Detalle: ${cause.message || cause.name}`);
    }
  }
  if (error.$metadata?.httpStatusCode) {
    console.error(`Estado HTTP: ${error.$metadata.httpStatusCode}`);
  }
  process.exitCode = 1;
});
