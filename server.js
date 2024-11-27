const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectID } = require('mongodb');

// Initialize the Express application
const app = express();

// Middleware for parsing JSON
app.use(express.json());
app.set('port', 3000);

// Middleware for CORS
app.use(cors());

// Connect to MongoDB
let db;
MongoClient.connect('mongodb+srv://urvashisoni:I6azkjzq@cluster0.nkeoq8c.mongodb.net', { useUnifiedTopology: true }, (err, client) => {
    if (err) {
        console.error("Failed to connect to MongoDB:", err);
        process.exit(1);
    }
    console.log("Connected to MongoDB");
    db = client.db('webstore');
});

app.get('/' , (req,res) => {
  res.sendFile(path.join(__dirname, ''))
})
// Route to retrieve all products
app.get('/products', (req, res, next) => {
    db.collection('products').find({}).toArray((err, results) => {
        if (err) return next(err);
        res.send(results);
    });
});

// Route to create a new order and update inventory
app.post('/orders', async (req, res, next) => {
    const order = req.body;

    // Basic validation
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
        // Prepare the order data
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

        // Update inventory in the 'products' collection
        for (const item of order.cart) {
            const product = await db.collection('products').findOne({ subject: item.subject });

            if (product) {
                const newAvailableInventory = product.availableInventory - item.quantity;

                // Ensure sufficient inventory before updating
                if (newAvailableInventory >= 0) {
                    await db.collection('products').updateOne(
                        { subject: item.subject },
                        { $set: { availableInventory: newAvailableInventory } }
                    );
                    console.log(`Inventory for ${item.subject} updated successfully.`);
                } else {
                    console.warn(`Not enough inventory for ${item.subject}.`);
                }
            } else {
                console.warn(`Product with subject ${item.subject} not found.`);
            }
        }

        res.status(201).send({ msg: 'Order placed successfully' });
    } catch (err) {
        console.error("Error processing order:", err);
        res.status(500).send({ error: 'Failed to process the order' });
    }
});

// Route to update available inventory for a specific product
app.put('/products/:id/inventory', async (req, res, next) => {
    const { id } = req.params;
    const { quantity } = req.body;

    if (typeof quantity !== 'number') {
        return res.status(400).send({ error: 'Quantity must be a number' });
    }

    try {
        const product = await db.collection('products').findOne({ _id: new ObjectID(id) });

        if (!product) {
            return res.status(404).send({ error: 'Product not found' });
        }

        const newAvailableInventory = product.availableInventory + quantity;

        // Ensure valid inventory levels
        if (newAvailableInventory < 0) {
            return res.status(400).send({ error: 'Insufficient inventory' });
        }

        const updateResult = await db.collection('products').updateOne(
            { _id: new ObjectID(id) },
            { $set: { availableInventory: newAvailableInventory } }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(500).send({ error: 'Failed to update inventory' });
        }

        res.status(200).send({
            msg: 'Inventory updated successfully',
            updatedInventory: newAvailableInventory
        });
    } catch (err) {
        console.error("Error updating inventory:", err);
        res.status(500).send({ error: 'Failed to update inventory' });
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
