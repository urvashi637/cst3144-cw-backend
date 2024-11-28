const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectID } = require('mongodb');

// Initialize the Express application
const app = express();

// Middleware for parsing JSON
app.use(express.json());

//config Express.js
app.set('port', 3000);
app.use((req, res, next) =>{
    res.setHeader('Acess-Control-Allow-Origin', '*');
    res.setHeader("Acess-Control-Allow-Credentials", "*");
    res.setHeader("Acess-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST, PUT");
    res.setHeader("Acess-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
    next();
})

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
// Root endpoint
app.get('/', (req, res) => {
    res.send('Welcome to the Webstore API! Use endpoints like /collection/{collectionName}');
});

// Middleware to extract collection by name
app.param('collectionName', (req, res, next, collectionName) => {
    req.collection = db.collection(collectionName);
    next();
});

// Retrieve all documents from a collection
app.get('/collection/:collectionName', (req, res, next) => {
    req.collection.find({}).toArray((err, results) => {
        if (err) return next(err);
        res.send(results);
    });
});

// Retrieve a specific document by ID
app.get('/collection/:collectionName/:id', (req, res, next) => {
    req.collection.findOne({ _id: new ObjectID(req.params.id) }, (err, result) => {
        if (err) return next(err);
        res.send(result);
    });
});

// Serve the main frontend page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/lab.html'));
});


// Route to retrieve all products
app.get('/products', (req, res, next) => {
  db.collection('products')
    .find({})
    .toArray((err, results) => {
      if (err) return next(err);
      res.send(results);
    });
});
// Create a new document in a collection (Order Creation)
app.post('/collection/orders', async (req, res, next) => {
    const order = req.body;
  
    console.log("Received order:", JSON.stringify(order, null, 2));
  
    // Basic validation for the order payload
    if (
      !order.firstName ||
      !order.lastName ||
      !order.address ||
      !order.phone ||
      !order.zip ||
      !Array.isArray(order.cart)
    ) {
      return res.status(400).send({ error: 'Missing or invalid order fields' });
    }
  
    try {
      // Insert the order into the 'orders' collection
      const orderData = {
        firstName: order.firstName,
        lastName: order.lastName,
        address: order.address,
        phone: order.phone,
        zip: order.zip,
        cart: order.cart.map(item => ({
          lessonId: item.lessonId, 
          subject: item.subject, 
          price: item.price, 
          quantity: item.quantity,
        })),
        total: order.total,
      };
  
      // Insert the order into the 'orders' collection
      const orderResult = await db.collection('orders').insertOne(orderData);
      console.log("Order inserted with ID:", orderResult.insertedId);
  
      // Update inventory in the products collection based on the subject
      for (const item of order.cart) {
        console.log(`Updating inventory for subject: ${item.subject}, Quantity: ${item.quantity}`);
  
        // Find the product by subject (lesson name) in the 'products' collection
        const product = await db.collection('products').findOne({ subject: item.subject });
  
        if (product) {
          const newAvailableInventory = product.availableInventory - item.quantity;
  
          // Only update if there’s enough inventory
          if (newAvailableInventory >= 0) {
            // Update the availableInventory
            const updateResult = await db.collection('products').updateOne(
              { subject: item.subject },
              { $set: { availableInventory: newAvailableInventory } }
            );
  
            if (updateResult.modifiedCount === 0) {
              console.warn(`Failed to update inventory for subject: ${item.subject}. No records were modified.`);
            } else {
              console.log(`Inventory for subject ${item.subject} updated successfully.`);
            }
          } else {
            console.warn(`Not enough inventory for subject: ${item.subject}. Available: ${product.availableInventory}, Requested: ${item.quantity}`);
          }
        } else {
          console.warn(`Product with subject: ${item.subject} not found in the database.`);
        }
      }
  
      console.log("Order processing completed.");
      res.status(201).send({ msg: 'Order placed successfully' });
    } catch (err) {
      console.error("Error processing order:", err);
      res.status(500).send({ error: 'Failed to process the order' });
    }
  });

  // Update a document in a collection by ID or manually update inventory
app.put('/collection/:collectionName/:id', async (req, res, next) => {
    const { collectionName, id } = req.params;
    const { quantity } = req.body; // If the request is for inventory update, this will be the quantity
  
    // If the collection is 'products', we handle inventory updates
    if (collectionName === 'products' && quantity !== undefined) {
      if (typeof quantity !== 'number') {
        return res.status(400).send({ error: 'Quantity must be a number' });
      }
  
      try {
        const product = await db.collection('products').findOne({ _id: new ObjectID(id) });
  
        if (!product) {
          return res.status(404).send({ error: 'Product not found' });
        }
  
        const newAvailableInventory = product.availableInventory + quantity;
  
        // Only update if the new inventory is valid
        if (newAvailableInventory < 0) {
          return res.status(400).send({ error: 'Insufficient inventory' });
        }
  
        const updateResult = await db.collection('products').updateOne(
          { _id: new ObjectID(id) },
          { $set: { availableInventory: newAvailableInventory } }
        );
  
        if (updateResult.modifiedCount === 0) {
          return res.status(400).send({ error: 'Failed to update inventory' });
        }
  
        return res.status(200).send({
          msg: 'Inventory updated successfully',
          updatedInventory: newAvailableInventory
        });
      } catch (err) {
        console.error("Error updating inventory:", err);
        return res.status(500).send({ error: 'Failed to update inventory' });
      }
    } else {
      // General document update in any collection
      try {
        const result = await db.collection(collectionName).updateOne(
          { _id: new ObjectID(id) },
          { $set: req.body },
          { safe: true, multi: false }
        );
  
        res.send(result.modifiedCount === 1 ? { msg: 'success' } : { msg: 'error' });
      } catch (err) {
        return next(err);
      }
    }
  });
  
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
