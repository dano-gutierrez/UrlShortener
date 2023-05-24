const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const axios = require('axios');
const cheerio = require('cheerio');

const port = 3000;

const MONGO_URL = "mongodb://127.0.0.1:27017";
const MONGO_DB = "URLS";
const MONGO_COLLECTION_URLS = "urls";
const MONGO_COLLECTION_VISITS = "visits";

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const getTitle = async (url) => {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    const title = $('title').text();
    return title;
  } catch (error) {
    console.error('Error retrieving title');
  }
  return null;
};

const shortener = async (collection, iterator = 1) => {
  // Not performant, look for looking in the DB characters not used
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  const usedCharactersQuery = await collection.find({ $expr: { $eq: [ { $strLenCP: "$shortUrl" }, 1 ] } }).toArray();
  const usedCharacters = [];
  for (let i = 0; i < usedCharactersQuery.length; i++) {
    usedCharacters[i] = usedCharactersQuery[i].shortUrl;
  }
  
  const remainingChars = chars.split('').filter(char => !usedCharacters.includes(char)).join('');

  if (remainingChars.length === 0) {
    return shortener(collection, iterator + 1);
  }

  let shortUrl = "";
  for (let i = 0; i < iterator; i += 1) {
    shortUrl += remainingChars[Math.floor(Math.random() * remainingChars.length)];
  }

  const currentUrl = await collection.findOne({ shortUrl });

  if (!currentUrl) {
    return shortUrl;
  }

  // If value is found, use recursion until not found
  // TODO look for something better in performance
  return shortener(collection);

};

app.post("/short", async (req, res) => {
  const { body } = req;

  const url = body.url;

  let shortUrl;
  
  try {
    const client = new MongoClient(MONGO_URL);
    const conn = await client.connect();
    // TODO create Mongo schema
    const db = conn.db(MONGO_DB);
    const collection = await db.collection(MONGO_COLLECTION_URLS);
    shortUrl = await shortener(collection);

    if (shortUrl) {
      // TODO look for URL not dupicated
      const title = await getTitle(url);
      await collection.insertOne({ url, shortUrl, title });

      res.send(shortUrl);
    }
  } catch(e) {
    console.error(e);
  }
});

app.get("/", async (req, res) => {
  const { body } = req;
  const shortUrl = body.url;

  try {
    const client = new MongoClient(MONGO_URL);
    const conn = await client.connect();
    const db = conn.db(MONGO_DB);
    const collection = await db.collection(MONGO_COLLECTION_URLS);

    if (shortUrl) {
      const result = await collection.findOne({ shortUrl });

      if (result) {
        const collectionVisits = await db.collection(MONGO_COLLECTION_VISITS);
        await collectionVisits.insertOne({ urlId: result._id, date: Date() });
        res.send(result.url);
      }
    }
  } catch(e) {
    console.error(e);
  }
});

app.get("/top-urls", async (req, res) => {
  try {
    const client = new MongoClient(MONGO_URL);
    const conn = await client.connect();
    const db = conn.db(MONGO_DB);
    const result = await db.collection(MONGO_COLLECTION_VISITS).aggregate([
      {
        $group: {
          _id: "$urlId",
          count: { $sum: 1 }
        }
      },
      {
        $sort: {
          count: -1
        }
      },
      {
        $limit: 100
      }
    ]).toArray();

    const tops = [];
    for(const item of result) {
      const url = await db.collection(MONGO_COLLECTION_URLS).findOne({_id: item._id});
      tops.push(url.url);
    };

    res.json(tops);
  } catch(e) {
    console.error('Error executing aggregation:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.listen(port, () => {
  console.log("Server listening to port 3000");
});

module.exports = app;
