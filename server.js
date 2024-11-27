const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectID } = require('mongodb');

// Initialize the Express application
const app = express();

// Middleware for parsing JSON
app.use(express.json());

// Set the static folder and port
app.use(express.static(path.join(__dirname, '../frontend')));
app.set('port', 3000);

// Middleware for CORS
app.use(cors());

app.use('/image', (req, res) => {
    const imagePath = path.join(__dirname, 'image', req.url);
    fs.access(imagePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.status(400).send({message: 'Image not found'});
        } else {
            res.sendFile(imagePath)
        }
    })
})
// Connect to MongoDB
let db;
MongoClient.connect(
  'mongodb+srv://urvashisoni:I6azkjzq@cluster0.nkeoq8c.mongodb.net',
  { useUnifiedTopology: true },
  (err, client) => {
    if (err) {
      console.error('Failed to connect to MongoDB:', err);
      process.exit(1);
    }
    console.log('Connected to MongoDB');
    db = client.db('webstore');
  }
);
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ error: err.message });
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
