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
        // console.log('M-Pesa Callback:', JSON.stringify(callbackData, null, 2));

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

                const resPending = await query(`/items/pending_payments?filter[checkout_request_id][_eq]=${checkoutRequestId}&fields=*`);
                const pending = await resPending.json();
                const pendingPayment = pending && pending.data && pending.data[0];

                if (pendingPayment) {
                    await query(`/items/pending_payments/${pendingPayment.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            status: 'completed',
                            mpesa_receipt: mpesaReceiptNumber,
                            transaction_date: String(transactionDate),
                            amount,
                            phone: String(phoneNumber)
                        })
                    });

                    if (pendingPayment.orders && Array.isArray(pendingPayment.orders)) {
                        await Promise.all(
                            pendingPayment.orders.map((order) =>
                                query(`/items/orders/${order.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({
                                        status: 'complete',
                                        amount_paid: amount,
                                        update_date: new Date().toISOString()
                                    })
                                })
                            )
                        );
                    }
                }

                // console.log(`Payment successful: Receipt ${mpesaReceiptNumber}, Amount: ${amount}`);
                
            } else {
                // Payment failed
                // console.log(`Payment failed with result code: ${resultCode}`);
                const resPending = await query(`/items/pending_payments?filter[checkout_request_id][_eq]=${checkoutRequestId}&fields=id`);
                const pending = await resPending.json();
                const pendingPayment = pending && pending.data && pending.data[0];
                if (pendingPayment) {
                    await query(`/items/pending_payments/${pendingPayment.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            status: 'failed',
                            failure_reason: stkCallback.ResultDesc || 'Payment failed'
                        })
                    });
                }
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
