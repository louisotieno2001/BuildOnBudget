const axios = require('axios');

// M-Pesa API base URLs
const BASE_URL_SANDBOX = 'https://sandbox.safaricom.co.ke';
const BASE_URL_PRODUCTION = 'https://api.safaricom.co.ke';

// Get base URL based on environment
function getBaseUrl() {
    const env = process.env.MPESA_ENVIRONMENT || 'sandbox';
    return env === 'production' ? BASE_URL_PRODUCTION : BASE_URL_SANDBOX;
}

// Generate access token
async function getAccessToken() {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    try {
        const response = await axios.get(`${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error.response?.data || error.message);
        throw new Error('Failed to get M-Pesa access token');
    }
}

// Generate timestamp
function generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hour}${minute}${second}`;
}

// Generate password
function generatePassword(shortcode, passkey, timestamp) {
    const password = `${shortcode}${passkey}${timestamp}`;
    return Buffer.from(password).toString('base64');
}

// Initiate STK Push
async function initiateSTKPush(phoneNumber, amount, accountReference, transactionDesc) {
    try {
        // Format phone number: remove + if present
        if (phoneNumber.startsWith('+')) {
            phoneNumber = phoneNumber.substring(1);
        }

        const accessToken = await getAccessToken();
        const timestamp = generateTimestamp();
        const shortcode = process.env.MPESA_SHORTCODE;
        const passkey = process.env.MPESA_PASSKEY;
        const password = generatePassword(shortcode, passkey, timestamp);

        const payload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: phoneNumber,
            PartyB: shortcode,
            PhoneNumber: phoneNumber,
            CallBackURL: process.env.MPESA_CALLBACK_URL,
            AccountReference: accountReference,
            TransactionDesc: transactionDesc
        };

        const response = await axios.post(`${getBaseUrl()}/mpesa/stkpush/v1/processrequest`, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error initiating STK Push:', error.response?.data || error.message);
        throw new Error('Failed to initiate STK Push');
    }
}

module.exports = {
    getAccessToken,
    initiateSTKPush
};
