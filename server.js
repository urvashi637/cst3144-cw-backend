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
