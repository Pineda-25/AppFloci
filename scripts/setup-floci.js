const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');
const { DescribeTableCommand, CreateTableCommand, waitUntilTableExists } = require('@aws-sdk/client-dynamodb');
const { GetQueueUrlCommand, CreateQueueCommand } = require('@aws-sdk/client-sqs');
const { LambdaClient, GetFunctionConfigurationCommand, CreateFunctionCommand, UpdateFunctionConfigurationCommand } = require('@aws-sdk/client-lambda');
const { s3, bucket } = require('../src/config/s3');
const { dynamodb, table } = require('../src/config/dynamodb');
const { sqs, queueName } = require('../src/config/sqs');

const endpoint = new URL(process.env.AWS_ENDPOINT_URL);
if (endpoint.protocol !== 'http:' || !['localhost', '127.0.0.1', 'localhost.floci.io'].includes(endpoint.hostname)) {
  throw new Error('setup:floci solo admite un endpoint local de Floci por HTTP.');
}
const lambda = new LambdaClient({
  endpoint: endpoint.href,
  region: process.env.AWS_REGION,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
});
const functionName = 'revision-comprobantes';

async function setup() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`S3: bucket '${bucket}' ya existe.`);
  } catch (error) {
    if (!['NotFound', 'NoSuchBucket', '404'].includes(error.name) && error.$metadata?.httpStatusCode !== 404) throw error;
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`S3: bucket '${bucket}' creado.`);
  }

  try {
    await dynamodb.send(new DescribeTableCommand({ TableName: table }));
    console.log(`DynamoDB: tabla '${table}' ya existe.`);
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') throw error;
    await dynamodb.send(new CreateTableCommand({ TableName: table, AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }], KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }], BillingMode: 'PAY_PER_REQUEST' }));
    console.log(`DynamoDB: tabla '${table}' creada.`);
  }
  await waitUntilTableExists({ client: dynamodb, maxWaitTime: 30 }, { TableName: table });

  try {
    await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
    console.log(`SQS: cola '${queueName}' ya existe.`);
  } catch (error) {
    if (!['QueueDoesNotExist', 'AWS.SimpleQueueService.NonExistentQueue'].includes(error.name)) throw error;
    await sqs.send(new CreateQueueCommand({ QueueName: queueName }));
    console.log(`SQS: cola '${queueName}' creada.`);
  }

  const ip = execFileSync('docker', ['inspect', 'floci', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'], { encoding: 'utf8' }).trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) throw new Error('No se pudo obtener una dirección IPv4 del contenedor floci.');
  const lambdaEndpoint = `http://${ip}:4566`;
  let configuration;
  try {
    configuration = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: functionName }));
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') throw error;
  }

  if (!configuration) {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'appfloci-lambda-'));
    try {
      const zipPath = path.join(tempDir, 'revision.zip');
      execFileSync('zip', ['-j', '-q', zipPath, path.join(__dirname, '..', 'lambda', 'revision', 'index.js')]);
      await lambda.send(new CreateFunctionCommand({
        FunctionName: functionName, Runtime: 'nodejs20.x', Handler: 'index.handler',
        Role: 'arn:aws:iam::000000000000:role/lambda-role', Timeout: 30,
        Code: { ZipFile: readFileSync(zipPath) },
        Environment: { Variables: { AWS_DYNAMODB_TABLE: table, FLOCI_ENDPOINT_URL: lambdaEndpoint } }
      }));
      console.log(`Lambda: función '${functionName}' creada.`);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  } else {
    const variables = configuration.Environment?.Variables || {};
    if (variables.AWS_DYNAMODB_TABLE !== table || variables.FLOCI_ENDPOINT_URL !== lambdaEndpoint || configuration.Timeout !== 30) {
      await lambda.send(new UpdateFunctionConfigurationCommand({ FunctionName: functionName, Timeout: 30, Environment: { Variables: { ...variables, AWS_DYNAMODB_TABLE: table, FLOCI_ENDPOINT_URL: lambdaEndpoint } } }));
      console.log(`Lambda: configuración de '${functionName}' actualizada.`);
    } else {
      console.log(`Lambda: función '${functionName}' ya existe.`);
    }
  }
  console.log('Recursos de Floci preparados. La conexión automática SQS → Lambda aún está pendiente.');
}

setup().catch((error) => {
  console.error(`No se pudo preparar Floci: ${error.message || error.name}`);
  if (error.errors) for (const cause of error.errors) console.error(`Detalle: ${cause.message || cause.name}`);
  process.exitCode = 1;
});
