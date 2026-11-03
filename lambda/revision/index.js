const { DynamoDBClient, GetItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

const table = process.env.AWS_DYNAMODB_TABLE;
const endpoint = process.env.FLOCI_ENDPOINT_URL;

exports.handler = async (event) => {
  if (!table || !endpoint) throw new Error('Faltan AWS_DYNAMODB_TABLE o FLOCI_ENDPOINT_URL.');
  if (!Array.isArray(event.Records)) throw new Error('Se esperaba un evento con Records de SQS.');

  const dynamodb = new DynamoDBClient({
    endpoint,
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    maxAttempts: 1
  });
  const batchItemFailures = [];

  for (const record of event.Records) {
    try {
      const { comprobanteId } = JSON.parse(record.body);
      if (typeof comprobanteId !== 'string' || !comprobanteId.trim()) throw new Error('Falta comprobanteId.');
      const key = { id: { S: comprobanteId } };
      console.log(`Consultando comprobante ${comprobanteId} en DynamoDB.`);
      const result = await dynamodb.send(new GetItemCommand({ TableName: table, Key: key }));
      if (!result.Item) {
        console.log(`El comprobante ${comprobanteId} ya no existe; no requiere revisión.`);
        continue;
      }
      if (!result.Item.resultadoJson?.S) throw new Error('El comprobante no tiene resultado de Textract.');
      JSON.parse(result.Item.resultadoJson.S);
      await dynamodb.send(new UpdateItemCommand({
        TableName: table,
        Key: key,
        UpdateExpression: 'SET #estado = :estado',
        ConditionExpression: 'attribute_exists(id)',
        ExpressionAttributeNames: { '#estado': 'estado' },
        ExpressionAttributeValues: { ':estado': { S: 'Necesita revisión' } }
      }));
      console.log(`Comprobante ${comprobanteId} marcado para revisión humana.`);
    } catch (error) {
      console.error(`No se pudo procesar el mensaje ${record.messageId}:`, error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
