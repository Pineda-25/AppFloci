const { S3Client } = require('@aws-sdk/client-s3');
const { configuracionAws } = require('./aws');

const s3 = new S3Client({
  ...configuracionAws(['AWS_S3_BUCKET']),
  forcePathStyle: true
});

module.exports = { s3, bucket: process.env.AWS_S3_BUCKET };
