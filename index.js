const express = require('express');
const app = express();
const fs = require('fs');
const session = require('express-session'); // Import express-session
const { NlpManager } = require('node-nlp');
port=3001

app.use(
    session({
      secret: 'your-secret-key',
      resave: false,
      saveUninitialized: true,
    })
  );

const manager = new NlpManager({ languages: ['en'] });

// Convert training data from plain text to JSON
const plainTextData = fs.readFileSync('training-data.txt', 'utf-8');
const lines = plainTextData.split('\n');

const trainingData = [];
let currentQuestion = null;
let currentAnswer = null;

lines.forEach(line => {
  if (line.trim() === '') {
    // Empty line separates question-answer pairs
    if (currentQuestion && currentAnswer) {
      trainingData.push({ text: currentQuestion, intent: 'custom', answer: currentAnswer });
      currentQuestion = null;
      currentAnswer = null;
    }
  } else if (currentQuestion === null) {
    currentQuestion = line.trim();
  } else if (currentAnswer === null) {
    currentAnswer = line.trim();
  }
});

if (currentQuestion && currentAnswer) {
  trainingData.push({ text: currentQuestion, intent: 'custom', answer: currentAnswer });
}

fs.writeFileSync('training-data.json', JSON.stringify(trainingData, null, 2));

// Load training data from the JSON file
const loadedTrainingData = JSON.parse(fs.readFileSync('training-data.json', 'utf-8'));

loadedTrainingData.forEach(({ text, intent, answer }) => {
  manager.addDocument('en', text, intent);
  manager.addAnswer('en', intent, answer);
});

(async () => {
  await manager.train();
  // Save the trained model with a specific filename
  fs.writeFileSync('trained-model.nlp', JSON.stringify(manager.export()));
})();

// Load the trained model from the saved file
const modelData = JSON.parse(fs.readFileSync('trained-model.nlp'));
manager.import(modelData);

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));


app.get('/', (req, res) => {
    // Get or initialize the conversation history from the session
    const conversation = req.session.conversation || [];
    res.render('index.ejs', { response: null, conversation: conversation });
  });
  
  app.post('/ask', async (req, res) => {
    const message = req.body.message;
    const response = await manager.process('en', message);
  
    // Get or initialize the conversation history from the session
    const conversation = req.session.conversation || [];
  
    // Update conversation array
    conversation.push({ role: 'User', message: message });
    conversation.push({ role: 'Bot', message: response.answer });
  
    // Save the updated conversation history to the session
    req.session.conversation = conversation;
  
    res.render('index.ejs', { response: response.answer, conversation: conversation });
  });
  
  
app.post('/audio', async (req, res) => {
    const audioText = req.body.audioText;
    const response = await manager.process('en', audioText);
    res.json({ response: response.answer });
  });


app.listen(port, () => {
    console.log(`App running on localhost:${port}`)
});
// app.listen(3001, () => {
//   console.log('Server is running on port 3001');
// });
