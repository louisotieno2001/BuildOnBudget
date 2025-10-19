const express = require('express');
const router = express.Router();
const url = process.env.DIRECTUS_URL;
const accessToken = process.env.DIRECTUS_TOKEN;

// Query function to directus API endpoints
async function query(path, config) {
    try {
        const res = await fetch(encodeURI(`${url}${path}`), {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            ...config
        });
        return res;
    } catch (error) {
        console.error('Error during fetch:', error);
        throw new Error('Database connection failed.')
    }
}

// M-Pesa callback handler
router.post('/callback', async (req, res) => {
    try {
        const callbackData = req.body;
        console.log('M-Pesa Callback:', JSON.stringify(callbackData, null, 2));

        // Check if payment was successful
        if (callbackData.Body && callbackData.Body.stkCallback) {
            const stkCallback = callbackData.Body.stkCallback;
            const resultCode = stkCallback.ResultCode;
            const checkoutRequestId = stkCallback.CheckoutRequestID;

            if (resultCode === 0) {
                // Payment successful
                const callbackMetadata = stkCallback.CallbackMetadata.Item;
                const mpesaReceiptNumber = callbackMetadata.find(item => item.Name === 'MpesaReceiptNumber').Value;
                const transactionDate = callbackMetadata.find(item => item.Name === 'TransactionDate').Value;
                const phoneNumber = callbackMetadata.find(item => item.Name === 'PhoneNumber').Value;
                const amount = callbackMetadata.find(item => item.Name === 'Amount').Value;

                // Here you would typically verify the checkoutRequestId against your stored session/database
                // For now, we'll assume it's valid and process the order

                // Note: In a real implementation, you'd need to retrieve the pending payment details
                // from session or database using the checkoutRequestId

                // Since we don't have persistent storage in this example, we'll simulate order completion
                // In production, you'd fetch the pending payment details and complete the orders

                console.log(`Payment successful: Receipt ${mpesaReceiptNumber}, Amount: ${amount}`);

                // TODO: Complete the order processing here
                // This would involve updating orders to 'complete', subtracting units from shop, etc.

            } else {
                // Payment failed
                console.log(`Payment failed with result code: ${resultCode}`);
            }
        }

        // Always respond with success to acknowledge receipt
        res.json({ ResultCode: 0, ResultDesc: 'Callback received successfully' });
    } catch (error) {
        console.error('Error processing M-Pesa callback:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Payment success page
router.get('/success', (req, res) => {
    res.render('payment-success', {
        title: 'Payment Successful',
        message: 'Your payment has been processed successfully. Thank you for your purchase!'
    });
});

module.exports = router;
