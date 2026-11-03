const { GetQueueUrlCommand } = require('@aws-sdk/client-sqs');
const { sqs, queueName } = require('../src/config/sqs');

async function checkSqs() {
  const response = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
  console.log(`Cola '${queueName}' disponible: ${response.QueueUrl}`);
}

checkSqs().catch((error) => {
  console.error(`No se pudo comprobar la cola: ${error.message || error.name}`);
  if (error.errors) {
    for (const cause of error.errors) console.error(`Detalle: ${cause.message || cause.name}`);
  }
  process.exitCode = 1;
});
