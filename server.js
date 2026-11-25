const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Use Render's assigned port in production, or 3000 locally
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let orders = [];

// Generate QR Code using the live domain (works both on Render & locally)
app.get('/generate-qr/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId;
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const customerUrl = `${protocol}://${host}/customer.html?table=${tableId}`;
        const qrImage = await QRCode.toDataURL(customerUrl);

        res.send(`
            <div style="text-align:center;font-family:sans-serif;margin-top:50px;">
                <h2>Scan to Order - Table ${tableId}</h2>
                <img src="${qrImage}" style="width:250px;height:250px;"/>
                <p>URL: <a href="${customerUrl}">${customerUrl}</a></p>
                <p>Scan with any mobile camera to order</p>
            </div>
        `);
    } catch (err) {
        res.status(500).send('Error generating QR code');
    }
});

// Socket.io for Real-Time Kitchen & Customer Communication
io.on('connection', (socket) => {
    socket.emit('initial-orders', orders);

    socket.on('new-order', (orderData) => {
        const order = {
            id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
            table: orderData.table,
            items: orderData.items,
            total: orderData.total,
            paymentMethod: orderData.paymentMethod,
            paymentStatus: orderData.paymentStatus,
            status: 'Preparing',
            createdAt: new Date().toLocaleTimeString()
        };

        orders.push(order);
        io.emit('order-received', order);
    });

    socket.on('update-order-status', ({ orderId, status }) => {
        const order = orders.find(o => o.id === orderId);
        if (order) {
            order.status = status;
            io.emit('order-status-changed', { orderId, status });
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});