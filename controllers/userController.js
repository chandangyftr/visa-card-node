const config = {};
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg];
const { writeLog } = require('../utils/logger');
const jwt = require('jsonwebtoken');
const DB = require('../models/DbQuery');
const queryBuilder = require('../models/queryBuilder');
const chalk = require('chalk');
const Utility = require('../utils/util');
const SMSService = require('./services/smsService');
const { createSuccessResponse, createErrResponse, sendServerError } = require('../utils/api/responseBuilder');
const db = new DB(config.get('db'));
const { SECRET: JWT_SECRET, EXPIRES_IN: JWT_EXPIRY } = config.get('jwt');
const GyFTR = require('../utils/encryptionUtility');
const { ENC_KEY, ENC_IV } = config.get('ENCRYPTION');
const _ = require('lodash');
const gyftr = new GyFTR(ENC_KEY, ENC_IV);
const { decryptFields, encryptBody } = require('./middlewares/encryptionMiddleware');
const fs = require("fs");

// jwt helper function
exports.signJwt = (userId, payload, expiry_date = '', ssoFlag = false) => {

    let payloadObj = JSON.stringify(payload);

    const tokenizedId = Utility.generateToken(payloadObj);

    return jwt.sign({ details: tokenizedId }, JWT_SECRET, { expiresIn: expiry_date ? expiry_date : JWT_EXPIRY });

}

// AuthGuard Middleware for protected routes
exports.authGuard = async (req, res, next) => {
    try {
        const token = req.headers['token'];


        if (!token) {
            return res.status(401).json(createErrResponse(401, 'Please login to get access.', 'Missing API KEY'));
        }

        var jsonParse = await validateToken(token);

        let userId = jsonParse.user_id;
        req.body.user_id = userId;

        // Check the user still exists and is active
        const queryStr = `SELECT status FROM users WHERE id = ${userId};`;
        const [result] = await db.query(queryStr);
        console.log('result--------->', result);
        if (!result) {
            const errResp = createErrResponse(401, 'User does not exit', 'BAD_REQUEST');
            return res.status(401).json(errResp);
        }
        let errMsg;
        switch (result.status) {
            case 'P': // registration pending
                errMsg = 'Please complete your registration first.';
                break;
            case 'I': // account inactive
                errMsg = 'Account blocked, contact the administrator.';
                break;
            case 'N': // reserved for SSO
                errMsg = 'Activity not allowed';
                break;
            default:
                errMsg = null;
        }
        if (errMsg) {
            const errResp = createErrResponse(401, errMsg, 'BAD_REQUEST');
            return res.status(401).json(errResp);
        }

        // set the userId on request
        req.userId = userId;
        next();
    } catch (err) {
        const jwtErrors = ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'];
        if (jwtErrors.includes(err.name)) {
            const errResp = createErrResponse(401, 'Invalid or expired token', 'BAD_REQUEST');
            return res.status(401).json(errResp);
        }
        sendServerError(res, 'AUTH_GUARD');
    }
};

exports.updateProfile = async (req, res, next) => {

    try {

        const { name, email, phone, dob, gender } = req.body;

        if (!name) return res.status(400).json(createErrResponse(400, 'name is required', 'BAD_REQUEST'));

        if (!email) return res.status(400).json(createErrResponse(400, 'email is required', 'BAD_REQUEST'));

        if (!phone) return res.status(400).json(createErrResponse(400, 'mobile is required', 'BAD_REQUEST'));

        if (phone.length < 10 || phone.length > 10) {
            return res.status(400).json(createErrResponse(400, 'Please check your mobile number', 'BAD_REQUEST'));
        }

        if (!dob) return res.status(400).json(createErrResponse(400, 'dob is required', 'BAD_REQUEST'));

        const user_id = req.userId;

        const queryStr = queryBuilder.updateProfile();

        await db.query(queryStr, [user_id, gyftr.dbEncrypt(name),
            gyftr.dbEncrypt(email), gyftr.dbEncrypt(phone), dob, gender]);

        var response = createSuccessResponse('', 'Users Updated Successfully');
        res.status(200).json(response);

    }
    catch (err) {
        console.log(err)
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Updating Profile');
    }

}

exports.getMyWallet = async (req, res, next) => {
    try {

        const userId = req.userId;
        const clientId = req.clientId;

        const queryStr = queryBuilder.getWallet();
        const [result] = await db.query(queryStr, [userId, clientId]);

        if (result.error) {
            const errResp = createErrResponse(400, result[0].error, 'validation error');
            return res.status(400).json(errResp);
        }

        const dbDecrypted = decryptFields(result);
        const response = createSuccessResponse(encryptBody(dbDecrypted));

        res.status(200).json(response);

    }
    catch (err) {
        console.error(chalk.bold.bgMagenta('MY_WALLET_ERR:'), err);
        writeLog('app', JSON.stringify(err));
        sendServerError(res, 'Error Get My Wallet');
    }

}

// *******************  New Apis **********************

