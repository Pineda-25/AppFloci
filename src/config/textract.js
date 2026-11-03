const { TextractClient } = require('@aws-sdk/client-textract');
const { configuracionAws } = require('./aws');

const textract = new TextractClient(configuracionAws());

module.exports = { textract };
