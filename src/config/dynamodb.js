const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { configuracionAws } = require('./aws');

const dynamodb = new DynamoDBClient(configuracionAws(['AWS_DYNAMODB_TABLE']));

module.exports = { dynamodb, table: process.env.AWS_DYNAMODB_TABLE };