exports.checkMobileNumber = async (req, res, next) => {
    try {

        const { mobile } = req.body;

        if (!mobile) return res.status(400).json(createErrResponse(400, 'mobile is required', 'BAD_REQUEST'));

        if (mobile.length < 10 || mobile.length > 10) {
            return res.status(400).json(createErrResponse(400, 'Please check your mobile number', 'BAD_REQUEST'));
        }

        let userMobile = gyftr.dbEncrypt(mobile);

        const queryStr = queryBuilder.mobileNumberCheck();

        const [[result]] = await db.query(queryStr, [userMobile, 'login']);
        let response = {};
        if (result.status == 'N') {
            response = createSuccessResponse(result);
            return res.status(200).json(response);
        }

        await SMSService.sendSMS('OTP', { mobile, replacements: [result.otp] });

        let data = {
            success: result.success,
            status: result.status
        }

        response = createSuccessResponse(data, 'OTP send Successfully');
        return res.status(200).json(response);

    }
    catch (err) {
        console.error(chalk.bold.bgMagenta('USER_EXIST_ERR:'), err);
        sendServerError(res, 'Error');
    }
};

exports.Login_old = async (req, res, next) => {
    try {

        let mobile = req.body.mobile;
        let otp = req.body.otp;

        if (!mobile) return res.status(400).json(createErrResponse(400, 'mobile is required', 'BAD_REQUEST'));

        if (!otp) return res.status(400).json(createErrResponse(400, 'otp is required', 'BAD_REQUEST'));

        let userMobile = gyftr.dbEncrypt(mobile);

        const queryStr = queryBuilder.userLogin();

        console.log('User Mobile ---------->', userMobile);

        console.log('Otp -------->', otp);


        const result = await db.query(queryStr, [userMobile, otp]);


        if (result[0][0].error) {
            const errResp = createErrResponse(400, result[0][0].error, 'otp Error');
            return res.status(400).json(errResp);
        }

        let payload = {
            user_id: result[0][0].id,
            name: gyftr.dbDecrypt(result[0][0].name),
            email: gyftr.dbDecrypt(result[0][0].email),
            mobile: gyftr.dbDecrypt(result[0][0].phone),
        }

        const token = this.signJwt(result[0][0].id, payload);
        res.set('token', token);

        let finalResult = {
            id: result[0][0].id,
            name: gyftr.dbDecrypt(result[0][0].name),
            email: gyftr.dbDecrypt(result[0][0].email),
            phone: gyftr.dbDecrypt(result[0][0].phone),
            status: result[0][0].status,
            gender: result[0][0].gender,
            dob: result[0][0].dob,
            profile_image: result[0][0].profile_image

        }
        const dbDecrypted = decryptFields(finalResult);
        const response = createSuccessResponse(encryptBody(dbDecrypted));
        response.token = token;
        return res.status(200).json(response);
    }
    catch (err) {
        console.log('Error ------->', err)
        res.status(400).json(createErrResponse(400, 'Invalid Credentials', 'BAD_REQUEST'));
    }
};

exports.Login = async (req, res, next) => {
    try {

        let mobile = req.body.mobile;
        let otp = req.body.otp;

        if (!mobile) return res.status(400).json(createErrResponse(400, 'mobile is required', 'BAD_REQUEST'));

        if (!otp) return res.status(400).json(createErrResponse(400, 'otp is required', 'BAD_REQUEST'));

        let userMobile = gyftr.dbEncrypt(mobile);

        const queryStr = queryBuilder.userLogin();


        const result = await db.query(queryStr, [userMobile, otp]);


        if (result[0][0].error) {
            const errResp = createErrResponse(400, result[0][0].error, 'otp Error');
            return res.status(400).json(errResp);
        }


        let payload = {
            user_id: result[0][0].id,
            name: gyftr.dbDecrypt(result[0][0].name),
            email: gyftr.dbDecrypt(result[0][0].email),
            mobile: gyftr.dbDecrypt(result[0][0].phone),
        }

        var token = await generateJWTToken(payload);
        res.set('token', token);

        let finalResult = {
            id: result[0][0].id,
            name: gyftr.dbDecrypt(result[0][0].name),
            email: gyftr.dbDecrypt(result[0][0].email),
            phone: gyftr.dbDecrypt(result[0][0].phone),
            status: result[0][0].status,
            gender: result[0][0].gender,
            dob: result[0][0].dob,
            profile_image: result[0][0].profile_image

        }

        const dbDecrypted = decryptFields(finalResult);
        const response = createSuccessResponse(encryptBody(dbDecrypted));
        response.token = token;
        return res.status(200).json(response);
    }
    catch (err) {
        console.log('Error ------->', err)
        res.status(400).json(createErrResponse(400, 'Invalid Credentials', 'BAD_REQUEST'));
    }
};
async function generateJWTToken(payload) {
    var i = 'Vouchagram'; // Issuer
    var s = 'gyftr@gyftr.com'; // Subject
    var a = 'https://gyftr.com'; // Audience// SIGNING OPTIONS
    var signOptions = {
        issuer: i,
        subject: s,
        audience: a,
        expiresIn: 60 * 60 * 24,
        algorithm: 'RS256'
    };

    // PRIVATE key
    const privateKEY = fs.readFileSync('./private.key', 'utf8');

    return jwt.sign(payload, privateKEY, signOptions);
}

