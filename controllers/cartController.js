const config = JSON.parse(process.env.secret); 
const chalk = require('chalk');
const _ = require('lodash');
const validator = require('validator');
const DB = require('../models/DbQuery');
const queryBuilder = require('../models/queryBuilder');
const { createSuccessResponse, createErrResponse, sendServerError } = require('../utils/api/responseBuilder');
const { writeLog } = require('../utils/logger');
const db = new DB(config.db);
const { decryptFields, encryptBody } = require('./middlewares/encryptionMiddleware');
const GyFTR = require('../utils/encryptionUtility');
const { use } = require('../routes');
const { ENC_KEY, ENC_IV } = config.ENCRYPTION;
const gyftr = new GyFTR(ENC_KEY, ENC_IV);
const utils = require('../utils/utils');
const request = require('request');


exports.updateCartItemQty = async (req, res, next) => {
    try {

        const cartItemId = req.body.cart_item_id;

        if (!cartItemId) {
            const errResp = createErrResponse(400, 'cart_item_id is required', 'validation error');
            return res.status(400).json(errResp);
        }
        if (isNaN(cartItemId)) {
            const errResp = createErrResponse(400, 'cart_item_id is invalid', 'validation error');
            return res.status(400).json(errResp);
        }
        const userId = req.userId;
        const updateTypes = [1, 0];
        if (!updateTypes.includes(req.body.type)) {
            const errResp = createErrResponse(400, 'type should be one of 0 or 1.', 'validation error');
            return res.status(400).json(errResp);
        }
        const queryStr = queryBuilder.updateCartItemQty();
        const [result] = await db.query(queryStr , [ cartItemId, userId, req.body.quantity, req.body.type ]);
        if (result[0].error) {
            const errResp = createErrResponse(400, result[0].error, 'update error');
            return res.status(400).json(errResp);
        }

        const response = createSuccessResponse(result);
        res.status(200).json(response);
    } catch (err) {
        console.error(chalk.bold.bgMagenta('CART_QTY_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Updating Cart');
    }
};


exports.updateGiftingDetails = async (req, res, next) => {
    try {
       if (req.body.name == "") {
            let errResp = createErrResponse(400, 'Name is required', 'validation error');
            return res.status(400).json(errResp);
        }
        if (req.body.email == "") {
            let errResp = createErrResponse(400, 'Email is required', 'validation error');
            return res.status(400).json(errResp);
        }
        if (!(/^\S+@\S+\.\S+$/.test(req.body.email)))
            {
                let errResp = createErrResponse(400, 'Invalid Email id', 'validation error');
            return res.status(400).json(errResp);
            }
        if (req.body.phone == "") {
            let errResp = createErrResponse(400, 'Phone is required', 'validation error');
            return res.status(400).json(errResp);
        }
        if (req.body.phone.length !=10) {
            let errResp = createErrResponse(400, 'Invalid Phone number', 'validation error');
            return res.status(400).json(errResp);
        }
        if (req.body.message == "") {
            let errResp = createErrResponse(400, 'Message is required', 'validation error');
            return res.status(400).json(errResp);
        }
        if (req.body.gift_image == "") {
            let errResp = createErrResponse(400, 'Gift Image is required', 'validation error');
            return res.status(400).json(errResp);
        }
        const userId = req.userId;
         var phone=gyftr.dbEncrypt(req.body.phone);
        const queryStr = queryBuilder.updateGiftingDetails();
        const [result] = await db.query(queryStr , [userId, req.body.message, req.body.gift_image, gyftr.dbEncrypt(req.body.name),gyftr.dbEncrypt(req.body.email), phone,req.body.gift_name ]);
        
        if (result[0].error) {
            const errResp = createErrResponse(400, result[0].error, 'update error');
            return res.status(400).json(errResp);
        }

        const response = createSuccessResponse([]);
        response.message=result[0].success;
        res.status(200).json(response);
    } catch (err) {
        console.error(chalk.bold.bgMagenta('GIFT_UPDSTE_CART_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Updating Cart');
    }
};
exports.deleteCartItem = async (req, res, next) => {
    try {
        const cartItemId = req.body.cartItemId;
        const userId = req.userId;
        if (!cartItemId) {
            const errResp = createErrResponse(400, 'cartItemId is required', 'validation error');
            return res.status(400).json(errResp);
        }
        if (isNaN(cartItemId)) {
            const errResp = createErrResponse(400, 'cartItemId is invalid', 'validation error');
            return res.status(400).json(errResp);
        }
        const queryStr = queryBuilder.removeCartItem();

        await db.query(queryStr , [cartItemId, userId]);
        const response = {
            code: 200,
            status: 'SUCCESS',
            message: "Cart item deleted successfully",
        };
        res.status(200).json(response);
    } catch (err) {
        console.error(chalk.bold.bgMagenta('CART_DELETE_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Deleting Cart');
    }
};

exports.getCartItems = async (req, res, next) => {
    try {
        const userId = req.userId;

        console.log('User Id ------->',userId);

        const queryStr = queryBuilder.fetchCart();
        const result = await db.query(queryStr , [ userId, null ]);

        let newArray = [];

        result[0].forEach((item)=>{


            newArray.push({
                cart_item_id:  item.cart_item_id,
                cart_item_qty : item.cart_item_qty,
                cart_delivery_name : gyftr.dbDecrypt(item.cart_delivery_name),
                cart_delivery_email : gyftr.dbDecrypt(item.cart_delivery_email),
                cart_delivery_phone :gyftr.dbDecrypt(item.cart_delivery_phone),
                brand_icon_url : item.brand_icon_url,
                gifting_text : item.gift_text,
                gifting_url : item.gift_img_url,
                gift_name:item.gift_name,
                brand_name : item.brand_name,
                slug : item.slug,
                checkout_step:  item.checkout_step,
                product_id : item.product_id,
                product_available_qty : item.product_available_qty,
                product_price: item.product_price,
                product_name : item.product_name,
                offer_brand_icon_url : item.offer_brand_icon_url,
                offer_brand_image_url : item.offer_brand_image_url,
                offer_brand_name : item.offer_brand_name,
                offer_product_price : item.offer_product_price,
                offer_product_name : item.offer_product_name,
                promocode_value : item.promocode_value,
                promocode_offer_type  :  item.promocode_offer_type,
                product_qty : item.product_qty,
                offer_product_qty : item.offer_product_qty,
                cashback_offer_value :  item.cashback_offer_value,
                cashback_offer_type : item.cashback_offer_type,
                cashback_offer_name : item.cashback_offer_name,
                product_discount : item.product_discount,
                offer_product_discount : item.offer_product_discount,
                service_charge : item.service_charge,
                service_charge_gst : item.service_charge_gst
            })
        })

        const dbDecrypted = decryptFields(newArray);
        const response = createSuccessResponse(encryptBody(dbDecrypted));

        res.status(200).json(response);

    } catch (err) {
        console.error(chalk.bold.bgMagenta('CART_FETCH_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Fetching Cart');
    }
};

exports.updateDeliveryDtls = async (req, res, next) => {
    try {

        const cartItemId = req.body.cartItemId;
        const email = req.body.email;
        const mobile = req.body.mobile;
        const name = req.body.name;
        const userId = req.userId;

        if (!name) {
            const errResp = createErrResponse(400, 'name is required', 'validation error');
            return res.status(400).json(errResp);
        }
        if (!mobile) {
            const errResp = createErrResponse(400, 'mobile is required', 'validation error');
            return res.status(400).json(errResp);
        }
        if (!email) {
            const errResp = createErrResponse(400, 'email is required', 'validation error');
            return res.status(400).json(errResp);
        }
        if (email && !validator.isEmail(email)) {
            const errResp = createErrResponse(400, 'Invalid email', 'validation error');
            return res.status(400).json(errResp);
        }
        if (mobile && !validator.isMobilePhone(`${mobile}`, 'en-IN')) {
            const errResp = createErrResponse(400, 'Invalid mobile', 'validation error');
            return res.status(400).json(errResp);
        }

         let cartId = cartItemId ? cartItemId : null;

        const queryStr = queryBuilder.updateDeliveryDtls();
        const [result] = await db.query(queryStr , [cartId, userId, gyftr.dbEncrypt(name), gyftr.dbEncrypt(email), gyftr.dbEncrypt(mobile)]);
        
        if (result[0].error) {
            const errResp = createErrResponse(400, result[0].error, 'update error');
            return res.status(400).json(errResp);
        }
        const response = {
            code: 200,
            status: 'SUCCESS',
            error: '',
            message: "Cart item updated successfully.",
        }
        return res.status(200).json(response);
    } catch (err) {
        console.error(chalk.bold.bgMagenta('DELIVERY_UPDATE_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Updating Cart');
    }
};

exports.getUserBrandOrderDetail = async (req, res, next) => {

    try {
        var options = req.body;
        var user_id = req.body.user_master_id;
        var brand_id = options.brand_id;

        const queryStr = queryBuilder.getBrandOrderDetailByUser();
        const result = await db.query(queryStr , [user_id, brand_id]);

        if (result[0][0].error) {
            const errResp = createErrResponse(400, result[0].error, 'get Brand Order by user error');
            return res.status(400).json(errResp);
        }

        const response = createSuccessResponse(result);
        res.status(200).json(response);

    } catch (err) {
        console.error(chalk.bold.bgMagenta('CART_BRAND_ORDER_DETAIL_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Brand Order Detail Cart');
    }
}

exports.giftTemplates = async (req, res, next) => {
    try{

        const queryStr = queryBuilder.gift_detail();
        const result = await db.query(queryStr);

        if (result[0][0].error) {
            const errResp = createErrResponse(400, result[0].error, 'get Remove Buy Now Cart Item error');
            return res.status(400).json(errResp);
        }

        let responseObj = {
            occasions: result[0],
            gift_images: result[1],
            gift_texts: result[2]
        }

        const response = createSuccessResponse(responseObj);
        res.status(200).json(response);

    }
    catch(err){
        console.error(chalk.bold.bgMagenta('GIFT_TEMPLATE_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error gift Template');
    }

}

async function checkOtp(otp, mobile, section) {
    try {

        const queryStr = queryBuilder.otpValidate();

        console.log('Query String -------->',queryStr);

        const result = await db.query(queryStr , [otp, mobile, section]);

        let data = result[0][0]
        if (data.status == '1') {
            return true
        }
        return false;
    } catch (err) {
        console.error(chalk.bold.bgMagenta('CHECK_OTP_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Check Otp Error');
    }
}

var rblPaymentRedirect = function (req, res, orderResponse) {
    var data = req.body;
    var payload = data.name + "|" + data.mobile + "|" + data.email + "|" + orderResponse.sessionid + "|" + orderResponse.uniqueid + "|" + orderResponse.payu_amount + "|" + orderResponse.payu_guid + "|" + orderResponse.voucherQuantity;
    var paymenthashgnrte = crypto.getPaymentHash(payload);

    //logs writes
    utils.writeLog("rblpayment", JSON.stringify(payload));
    utils.writeLog("rblpayment", paymenthashgnrte);

    const pay = {
        "Name": req.body.name,
        "MobileNumbers": req.body.mobile,
        "Emailid": req.body.email,
        "Sessionid": orderResponse.sessionid,
        "Uniqueid": orderResponse.uniqueid,
        "Checksum": paymenthashgnrte,
        "TotalOrderSum": JSON.parse(orderResponse.payu_amount),
        "UniqueTransactionID": orderResponse.payu_guid,
        "voucherQuantity": orderResponse.voucherQuantity,
    };

    utils.writeLog("rblpayment", JSON.stringify(pay));
    request.post({
        headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
        url: config.rblpayment.RBL_PAYMENT_URL,
        form: pay
    }, function (error, httpRes, body) {
        if (error)
            res.send(
                {
                    status: false,
                    message: error.toString()
                }
            );

        console.log(config.rblpayment.RBL_HOST + httpRes.headers.location.toString())
        if (httpRes.statusCode === 200) {
            res.send(body);
        } else if (httpRes.statusCode >= 300 &&
            httpRes.statusCode <= 400) {
            res.send({
                "code": 200,
                "error": "",
                "message": "",
                "status": "SUCCESS",
           
                "data": config.rblpayment.RBL_HOST + httpRes.headers.location.toString() + "?Name=" + req.body.name + "&MobileNumbers="
                    + req.body.mobile + "&Emailid=" + req.body.email + "&Sessionid=" + orderResponse.sessionid +
                    "&Uniqueid=" + orderResponse.uniqueid + "&Checksum=" + paymenthashgnrte + "&TotalOrderSum=" +
                    JSON.parse(orderResponse.payu_amount) + "&UniqueTransactionID=" + orderResponse.payu_guid + "&voucherQuantity=" + orderResponse.voucherQuantity
            })
        }
    })
};