const config = {}; 
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg]; 
const PG = config.get('SEAMLESSPG');
const CryptoJS = require('crypto-js');
const { default: axios } = require('axios');
const DB = require('../../models/DbQuery');
const db = new DB(config.get('db'));


async function writeLogDB(type, log_str) {
  var reqJson = log_str.replace(/["']/g, "");
  try {
      let queryStr = `CALL save_service_log(?,?);`;
      await db.query(queryStr, [type, reqJson]);
  } catch (err) {
     console.error('err thrown: ' + err.stack);
  }
}

/**
 * Decrypt data
 * @param {*} encryptedStr 
 * @returns 
 */
exports.clientDecrypt = async (encryptedStr) => {
  try {
    const { ENC_SECRET_KEY } = PG;
    if (!encryptedStr) return null;
    var bytes = CryptoJS.AES.decrypt(encryptedStr, ENC_SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (err) {
        return false;
  }
}

/**
 * Encrypt data
 * @param {*} plainText 
 * @returns 
 */
exports.clientEncrypt = async (plainText) => {
  try {
    const { ENC_SECRET_KEY } = PG;
    if (!plainText) return null;
    return CryptoJS.AES.encrypt(plainText, ENC_SECRET_KEY).toString();
  } catch (err) {
    return false;
  }
}


//send request
const sendHttpCurlRequest = async (url, requestMethod = "GET", postParams = null, headers = null) => {
  try {
    let options;
    options = {
      'method': requestMethod,
      'url': url,
      'headers': headers,
      data: postParams ? postParams : '',
      timeout: 40000

    };
    writeLogDB('seamLessPg', JSON.stringify(options));
    let res = await axios(options);
    if (res) {
      writeLogDB('seamLessPg', `Response: ${JSON.stringify(res.data)}`);
        return res.data;
    }
    return false;
  } catch (error) {
    writeLogDB('seamLessPg', `Exception in sendHttpCurlRequest(): ${error}`);
    return false;
  }
}


exports.getAccessToken = async(amount) => {
  try {
    const { CALLER_ID, API_BASE_URL, USERNAME, PASSWORD } = PG;
    const URL = `${API_BASE_URL}/getAccessToken`;
    if(amount){
      let headers;
      headers = {
        'Content-Type': 'application/json',
      }
      let params = {
        username: USERNAME,
        password: PASSWORD,
        callerId: CALLER_ID,
        amount: `${amount}`
      }

      if (URL) {
        let authToken = await sendHttpCurlRequest(URL, "POST", params, headers);
        if (!authToken.status || !authToken.token || authToken.messageCode != "1051") {
          return false;
        }
        return authToken.token;
      }
    }
    return false;
  } catch (error) {
        return false;
  }
}



exports.initiatePayment = async (params) => {
  try {
    if (!params) return false;
    const { CALLER_ID } = PG;
    let hashData = {
      "externalOrderid": params.txnid,
      "callerId": CALLER_ID,
      "productInfo": params.productinfo,
      "brandId": '0',
      "currency": "INR",
      "name": params.firstname,
      "amount": `${params.amount}`,
      "email": params.email,
      "contact": params.phone,
      "productId": 0,
      "rule_overide":params.rule_overide,
      "paymentMethod": params.enforce_paymethod,
      "ud1": params.txnid,
      "ud2": "",
      "ud3": "",
      "ud4": "",
      "ud5": params.udf5
    }

    let encryptData = await this.clientEncrypt(JSON.stringify(hashData));
    if (!encryptData) return false;
    let accessToken  = await this.getAccessToken(params.amount);
    if (!accessToken) return false;
    return {
      data: encryptData,
      token: accessToken
    }
  } catch (err) {
    return false;
  }
}


exports.getTransactionStatus = async (orderId) => {
  try {
    
    if (!orderId){
      throw new Error('orderId is missing');
    }
    const { API_BASE_URL, USERNAME, PASSWORD } = PG;
    const TRANSACTION_STATUS_URL = `${API_BASE_URL}/paymentStatus`;

    let bodyData = {
      "transactionId": orderId
    };
    let encBody = await this.clientEncrypt(JSON.stringify(bodyData));
    let params = {
      "data": encBody
    }
    let headers = {
      'Content-Type': 'application/json',
      'username': USERNAME,
	    'password': PASSWORD

    }
    let transactionStatus = await sendHttpCurlRequest(TRANSACTION_STATUS_URL, "POST", params, headers);
    if(!transactionStatus || !transactionStatus.data) return false;
    return await this.clientDecrypt(transactionStatus.data);
  } catch (err) {
    return false;
  }
}

exports.refundStatus = async (enc_data, payunor) => {

  try {
    if (!enc_data){
      throw new Error('enc_data is missing');
    }
    const { API_BASE_URL, USERNAME, PASSWORD } = PG;
    let configdata = {
      method: 'post',
      maxBodyLength: Infinity,
      url: API_BASE_URL + '/refundStatus',
      headers: {
        username: USERNAME,
        password: PASSWORD
      },
      data: { data: enc_data }
    }
    let resp = await axios.request(configdata);
    writeLogDB('seamlesspg_refund_status',JSON.stringify({response:resp.data.data}));
    return await this.clientDecrypt(resp.data.data, payunor);
  } catch (error) {
    writeLogDB('seamlesspg_refund_status ', JSON.stringify(error));
    console.log('Error ----->',error);
    throw error;
  }
}


exports.refund = async (enc_data, payunor, r) => {
  try {
    if (!enc_data){
      throw new Error('enc_data is missing');
    }
    const { API_BASE_URL, USERNAME, PASSWORD } = PG;
    let configdata = {
      method: 'post',
      maxBodyLength: Infinity,
      url: API_BASE_URL + '/refund',
      headers: {
        username: USERNAME,
        password: PASSWORD
      },
      data: { data: enc_data }
    };
    let resp = await axios.request(configdata);
    let dec_data = await this.clientDecrypt(resp.data.data, payunor);
    writeLogDB('seamlesspg_refund', JSON.stringify({ guid: r.refund_txn_guid, response: resp.data.data }));
    return dec_data;

  } catch (error) {
    writeLogDB('seamlesspg_refund', JSON.stringify({error}));
    console.log('Error',error);
    throw error;
  }
}
