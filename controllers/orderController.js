const config = {};
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg];
const { promisify } = require('util');
const chalk = require('chalk');
const _ = require('lodash');
const DB = require('../models/DbQuery');
const queryBuilder = require('../models/queryBuilder');
const { createSuccessResponse, createErrResponse, sendServerError } = require('../utils/api/responseBuilder');
const { writeLog } = require('../utils/logger');
const CommEngine = require('./services/CommEngine');
const Utility = require('../utils/util');
const { decryptFields, encryptBody } = require('./middlewares/encryptionMiddleware');
const SMSService = require('./services/smsService');
const { SECRET: JWT_SECRET, EXPIRES_IN: JWT_EXPIRY } = config.get('jwt');
const db = new DB(config.get('db'));
const jwt = require('jsonwebtoken');
const seamLessPgService = require('../controllers/services/seamLessPgService.js');
const GyFTR = require('../utils/encryptionUtility');
const { ENC_KEY, ENC_IV } = config.get('ENCRYPTION');
const gyftr = new GyFTR(ENC_KEY, ENC_IV);
const userJwt = require('../controllers/userController');
const SEAMLESSPG = config.get('SEAMLESSPG');

const ORDER_CONSTANTS = {
    WEBSITE_SOURCE: 'WEBSITE',
    WHATSAPP: {
        YES: 'Y',
        NO: 'N'
    },
    PAYU_NOR: '10'
};

const { validateOrderInput, getUserIP, processCartItems, processWhatsAppPreference, isValidOrderResult, validateDiscountParams } = require('../utils/helper.js');

const PaymentService = require('./services/paymentService.js');
const TransactionService = require('./services/transactionService.js');


exports.createOrder = async (req, res, next) => {
    try {
        const { name, email, mobile, cart_item_ids, whatsApp } = req.body;
        const userId = req.userId;

        // Validate input
        const validationErrors = validateOrderInput(req.body);
        if (validationErrors.length > 0) {
            const errResp = createErrResponse(400, validationErrors[0].message, 'validation error');
            return res.status(400).json(errResp);
        }

        // Get user IP
        const userIP = getUserIP(req);

        // Process cart items
        const cartIds = processCartItems(cart_item_ids);

        // Process WhatsApp preference
        const whatsAppPreference = processWhatsAppPreference(whatsApp);

        // Create order
        const orderResult = await createOrderInDB({
            userId,
            cartIds,
            userIP,
            whatsAppPreference
        });

        if (!isValidOrderResult(orderResult)) {
            const errResp = createErrResponse(403, orderResult[0][0].error || 'Issue in create order', 'order error');
            return res.status(403).json(errResp);
        }

        // Process successful order
        await processSuccessfulOrder(orderResult[0][0], { userId, name, email, mobile }, req, res);

    } catch (err) {
        handleOrderError(err, res);
    }
};


const createOrderInDB = async ({ userId, cartIds, userIP, whatsAppPreference }) => {
    try {
        const createOrderQuery = queryBuilder.createOrder();
        return await db.query(
            createOrderQuery,
            [userId, cartIds, ORDER_CONSTANTS.WEBSITE_SOURCE, userIP, ORDER_CONSTANTS.WEBSITE_SOURCE, whatsAppPreference]
        );
    } catch (err) {
        console.error(chalk.bold.bgMagenta('createOrderInDB:'), err);
        sendServerError(res, 'Error Creating Order');
    }
};

const processSuccessfulOrder = async (orderData, userData, req, res) => {
    if (!orderData.order_guid) return;

    // Enrich order data with user information
    const enrichedOrderData = {
        ...orderData,
        user_id: userData.userId,
        username: userData.name,
        name: userData.name,
        email: userData.email,
        mobile: userData.mobile
    };

    if (enrichedOrderData.redemable_points > 0) {
        throw new Error("Points are not allowed");
    }

    if (enrichedOrderData.payu_guid && enrichedOrderData.payu_amount > 0) {
        if (enrichedOrderData.payunor === ORDER_CONSTANTS.PAYU_NOR) {
            await this.PaymentRedirectPgSeamLess(req, res, enrichedOrderData);
        }
    }
};

const handleOrderError = (err, res) => {
    console.error(chalk.bold.bgMagenta('CREATE_ORDER_ERR:'), err);
    writeLog('app', JSON.stringify(err));
    sendServerError(res, 'Error Creating Order');
};


