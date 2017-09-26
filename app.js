const express = require('express');
const sentiment = require('sentiment');
const AWS = require('aws-sdk');
const moment = require('moment');
const async = require('async');
const Twitter = require('twitter');

const TWITTER_CONSUMER_KEY = 'XKKnUdDvAwdTXSOGIRHCw2O0g';
const TWITTER_SECRET = 'fAolKs88UNS7oapnIupL6QfNaBHrNHXdKo9DwFSWqjcu1BY6nO';
const TWITTER_ACCESS_TOKEN_KEY = '271073122-QhJhFjBAG6DDqk4lw2tt62pAr7b23SuC3WYxFwb6';
const TWITTER_ACCESS_TOKEN_SECRET = 'uoki8YRkkEMYPW63uzzowc3JeexTZIcesIO4IwvJiSiwr';

const AWS_KINESIS_ACCESS_KEY_ID = 'AKIAJKYVF2Q4SBCVFBYA';
const AWS_KINESIS_SECRET_ACCESS_KEY = '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';
const AWS_KINESIS_REGION = 'us-east-1';
const AWS_KINESIS_STREAMNAME = 'twitterstreams';

const client = new Twitter({
  consumer_key: TWITTER_CONSUMER_KEY,
  consumer_secret: TWITTER_SECRET,
  access_token_key: TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: TWITTER_ACCESS_TOKEN_SECRET,
})

const app = express();

app.use(express.static('views'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));
app.set('view engine', 'ejs');

const kinesis = new AWS.Kinesis({
  accessKeyId: AWS_KINESIS_ACCESS_KEY_ID,
  secretAccessKey: AWS_KINESIS_SECRET_ACCESS_KEY,
  region: AWS_KINESIS_REGION,
});


var params = {
  StreamName: AWS_KINESIS_STREAMNAME
}


app.get('/', (req, res) => {
  getTrends().then(trending => {
    getNewsFeeds().then(news => {
      console.log({ trending, news });
      res.status(200).render('dashboard', { trending, news });
    })
  });
});


/**
 * Fetch the live data.
 *
 */
app.get('/data', (req, res) => {
  //console.log("fetching stream..");

  const nextShardIterator = req.query.nextIterator || null;
  //console.log("nextShardIterator", nextShardIterator);

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

      console.log("avgMood", avgMood);
      console.log("length", data.Records.length);
      if (data.Records.length != 0) avgMood = avgMood/data.Records.length;
      console.log("final avgMood", avgMood);

      // Get the next iterator.
      if (!data.NextShardIterator) {
        shardIterator = null;
      }  else {
        shardIterator = data.NextShardIterator;
      }

      //console.log("sharedIterator before response", shardIterator)
      res.status(200).json({
        nextIterator: shardIterator,
        Mood: avgMood
      })
    })
  })
})


/**
 * Trending hashtags in the US
 */
app.get('/trending', (req, res) => getTrends().then((data) => res.status(200).json(data)));


/**
 * Get CNN, FoxNews, MSNBC
 */
app.get('/news', (req, res) => getNewsFeeds().then((data) => res.status(200).json(data)));


const getNextIterator = (nextIterator) => {
  return new Promise((resolve, reject) => {
    //console.log(nextIterator);
    if (nextIterator !== 'null') return resolve(nextIterator)

    var params = {
      ShardId: 'shardId-000000000000',
      StreamName: AWS_KINESIS_STREAMNAME,
      ShardIteratorType: 'LATEST'
    }

    kinesis.getShardIterator(params, (err, data) => {
      if (err) return reject(err);
      return resolve(data.ShardIterator);
    });

  })
}

const getTrends = () => {
  return new Promise((resolve, reject) => {
    client.get('trends/place', {id: 23424977}, (error, tweets, response) => {
      if (error) return reject(error);

      // remove the promoted content and tweet volume is not null
      const filteredTweets = tweets[0].trends.filter((tweet) => {
        if (!tweet.promoted_content && tweet.tweet_volume) return tweet;
      });

      return resolve(filteredTweets);
    });
  });
}

const getNewsFeeds = () => {
  return new Promise((resolve, reject) => {
    async.parallel({
      cnnData: (cb) => {
        client.get('statuses/user_timeline', {screen_name: 'cnn', count: 2}, (error, tweets, response) => {
          cb(error, tweets);
        });
      },
      foxData: (cb) => {
        client.get('statuses/user_timeline', {screen_name: 'FoxNews', count: 2}, (error, tweets, response) => {
          cb(error, tweets);
        });
      },
      msnbcData: (cb) => {
        client.get('statuses/user_timeline', {screen_name: 'MSNBC', count: 2}, (error, tweets, response) => {
          cb(error, tweets);
        });
      },
    }, (err, results) => {
      if (err) resolve(err);
      const data = {
        cnn: results.cnnData,
        fox: results.foxData,
        msnbc: results.msnbcData,
      };
      return resolve(data);
    });
  })
}

app.listen(3000, () => {
  console.log('Dashboard running on 3000')
})