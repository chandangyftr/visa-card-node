const fs = require("fs");
var CryptoJS = require("crypto-js");
var successResponse = function () {
    return {
        "code": 200,
        "error": "",
        "message": "",
        "status": "SUCCESS",
        "data": {}
    }
};

function checkMobile(phoneNumber) {
    if (typeof phoneNumber !== 'string') {
        return false;
    }

    // Single regex pattern to validate Indian mobile numbers
    const MOBILE_NUMBER_PATTERN = /^[6-9]\d{9}$/;
    
    return MOBILE_NUMBER_PATTERN.test(phoneNumber);
}



var dateTimeFormat = function dateTimeFormat() {
    const now = new Date();
    const year = "" + now.getFullYear();
    let month = "" + (now.getMonth() + 1);
    if (month.length == 1) {
        month = "0" + month;
    }
    let day = "" + now.getDate();
    if (day.length == 1) {
        day = "0" + day;
    }
    let hour = "" + now.getHours();
    if (hour.length == 1) {
        hour = "0" + hour;
    }
    let minute = "" + now.getMinutes();
    if (minute.length == 1) {
        minute = "0" + minute;
    }
    let second = "" + now.getSeconds();
    if (second.length == 1) {
        second = "0" + second;
    }
    return year + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second;
};

var dateFormat = function dateFormat() {
    const now = new Date();
    const year = "" + now.getFullYear();
    let month = "" + (now.getMonth() + 1);
    if (month.length == 1) {
        month = "0" + month;
    }
    let day = "" + now.getDate();
    if (day.length == 1) {
        day = "0" + day;
    }
    return year + "-" + month + "-" + day;
};

function writeLog(type, log_str) {
    var fileName = dateFormat() + ".log";
    fs.appendFile("./logs/" + type + "/" + fileName, (dateTimeFormat() + ":" + log_str + "\n"), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });
}



function checkCard(cardNumber) {
    if (!cardNumber || typeof cardNumber !== 'string') {
        return false;
    }

    const VALID_CARD_LENGTHS = new Set([15, 16, 19]);
    return VALID_CARD_LENGTHS.has(cardNumber.length);
}

function validateEmail(emailField) {
    var reg = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;

    if (reg.test(emailField) === false) {
        return false;
    }
    return true;
}

function validateName(name) {
    var reg = /^[A-Za-z ]+$/;
    if (reg.test(name) === false) {
        return false
    }
    return true;
}

const key = "gyftr@123";


function encryptData(data) {
    let ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), key);
    return ciphertext.toString()
}

function deEncryptRequest(data) {
    if (data.body.user_id && data.body.user_id.length > 20) {
        let bytes = CryptoJS.AES.decrypt(data.body.user_id.toString(), key);
        bytes = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        data.body.user_id = bytes;
        return data
    } else {
        return data
    }
}

function deEncryptData(data) {
    let bytes = CryptoJS.AES.decrypt(data.toString(), key);
    bytes = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    return bytes
}


module.exports = {
    successResponse: successResponse,
    dateTimeFormat: dateTimeFormat,
    writeLog: writeLog,
    checkMobile: checkMobile,
    checkCard: checkCard,
    validateEmail: validateEmail,
    validateName: validateName,
    encryptData: encryptData,
    deEncryptData: deEncryptData,
    deEncryptRequest: deEncryptRequest
};