const validateUserAuthentication = async (token, otp, userId, userDetails) => {
    try {
        let authToken=false;
        if (token) {
            authToken = await this.txnTokenAuthGuard(token, userId);
        }

        if(!authToken){
        if (!otp) {
            await sendOTP(userDetails);
            return { needsOTP: true };
        }

        return await verifyOTP(otp, userDetails, userId);
        }else{
            return authToken;
        }

    } catch (err) {
        console.error(chalk.bold.bgMagenta('validateUserAuthentication:'), err);
        sendServerError(res, 'Error validateUserAuthentication');
    }
};

const sendOTP = async (userDetails) => {
    const queryStr = queryBuilder.mobileNumberCheck();
    const [[result]] = await db.query(queryStr, [userDetails.phone, 'view_orders']);
    const mobile = gyftr.dbDecrypt(userDetails.phone);

    await SMSService.sendSMS('OTP', { mobile, replacements: [result.otp] });
    return true;
};

const verifyOTP = async (otp, userDetails, userId) => {
    const otpQueryStr = queryBuilder.userLogin();
    const otpResponse = await db.query(otpQueryStr, [userDetails.phone, otp]);

    if (otpResponse?.[0]?.[0]?.error) {
        return { error: otpResponse[0][0].error };
    }

    if (otpResponse?.[1]?.[0]?.success === 'OTP verified') {
        const payload = { user_id: userId, otp };
        const jwtDataToken = userJwt.signJwt(userId, payload, '900s');
        return { isValid: true, jwtDataToken };
    }

    return { isValid: false };
};

const processVoucherDetails = async (order) => {
    const voucherDetails = [];

    if (order.order_status === "C") {
        const voucherDtls = await CommEngine.getVoucherStatus(order.external_guid);

        console.log('voucherDtls',voucherDtls);

        if (voucherDtls.status !== false && voucherDtls[0]?.vouchers) {
            voucherDetails.push(...voucherDtls[0].vouchers.map(voucher => ({
                voucherno: voucher.voucher_no || "",
                pin: voucher.voucher_pin || "",
                endDate: voucher.end_date || ""
            })));
        } else {
            voucherDetails.push({
                voucherno: "",
                pin: "",
                endDate: ""
            });
        }
    } else {
        voucherDetails.push({
            voucherno: "",
            pin: "",
            endDate: ""
        });
    }

    return voucherDetails;
};

const formatOrderResponse = (order) => ({
    order_id: order.order_id,
    order_on: order.order_on,
    order_number: order.order_number,
    points_burnt: order.points_burnt,
    points_earned: order.points_earned,
    cash: order.cash,
    order_status: order.order_status,
    brand_name: order.brand_name,
    brand_icon_url: order.brand_icon_url,
    face_value: order.face_value,
    quantity: order.quantity,
    voucher_status: order.voucher_status,
    delivery_name: gyftr.dbDecrypt(order.delivery_name),
    delivery_email: gyftr.dbDecrypt(order.delivery_email),
    delivery_phone: gyftr.dbDecrypt(order.delivery_phone),
    voucher_guid: order.voucher_guid,
    voucherDetails: order.voucherDetails
});

exports.fetchAllOrders = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { txn_token, otp } = req.body;

        console.log('txn_token',txn_token,'otp',otp);

        // Get user details
        const [[userDetails]] = await db.query(
            queryBuilder.getUserDetail(),
            [userId]
        );

        // Validate authentication
        const authResult = await validateUserAuthentication(
            txn_token,
            otp,
            userId,
            userDetails
        );
        
        if(!authResult){
        if (authResult.needsOTP) {
            return res.status(201).json({
                code: 201,
                status: 'SUCCESS',
                message: 'OTP send Successfully'
            });
        }

        if (authResult.error) {
            return res.status(401).json(
                createErrResponse(401, authResult.error)
            );
        }

        if (!authResult.isValid) {
            return res.status(401).json(
                createErrResponse(401, 'Invalid authentication')
            );
        }
        }

        // Fetch orders
        const [orders] = await db.query(
            queryBuilder.getUserOrders(),
            [userId, 1, 1000, null]
        );

        if (orders.error) {
            return res.status(400).json(
                createErrResponse(400, orders.error, 'Fetching All Orders error')
            );
        }

        // Process orders
        const processedOrders = await Promise.all(
            orders.map(async (order) => {
                order.voucherDetails = await processVoucherDetails(order);
                return formatOrderResponse(order);
            })
        );

        // Prepare response
        const responseData = {
            data: encryptBody(processedOrders)
        };

        if (authResult.jwtDataToken) {
            responseData.txns_token = authResult.jwtDataToken;
        }

        res.status(200).json(createSuccessResponse(responseData));

    } catch (err) {
        console.error(chalk.bold.bgMagenta('FETCH_ALL_ORDER_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Fetching Orders');
    }
};



