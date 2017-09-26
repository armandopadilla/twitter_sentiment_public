const express = require('express');
const sentiment = require('sentiment');
const AWS = require('aws-sdk');
const moment = require('moment');
const async = require('async');
const Twitter = require('twitter');

const TWITTER_CONSUMER_KEY = 'TWITTER_CONSUMER_KEY';
const TWITTER_SECRET = 'TWITTER_SECRET';
const TWITTER_ACCESS_TOKEN_KEY = 'TWITTER_ACCESS_TOKEN_KEY';
const TWITTER_ACCESS_TOKEN_SECRET = 'TWITTER_ACCESS_TOKEN_SECRET';

const AWS_KINESIS_ACCESS_KEY_ID = 'AWS_KINESIS_ACCESS_KEY_ID';
const AWS_KINESIS_SECRET_ACCESS_KEY = 'AWS_KINESIS_SECRET_ACCESS_KEY';
const AWS_KINESIS_REGION = 'us-east-1';
const AWS_KINESIS_STREAMNAME = 'AWS_KINESIS_STREAMNAME';

const app = express();

app.use(express.static('views'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));
app.set('view engine', 'ejs');

const client = new Twitter({
  consumer_key: TWITTER_CONSUMER_KEY,
  consumer_secret: TWITTER_SECRET,
  access_token_key: TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: TWITTER_ACCESS_TOKEN_SECRET,
})

const kinesis = new AWS.Kinesis({
  accessKeyId: AWS_KINESIS_ACCESS_KEY_ID,
  secretAccessKey: AWS_KINESIS_SECRET_ACCESS_KEY,
  region: AWS_KINESIS_REGION,
});


var params = {
  StreamName: AWS_KINESIS_STREAMNAME
}


/**
 * Load the dashboard.
 *
 */
app.get('/', (req, res) => {});


/**
 * Fetch the live data.
 *
 */
app.get('/data', (req, res) => {

  const nextShardIterator = req.query.nextIterator || null;

  getNextIterator(nextShardIterator).then((shardIterator) => {
    params = { ShardIterator: shardIterator }

    kinesis.getRecords(params, (err, data) => {
      if (err) throw err;

      // Grab sentiment.
      var avgMood = 0;
      if (data.Records) {
        data.Records.forEach((record) => {
          const content = record.Data.toString();
          var mood = sentiment(content).score;

          if (mood >= 0) mood += 1;
          if (mood < 0) mood = mood-1;

          avgMood += mood;
        });
      }

      if (data.Records.length != 0) avgMood = avgMood/data.Records.length;

      // Get the next iterator.
      if (!data.NextShardIterator) {
        shardIterator = null;
      }  else {
        shardIterator = data.NextShardIterator;
      }

      res.status(200).json({
        nextIterator: shardIterator,
        Mood: avgMood
      })
    })
  })
})

const getNextIterator = (nextIterator) => {
  return new Promise((resolve, reject) => {
    if (nextIterator !== 'null') return resolve(nextIterator)

    var params = {
      ShardId: 'SHARD_ID',
      StreamName: AWS_KINESIS_STREAMNAME,
      ShardIteratorType: 'LATEST'
    }

    kinesis.getShardIterator(params, (err, data) => {
      if (err) return reject(err);
      return resolve(data.ShardIterator);
    });

  })
}

app.listen(3000, () => {
  console.log('Dashboard running on 3000')
})