const validator = require('validator');
const config = {};
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg];
const chalk = require('chalk');
const DB = require('../models/DbQuery');
const _ = require('lodash');
const queryBuilder = require('../models/queryBuilder');
const { createSuccessResponse, createErrResponse, sendServerError } = require('../utils/api/responseBuilder');
const SMSService = require('./services/smsService');
const { writeLog } = require('../utils/logger');
const db = new DB(config.get('db'));
const { decryptFields, encryptBody } = require('./middlewares/encryptionMiddleware');
const GyFTR = require('../utils/encryptionUtility');
const { ENC_KEY, ENC_IV } = config.get('ENCRYPTION');
const gyftr = new GyFTR(ENC_KEY, ENC_IV);

const { validateProducts, validateOTP } = require('./services/validators/cartValidator');
const CartService = require('./services/cartService');

// OTT Registration
exports.OttRegistration = async (req, res, next) => {
    try {
        const { mobile, email, name, city, state } = req.body;

        // validations
        if (!mobile) return res.status(400).json(createErrResponse(400, 'mobile is required', 'BAD_REQUEST'));
        if (!email) return res.status(400).json(createErrResponse(400, 'email is required', 'BAD_REQUEST'));

        if (typeof mobile != 'string' || !validator.isMobilePhone(mobile, 'en-IN')) {
            const errResp = createErrResponse(400, 'Invalid Mobile Number', 'BAD_REQUEST');
            return res.status(400).json(errResp);
        }
        if (typeof email != 'string' || !validator.isEmail(email)) {
            const errResp = createErrResponse(400, 'Invalid Email Id', 'BAD_REQUEST');
            return res.status(400).json(errResp);
        }

        if (!name || typeof name != 'string') {
            return res.status(400).json(createErrResponse(400, 'Invalid Name', 'BAD_REQUEST'));
        }

        if (!city || typeof city != 'string') {
            return res.status(400).json(createErrResponse(400, 'Invalid City', 'BAD_REQUEST'));
        }

        if (!state || typeof state != 'string') {
            return res.status(400).json(createErrResponse(400, 'Invalid State', 'BAD_REQUEST'));
        }

        let mob = gyftr.dbEncrypt(mobile);

        const otpQuery = queryBuilder.sendOtp();
        let [otpDetails] = await db.query(otpQuery, [mob, 'OTT']);


        await SMSService.sendSMS('OTP', { mobile, replacements: [otpDetails[0].otp] });

        // send final response
        const response = createSuccessResponse("Otp sent successfully");
        res.status(200).json(response);
    } catch (err) {
        console.error(chalk.bold.bgMagenta('REGISTRATION_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error registering user');
    }
};


exports.addToCart = async (req, res) => {
    try {
        const { products, mobile, otp } = req.body;
        const { userId } = req;

        // Validate products
        const productsValidation = validateProducts(products);
        if (!productsValidation.isValid) {
            return res.status(400).json(
                createErrResponse(400, productsValidation.error, 'validation error')
            );
        }

        // Initialize cart service
        const cartService = new CartService(db, gyftr);

        // Validate OTP if provided
        if (mobile && otp) {
            await validateOTP(mobile, otp);
        }

        // Clear existing direct buy items
        await cartService.clearDirectBuyItems(userId);

        // Process cart items
        const cartResults = await cartService.processCartItems(products, userId);

        // Send success response
        res.status(200).json(
            createSuccessResponse(encryptBody(cartResults))
        );

    } catch (error) {
        const cartErrors = ['INVALID_EMAIL', 'INVALID_PHONE', 'INVALID_QUANTITY', 'INVALID_PRODUCT_ID'];
        if (cartErrors.includes(err.message)) {
            const errResp = createErrResponse(400, err.message, 'validation error');
            return res.status(400).json(errResp);
        }
        console.error(chalk.bold.bgMagenta('CART_ADD_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Adding to Cart');
    }
};

