const { SQSClient } = require('@aws-sdk/client-sqs');
const { configuracionAws } = require('./aws');

const sqs = new SQSClient(configuracionAws(['AWS_SQS_QUEUE_NAME']));

module.exports = { sqs, queueName: process.env.AWS_SQS_QUEUE_NAME };
