const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { dynamodb, table } = require('../src/config/dynamodb');

async function checkDynamoDB() {
  const response = await dynamodb.send(new DescribeTableCommand({ TableName: table }));
  console.log(`Tabla '${table}' disponible. Estado: ${response.Table.TableStatus}.`);
}

checkDynamoDB().catch((error) => {
  console.error(`No se pudo comprobar la tabla: ${error.message}`);
  process.exitCode = 1;
});
