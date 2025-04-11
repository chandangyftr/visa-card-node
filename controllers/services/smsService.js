const axios = require('axios');
const config = {}; 
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg]; 
const { resource } = require('../../app');
const { writeLog } = require('../../utils/logger');

const smsConfigs = config.get('sms');

class SMSService {
  static SMS_URL = smsConfigs.API_URL;
  static FEED_ID = smsConfigs.FEEDID;
  static USERNAME = smsConfigs.USERNAME;
  static PASSWORD = smsConfigs.PASSWORD;
  static SENDER_ID = smsConfigs.SENDERID;
  static OTP_TEMPLATE = smsConfigs.OTP_TEMPLATE;
  static COUPON_TEMPLATE = smsConfigs.COUPON_TEMPLATE;

  static async sendSMS(context, content) {

    console.log('context ------>',context);
    console.log('Content ------>',content);


    try {
      let template = null;
      template = this[`${context}_TEMPLATE`];

      // make the dynamic variables replacements
      content.replacements.forEach(el => {

        template = template.replace('XXXXXX', el);
      });

      // call the API
      const url = `${this.SMS_URL}?feedid=${this.FEED_ID}&username=${this.USERNAME}&password=${
        this.PASSWORD
      }&To=91${content.mobile}&Text=${encodeURIComponent(template)}&senderid=${this.SENDER_ID}`;

      console.log('URL --------->',url);

      const response = await axios.get(url);

      // log response to file
      writeLog('sms', JSON.stringify({ url, response: response.data }));
      return response.data;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
}

module.exports = SMSService;
