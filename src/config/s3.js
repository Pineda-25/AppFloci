require('dotenv').config();

const { S3Client } = require('@aws-sdk/client-s3');

const required = ['AWS_REGION', 'AWS_ENDPOINT_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
}

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  forcePathStyle: true
});

module.exports = { s3, bucket: process.env.AWS_S3_BUCKET };
