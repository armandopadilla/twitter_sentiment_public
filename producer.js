/**
 * Data producer.
 * Source is Twitter Stream random sample with only english tweets.
 * Does NOT filter by country...yet.
 */

const Twitter = require('twitter');
const AWS = require('aws-sdk');

const client = new Twitter({
  consumer_key: 'CONSUMER_KEY',
  consumer_secret: 'CONSUMER_SECRET',
  access_token_key: 'ACCESS_TOKEN_KEY',
  access_token_secret: 'ACCESS_TOKEN_SECRET'
})

const kinesis = new AWS.Kinesis({
  accessKeyId: 'AWS_ACCESS_KEY',
  secretAccessKey: 'AWS_SECRET_ACCESS_KEY',
  region: 'us-east-1'
});


const AWS_KINESIS_STREAM = 'YOUR_TWITTER_STREAM_NAME';

client.stream('statuses/sample', {language: 'en'}, function(stream){
  stream.on('data', function(event) {

    const text = event.text;

    // Save to kinesis.
    const params = {
      Data: text,
      StreamName: AWS_KINESIS_STREAM,
      PartitionKey: 'YOUR_PARTITION_KEY',
    }

    kinesis.putRecord(params, function (err, data) {
      if (err) throw err;
    })
  })

  stream.on('error', function(e) {
    throw e;
  })
})