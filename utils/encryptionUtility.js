const { createCipheriv, createDecipheriv } = require('crypto');
const CryptoJS = require('crypto-js');

/**
 * @class GyFTR : A common module for ENCRYPTION of PI data across DB & Client-End side
 * @param : ENC_KEY | string
 * pass this ENC_KEY at both client and DB end for encryption
 * initialize the class with same ENC_KEY to use its encryption methods.
 *
 * NOTE: SERVER CAN DECRYPT ANY ENCRYPTED MSG from DB OR CLIENT SIDE
 * @author: Anurag Kumar
 */


class GyFTR {
  constructor(ENC_KEY, ENC_IV) {
    this.ENC_KEY = ENC_KEY;
    this.ENC_ALGO = 'aes-256-cbc';
    this.ENC_IV = ENC_IV;
  }

  /**
   * @function convertCryptKey(@param):
   * It is a key derivation function (KDF), used to
   * derive a key from the encryption password
   * @param {1} strKey | string
   * NOTE: In Cryptography encryption_key and encryption_password are not same thing.
   */

  convertCryptKey(strKey) {
    const newKey = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const bufStrKey = Buffer.from(strKey);
    for (let i = 0; i < bufStrKey.length; i++) {
      newKey[i % 16] ^= bufStrKey[i];
    }
    return newKey;
  }

  clientDecrypt(encryptedStr) {
    try {
      if (!encryptedStr) return null;
      var bytes = CryptoJS.AES.decrypt(encryptedStr, this.ENC_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (err) {
      console.log('Error in clientDecrypt', err);
      throw err;
    }
  }

  clientEncrypt(plainText) {
    try {
      if (!plainText) return null;
      return CryptoJS.AES.encrypt(plainText, this.ENC_KEY).toString();
    } catch (err) {
      console.log('Error in clientEncrypt', err);
      throw err;
    }
  }
  
  dbEncrypt(data) {
    if (!data) return null;
    const cipher = createCipheriv(this.ENC_ALGO, this.ENC_KEY, this.ENC_IV);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('base64');
  }

  dbDecrypt(data) {

    if (!data) return null;
    const decipher = createDecipheriv(this.ENC_ALGO, this.ENC_KEY, this.ENC_IV);
    const decrypted = decipher.update(data, 'base64');
    
    return Buffer.concat([decrypted, decipher.final()]).toString();
  }
}

module.exports = GyFTR;
