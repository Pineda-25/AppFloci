const { HeadBucketCommand } = require('@aws-sdk/client-s3');
const { s3, bucket } = require('../src/config/s3');

async function checkS3() {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`Conexión correcta: el bucket '${bucket}' está disponible.`);
}

checkS3().catch((error) => {
  console.error(`No se pudo comprobar el bucket: ${error.message}`);
  process.exitCode = 1;
});