//Get order details 
exports.getOrderDetails = async (req, res, next) => {
    try {
        const { guid } = req.body;
        const userId = req.userId;
        if (!guid) {
            const errResp = createErrResponse(400, 'guid is required', 'validation error');
            return res.status(400).json(errResp);
        }
        const queryStr = queryBuilder.orderDtlsByOderId();
        const [result] = await db.query(queryStr, [guid, userId]);

        if (!result || _.isEmpty(result)) {
            const successResp = createErrResponse([]);
            return res.status(400).json(successResp);
        }

        let results = []

        result.forEach((item) => {
            results.push({
                'order_id': item.order_id,
                'order_on': item.order_on,
                'order_number': item.order_number,
                'points_burnt': item.points_burnt,
                'points_earned': item.points_earned,
                'cash': item.cash,
                'order_status': item.order_status,
                'brand_name': item.brand_name,
                'brand_icon_url': item.brand_icon_url,
                'product_name': item.product_name,
                'extenal_guid': item.external_guid,
                'face_value': item.face_value,
                'quantity': item.quantity,
                'voucher_status': item.voucher_status,
                'delivery_name': gyftr.dbDecrypt(item.delivery_name),
                'delivery_email': gyftr.dbDecrypt(item.delivery_email),
                'delivery_phone': gyftr.dbDecrypt(item.delivery_phone),
                "unit_price": item.unit_price,
                "order_amount": item.order_amount,
                "is_festive": item.is_festive
            })
        })

        // check if order is Fail/Initializing/Pending
        let groupedResults;
        let dbDecrypted;
        let response;
        if (results.find(el => ['F', 'I', 'P'].includes(el.order_status))) {


            groupedResults = _.groupBy(results, orderItem => orderItem.extenal_guid);
            dbDecrypted = decryptFields(groupedResults);
            response = createSuccessResponse(encryptBody(dbDecrypted), 'Order Incomplete');
            return res.status(200).json(response);
        }

        groupedResults = _.groupBy(results, orderItem => orderItem.extenal_guid);
        // Get voucher details in loop for each line items
        for (const extGuid in groupedResults) {
            const [lineItem] = groupedResults[extGuid];
            let voucherDtls = await CommEngine.getVoucherStatus(extGuid);
            var finalResults = [];
            if (voucherDtls.error) {
                finalResults.push({
                    ...lineItem
                });
            } else {
                voucherDtls = voucherDtls[0];
                voucherDtls.vouchers.forEach(el => {
                    finalResults.push({
                        ...lineItem,
                        ...el
                    });
                });
            }

            groupedResults[extGuid] = finalResults;
        }

        dbDecrypted = decryptFields(groupedResults);
        response = createSuccessResponse(encryptBody(dbDecrypted));
        res.status(200).json(response);
    } catch (err) {
        console.error(chalk.bold.bgMagenta('FETCH_ORDER_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Fetching Order');
    }
};



async function changeTxnStatus(
    userId,
    txnId,
    status,
    desc,
    mihpayid,
    payuDetails
) {
    try {
        desc = desc ? desc : null;
        mihpayid = mihpayid ? mihpayid : null;

        let { mode = null, pg_type, card_num, name_on_card, discount, remark, auth_code } = payuDetails;

        const queryStr = queryBuilder.changeTxnStatus();

        return await db.query(queryStr, [
            userId,
            txnId,
            status,
            desc,
            mihpayid,
            discount,
            remark,
            mode,
            pg_type,
            card_num,
            name_on_card,
            auth_code
        ]
        );
    } catch (err) {
        console.log("changeTxnStatus Error", err);
        throw err;
    }
}

async function refund_payu_transaction(txnId, status, description, remark) {

    try {

        const queryStr = queryBuilder.refundPayUTxnStatus();

        return await db.query(queryStr, [txnId, status, description, remark]);

    } catch (err) {
        console.log("refund_payu_transaction Error", err);
        throw err;
    }
}



async function isOrderProcess(txnId) {
    try {
        var str = queryBuilder.isOrderProcess();
        var [isOrderProcessResult] = await db.query(str, [txnId]);
        if (isOrderProcessResult[0] && isOrderProcessResult[0].error_status && isOrderProcessResult[0].error_status == '1') {
            return true;
        }
        return false;
    } catch (err) {
        console.log("isOrderProcess Error", err);
        throw err;
    }
}

async function OrderDetailsByTxnGuid(txn_guid) {
    try {
        console.log('Txn guid ------->', txn_guid);

        const query = queryBuilder.orderDtlsByTxnGuid();
        return await db.query(query, [txn_guid]);
    } catch (err) {
        console.log("OrderDetailsByTxnGuid Error", err);
        throw err;
    }
}

//Buy offer Product
exports.offerProduct = async (req, res, next) => {

    try {

        let { guid, orderId, productId, userId, status } = req.body;

        if (!guid) {
            const errResp = createErrResponse(400, 'guid is required', 'validation error');
            return res.status(400).json(errResp);
        }

        if (!orderId) {
            const errResp = createErrResponse(400, 'order Id is required', 'validation error');
            return res.status(400).json(errResp);
        }

        if (!productId) {
            const errResp = createErrResponse(400, 'product Id is required', 'validation error');
            return res.status(400).json(errResp);
        }

        if (!userId) {
            const errResp = createErrResponse(400, 'user Id is required', 'validation error');
            return res.status(400).json(errResp);
        }

        if (!status) {
            const errResp = createErrResponse(400, 'status is required', 'validation error');
            return res.status(400).json(errResp);
        }

        const queryStr = queryBuilder.buyOfferProduct();
        const [[result]] = await db.query(queryStr, [guid, orderId, productId, userId, status]);


        if (!result || _.isEmpty(result)) {
            const successResp = createErrResponse([]);
            return res.status(400).json(successResp);
        }
        else {
            return res.status(200).json(result);
        }

    } catch (err) {
        console.error(chalk.bold.bgMagenta('FETCH_ORDER_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Fetching Order');
    }
}

exports.discountHandler = async (req, res, next) => {
    try {
        // Validate input parameters
        let { categorySlug, limit, fromPrice, toPrice } = req.body;
        const validationErrors = validateDiscountParams(req.body);
        if (validationErrors.length > 0) {
            return res.json({
                status: 'fail',
                statusCode: 400,
                message: validationErrors[0]
            });
        }
        // prettier-ignore
        const userId = 1, subCategoryIds = null, brandIds = null, displayType = 'WEBSITE';
        categorySlug = categorySlug ? `'${categorySlug.trim().toLowerCase()}'` : null;
        if (!limit) limit = 500;
        if (!fromPrice) fromPrice = null;
        if (!toPrice) toPrice = null;

        const queryStr = queryBuilder.getAllPromotions();
        const result = await db.query(queryStr, [categorySlug, limit, userId, fromPrice, toPrice, subCategoryIds, brandIds, displayType]);

        const newQueryStr = queryBuilder.getPageContent();
        const result2 = await db.query(newQueryStr, ['DISCOUNT']);

        const discounts = { ...result[0] };
        const discountResults = [];
        for (const el in discounts) {
            discountResults.push(discounts[el]);
        }

        res.json({
            status: 'success',
            statusCode: 200,
            discount_banner: result2[0][0].discount_banner,
            discount_content: result2[0][0].discount_content,
            results: discountResults.length,
            data: discountResults
        });
    } catch (err) {
        const error = formatError(
            err.name,
            'OFFERS_ERR',
            err.message,
            `${__filename}, controller = discountHandler`
        );
        writeLog('App', JSON.stringify(error));
        next(new AppError('Error Fetching Offers', 500));
    }
};

exports.txnsTokenAuth = async (txnsToken, user_id) => {
    try {


        let userAuth = await jwtUtils.jwtVerify(txnsToken);
        console.log("userAuth====53", userAuth, (userAuth.otp ? isValidOTPInput(userAuth.otp) : 'no otp'))
        if (userAuth && userAuth.user_id && userAuth.user_id != '') {
            if (isValidOTPInput(userAuth.otp) && userAuth.otp != '' && (userAuth.user_id == user_id)) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.log('Error', error)
        return false;
    }
}

exports.txnTokenAuthGuard = async (txnsToken, user_id) => {
    try {

        const token = txnsToken;

        const jwtPayload = await promisify(jwt.verify)(token, JWT_SECRET);
        let parseData = Utility.parseToken(jwtPayload.details);

        let jsonParse = JSON.parse(parseData);
        let token_userId = parseInt(jsonParse['user_id']);
        let token_otp = parseInt(jsonParse['otp']);

        if (token_userId) {
            if (token_otp && token_userId == user_id) {
                return true;
            }
        }
        return false;

    } catch (err) {
        console.log('Error -------->', err);
        return false;
    }
};



exports.PaymentRedirectPgSeamLess = async (req, res, orderResponse) => {

    try {
        const pay = {
            amount: JSON.parse(orderResponse.payu_amount),
            productinfo: orderResponse.productinfo,
            firstname: orderResponse.name || 'Customer',
            email: orderResponse.email,
            enforce_paymethod: "",
            phone: orderResponse.mobile,
            txnid: orderResponse.payu_guid,
            udf5: 'VISACARD_VOUCHERS',
            rule_overide: (orderResponse.user_level < 3) ? 'N' : 'Y'
        };


        var payment_data = await seamLessPgService.initiatePayment(pay);

        console.log('payment_data', payment_data, "pay", pay);

        if (!payment_data || payment_data == '') {
            return res.status(400).json({
                code: 400,
                error: '',
                message: 'Error in Payment initiatePayment',
                status: 'Error'
            });
        }

        const formData = gyftr.clientEncrypt(JSON.stringify(payment_data));

        return res.json({
            code: 200,
            error: '',
            status: 'SUCCESS',
            formAction: SEAMLESSPG.FORM_ACTION,
            formData
        });


    } catch (err) {
        console.log("PaymentRedirectPgSeamLess Error", err);
        throw err;
    }
}


exports.pgseamlessResponseCheck = async (req, res) => {
    try {
        // Validate request

        if (!req.body.data) {
            const errResp = createErrResponse(403, 'Invalid request 1', 'Inappropriate request body');
            return res.status(403).json(errResp);
        }

        // Process encrypted data
        const decryptedData = await PaymentService.processDecryptedData(req.body.data);
        const txnId = decryptedData.response.externalOrderId;

        // Get user details
        const userDetails = await PaymentService.getUserDetails(txnId);

        // Handle transaction based on status
        if (decryptedData.status === "success") {
            return await handleSuccessTransaction(decryptedData, userDetails, req, res);
        } else if (decryptedData.status === "failed") {
            return await handleFailedTransaction(decryptedData, userDetails, req, res);
        } else {
            return res.redirect(PaymentService.getRedirectUrl(userDetails.order_guid));
        }

    } catch (err) {
        console.error('Error in pg Seamless Response ---->', err);
        throw err;
    }
};

// Helper functions
async function handleSuccessTransaction(decryptedData, userDetails, req, res) {
    const transactionDetail = await PaymentService.getTransactionDetails(decryptedData.response.externalOrderId);
    const payuDetails = PaymentService.formatPayuDetails(transactionDetail);

    if (transactionDetail?.response?.paymentDetails?.transactionStatus === 'success') {
        const pgIdentifier = TransactionService.getPgIdentifier(transactionDetail);
        await PaymentService.updatePgIdentifier(
            decryptedData.response.externalOrderId,
            pgIdentifier,
            userDetails.source
        );

        const txn = await TransactionService.handleSuccessfulTransaction(
            transactionDetail,
            userDetails.user_id,
            decryptedData.response.externalOrderId,
            payuDetails
        );

        return res.redirect(PaymentService.getRedirectUrl(txn.order_guid));
    } else {
        const txn = await TransactionService.handleFailedTransaction(
            userDetails.user_id,
            decryptedData.response.externalOrderId,
            transactionDetail,
            payuDetails
        );

        return res.redirect(PaymentService.getRedirectUrl(txn.order_guid));
    }
}

async function handleFailedTransaction(decryptedData, userDetails, req, res) {
    const payuDetails = PaymentService.formatPayuDetails(decryptedData);

    const txn = await TransactionService.handleFailedTransaction(
        userDetails.user_id,
        decryptedData.response.externalOrderId,
        decryptedData,
        payuDetails
    );

    return res.redirect(PaymentService.getRedirectUrl(txn.order_guid));
}


exports.getPromocodesByguid = async (req, res, next) => {
    try {
        const { guid } = req.body;
        const userId = req.userId;
        if (!guid) {
            const errResp = createErrResponse(400, 'guid is required', 'validation error');
            return res.status(400).json(errResp);
        }
        const queryStr = queryBuilder.getPromocodesByguid();
        const [results] = await db.query(queryStr, [guid, userId]);

        if (!results || _.isEmpty(results)) {
            const successResp = createErrResponse([]);
            return res.status(400).json(successResp);
        }

        const dbDecrypted = decryptFields(results);
        const response = createSuccessResponse(encryptBody(dbDecrypted));
        res.status(200).json(response);
    } catch (err) {
        console.error(chalk.bold.bgMagenta('FETCH_ORDER_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Fetching Order');
    }
};