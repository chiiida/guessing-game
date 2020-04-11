'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require("mongodb").ObjectID
const assert = require('assert');
// Connection URL
const url = 'mongodb://localhost/guessinggame';

// Database Name
const dbName = 'guessinggame';
// Create a new MongoClient
const client = new MongoClient(url);

// Constants
const PORT = 80;
const HOST = '0.0.0.0';

// App
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs')

let objID = new ObjectID();;

// Use connect method to connect to the Server
client.connect(function (err) {
  assert.equal(null, err);
  console.log("Connected successfully to server");

  const db = client.db(dbName);
  const col = db.collection('games');

  let top_five = [];

  app.get('/', (req, res) => {
    
    col.find().limit(1).sort({ $natural: -1 }).toArray(function (err, docs) {
      
      assert.equal(null, err);
      if (err) return console.log(err)

      let obj = {};
      if (docs.length == 0) {
        obj = {
          step: 0,
          question: "",
          guessing: "",
          answer: "",
          current_step: 'first',
          fail: 0,
          start: "",
          end: "",
          duration: 0,
          duration_text: "",
          score: 0,
          top_five: []
        };
      } else {
        const step = docs[0].step;
        let current_step = (step == 1 || step == 5 ? 'first' : (step == 2 || step == 6 ? 'second' :
          (step == 3 || step == 7 ? 'thrid' : 'fourth')));
        col.find().limit(5).sort({ score: -1 }).toArray(function (err, docs) {
          if (err) return console.log(err)
          top_five = [];
          for (var i = 0; i < docs.length; i++) {
            top_five.push(docs[i].score.score);
          }
        })
        obj = {
          step: docs[0].step,
          question: docs[0].question.join(" "),
          guessing: docs[0].guessing.join(" "),
          answer: docs[0].answer.slice(0,4).join(" "),
          current_step: current_step,
          fail: docs[0].fail,
          start: docs[0].gameStart,
          end: docs[0].gameEnd,
          duration: docs[0].score.duration_secs,
          duration_text: docs[0].score.duration_text,
          score: docs[0].score.score,
          top_five: top_five
        }
      }
      res.render('index.ejs', obj);
    });
  });

  app.post('/start', (req, res) => {
    objID = new ObjectID();

    const schema = {
      _id: objID,
      stage: 1,
      question: ["_", "_", "_", "_"],
      guessing: ["*", "*", "*", "*"],
      answer: [],
      score: {
        score: 0,
        duration_secs: 0,
        duration_text: ""
      },
      fail: 0,
      step: 0,
      gameStart: null,
      gameEnd: null
    }

    col.insertOne(schema, (err, docs) => {
      if (err) return console.log(err)

      console.log('saved to database');
      col.updateOne({ step: 0 }, { $set: { step: 1 } });
      res.redirect('/')
    })
  });

  app.post('/set_question', (req, res) => {
    const chosen = req.body.question;
    col.updateOne({ stage: 1, question: "_" }, { $set: { 'question.$': chosen }, $inc: { step: 1 } })
    col.find({}).limit(1).sort({ $natural: -1 }).toArray(function (err, docs) {
      if (docs[0].step == 4 && docs[0].fail == 0) {
        col.updateOne({ step: 5 }, { $set: { stage: 2, gameStart: new Date() } })
      }
    });
    res.redirect('/')
  });

  app.post('/guessing', (req, res) => {
    const chosen = req.body.guessing;
    col.find({}).limit(1).sort({ $natural: -1 }).toArray(function (err, docs) {
      if (err) return console.log(err)

      const step = docs[0].step;
      const index = (step == 5 ? 0 : (step == 6 ? 1 : (step == 7 ? 2 : 3)));

      if (docs[0].question[index] == chosen) {
        col.updateOne({ guessing: "*" }, {
          $pop: { guessing: 1 },
          $push: { answer: chosen },
          $inc: { step: 1 }
        });
        
        if (index == 3) {
          const gameStart = new Date(docs[0].gameStart);
          const gameEnd = new Date();
          let time_diff = gameEnd.getTime() - gameStart.getTime()
          let to_secs = (time_diff) / 1000;
          let duration_secs = Math.abs(to_secs).toFixed(2);
          let duration_text = Math.floor(duration_secs / 60 / 60) + " hrs, " + Math.floor(duration_secs / 60) + " mins, " + duration_secs + " sec"
          let score = (4 * 1000 - duration_secs * 100 - docs[0].fail * 100);
          col.updateOne({ _id: docs[0]._id}, {
            $set: {
              gameEnd: gameEnd,
              score: {
                score: score,
                duration_secs: duration_secs,
                duration_text: duration_text
              },
              stage: 3,
              step: 9
            },
            $pop: { guessing: 1 },
            $push: { answer: chosen }
          })
        }
      } else { col.updateOne({ guessing: "*" }, { $inc: { fail: 1 } }) }
    });
    res.redirect('/')
  });
});

app.listen(PORT, HOST);

console.log(`Running on http://${HOST}:${PORT}`);