/*
 *** validate jwt token
 */
async function validateToken(token) {
    var i = 'Vouchagram'; // Issuer
    var s = 'gyftr@gyftr.com'; // Subject
    var a = 'https://gyftr.com'; // Audience// SIGNING OPTIONS
    var verifyOptions = {
        issuer: i,
        subject: s,
        audience: a,
        expiresIn: 60 * 60 * 24,
        algorithm: ['RS256']
    };

    //PUBLIC key
    var publicKEY = fs.readFileSync('./public.key', 'utf8');
    return jwt.verify(token, publicKEY, verifyOptions);
}
//Capping wallet Amount Getting
async function getCappingWallet(clientid, userid) {
    try {
        var queryStr = queryBuilder.getCappingWallet();
        return await db.query(queryStr, [clientid, userid]);

    } catch (err) {
        console.log(err);
    }
}

exports.Register = async (req, res, next) => {
    try {

        const { mobile, name, email, otp } = req.body;


        if (!mobile) return res.status(400).json(createErrResponse(400, 'mobile is required', 'BAD_REQUEST'));

        if (mobile.length < 10 || mobile.length > 10) {
            return res.status(400).json(createErrResponse(400, 'Please check your mobile number', 'BAD_REQUEST'));
        }

        if (!email) return res.status(400).json(createErrResponse(400, 'email is required', 'BAD_REQUEST'));

        let userMobile = gyftr.dbEncrypt(mobile);
        let userName = gyftr.dbEncrypt(name);
        let userEmail = gyftr.dbEncrypt(email);


        if (!otp) {

            const queryStr = queryBuilder.registerUserSendOtp();

            const [[result]] = await db.query(queryStr, [`${userMobile}`]);

            if (result.error) {
                const errResp = createErrResponse(401, result.error, 'BAD_REQUEST');
                return res.status(401).json(errResp);
            }
            else {
                if (result.otp_status == 1) {
                    await SMSService.sendSMS('OTP', { mobile, replacements: [result.otp] });
                }
            }
            let finalResult = {
                status: result.status
            }

            const response = createSuccessResponse(finalResult, 'OTP Send Successfully');
            return res.status(200).json(response);
        }
        else {

            const queryStr = queryBuilder.registerUser();

            const [[result]] = await db.query(queryStr, [`${userName}`, `${userMobile}`, `${userEmail}`, `${otp}`]);

            if (result.error) {
                return res.status(400).json(createErrResponse(400, result.error, 'BAD_REQUEST'));
            }

            let payload = {
                user_id: result.id,
                name: gyftr.dbDecrypt(result.name),
                email: gyftr.dbDecrypt(result.email),
                mobile: gyftr.dbDecrypt(result.phone),
            }

            var token = await generateJWTToken(payload);
            res.set('token', token);

            let finalResult = {
                id: result.id,
                name: gyftr.dbDecrypt(result.name),
                email: gyftr.dbDecrypt(result.email),
                phone: gyftr.dbDecrypt(result.phone),
                status: result.status,
                gender: result.gender,
                dob: result.dob,
                profile_image: result.profile_image
            }

            const dbDecrypted = decryptFields(finalResult);


            let jsonObj = {
                code: 201,
                status: 'SUCCESS',
                error: '',
                message: '',
                data: encryptBody(dbDecrypted)
            }

            jsonObj.token = token;
            return res.status(201).json(jsonObj);


        }


    }
    catch (err) {
        console.log('Error --------->', err)
        res.status(400).json(createErrResponse(400, 'Invalid Credentials', 'BAD_REQUEST'));
    }
};

exports.getUserDetail = async (req, res, next) => {
    try {

        const userId = req.userId;
        const queryStr = queryBuilder.getUserDetail();

        const [[getUserDetails]] = await db.query(queryStr, [userId]);

        if (getUserDetails.error) {
            const errResp = createErrResponse(400, getUserDetails.error, 'user Details Error');
            return res.status(400).json(errResp);
        }

        else {

            var payload = {
                user_id: getUserDetails.id,
                name: gyftr.dbDecrypt(getUserDetails.name),
                mobile: gyftr.dbDecrypt(getUserDetails.phone),
                email: gyftr.dbDecrypt(getUserDetails.email),
            };

            var token = await generateJWTToken(payload);


            const dbDecrypted = decryptFields(getUserDetails);
            const response = createSuccessResponse(encryptBody(dbDecrypted));

            response.token = token;
            return res.status(200).json(response);

        }

    }
    catch (err) {
        console.error(chalk.bold.bgMagenta('USER_DETAIL_ERR:'), err);
        sendServerError(res, 'Error');
    }
}