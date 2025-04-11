const crypto = require('crypto');
var CryptoJS = require('crypto-js');
const config = {}; 
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg]; 
const bcrypt = require('bcryptjs');

const ENC_KEY = config.get('ENC_KEY');
/**
 * General Utility Methods
 */

class Utility {
  
  static async hashThePassword(pass) {
    try{
    return await bcrypt.hash(pass, 8);
    }catch(err){
      console.log('error in hashing password',err);
      throw err;
    }
  }

  static async compareThePassword(pass, hashedPass) {
    try{
    return await bcrypt.compare(pass, hashedPass);
  }catch(err){
    console.log('error',err);
    throw err;
  }
  }

  static encrypt(text) {
    try {
      return CryptoJS.AES.encrypt(text, ENC_KEY).toString();
    } catch (err) {
      console.log('error',err);
      throw err;
    }
  }
  static decrypt(encryptedText) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, ENC_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (err) {
      console.log('error',err);
      throw err;
    }
  }
  static generateToken(userId) {
    const token = `${crypto.randomBytes(4).toString('hex')}-${userId}`;
    return this.encrypt(token);
  }
  static parseToken(token) {
    const decryptedToken = this.decrypt(token);
    
    console.log('Decrypted Token ------------->',decryptedToken);

    const decryptedData = decryptedToken.split('-')[1];

    console.log('Decrypted Data ----------->',decryptedData);

    return decryptedData;
  }

  static generateHash = givenStr => {
    try {
      var hmac = crypto.createHmac('sha256', process.env.SSO_SECRET_KEY);
      hmac.update(givenStr);
      return hmac.digest('hex');
    } catch (err) {
      console.log('generateHash error', err);
      throw err;
    }
  };

  

  static generatePaymentHash = givenStr => {
    try {
      var buffer = crypto.createHmac('sha256', process.env.RBL_BANK_PAYMENT_KEY).update(givenStr).digest();
      return buffer.toString('base64');
    } catch (err) {
      console.log('generatePaymentHash error', err);
      throw err;
    }
  };
}

module.exports = Utility;
