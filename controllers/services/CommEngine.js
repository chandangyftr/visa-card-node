const config = {};
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg];
const chalk = require('chalk');
const axios = require('axios');
const aesEncrypt = require('aes-everywhere');
const { writeLog } = require('../../utils/logger');
const DB = require('../../models/DbQuery');
const queryBuilder = require('../../models/queryBuilder');
const db = new DB(config.get('db'));
const commNgnConfig = config.get('commNgn');

const GyFTR = require('../../utils/encryptionUtility');
const { ENC_KEY, ENC_IV } = config.get('ENCRYPTION');
const gyftr = new GyFTR(ENC_KEY, ENC_IV);

/**
 * Constants for status and message types
 */
const STATUS = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  SUCCESS_LOWER: 'success',
  ERROR_LOWER: 'error',
  FAILED: 'failed'
};

/**
 * CommEngine Services: Common Module
 */

class CommEngine {
  // set the commNgn configs
  static BASE_URL = commNgnConfig.BASE_URL;
  static SEND_VOUCHER_URL = `${this.BASE_URL}v1/voucher/send`;
  static SEND_VOUCHER_URL_MULTIPLE = `${this.BASE_URL}v2/voucher/send`;
  static QTY_CHECK_URL = `${this.BASE_URL}v1/voucher/quantity`;
  static VOUCHER_DTL_URL = `${this.BASE_URL}v1/voucher/checkstatus`;
  static VOUCHER_STATUS_URL = `${this.BASE_URL}v1/voucher/detail`;
  static ENC_KEY = commNgnConfig.ENC_KEY;
  static USERNAME = commNgnConfig.USERNAME;
  static PASSWORD = commNgnConfig.PASSWORD;
  static TemplateId = commNgnConfig.TemplateId;
  static PromoTemplateId = commNgnConfig.PromoTemplateId;

  static GiftTemplateId = commNgnConfig.GiftTemplateId;
  static GiftPromoTemplateId = commNgnConfig.GiftPromoTemplateId;


  // Encrypt the guid
  static encrypt(raw) {
    return aesEncrypt.encrypt(JSON.stringify(raw), this.ENC_KEY);
  }

  static decrypt(encrypted) {
    return JSON.parse(aesEncrypt.decrypt(encrypted, this.ENC_KEY));
  }

  // Hit the API: Generic method
  static async hitTheAPI(url, method, headers, data, timeout = 60000) {
    try {
      const { data: respData } = await axios({
        url,
        method,
        timeout,
        headers,
        data
      });
      return respData;
    } catch (err) {
      console.log('Error -------->', err);
      throw err;
    }
  }

  static async commNgnSendVoucher(orderDetail) {
    try {
      const { templateId, dynamicVars } = this.getTemplateAndDynamicVars(orderDetail);
      const params = this.buildRequestParams(orderDetail, templateId, dynamicVars);

      writeLog('Vouchagram', JSON.stringify(params));
      const encryptedParams = this.encrypt(params);
      const payload = { data: encryptedParams };

      const reqHeaders = {
        'Content-Type': 'application/json',
        username: this.USERNAME,
        password: this.PASSWORD
      };

      const [response] = await this.hitTheAPI(
        this.SEND_VOUCHER_URL,
        'POST',
        reqHeaders,
        payload,
        61000
      );

      // handle error case
      const successStatuses = ['1039', '0000', 1039, 0];
      let log = {};
      if (response.status === 'error' && !successStatuses.includes(response.code)) {
        log = {
          name: 'SEND_VOUCHER_ERR',
          url: this.SEND_VOUCHER_URL,
          requestData: JSON.stringify({ raw: params, encrypted: payload }),
          response: JSON.stringify(response),
          file: `${__filename}, service = commEngineModule`
        };
        writeLog('Vouchagram', JSON.stringify(log));
        return response;
      }

      const decrypted = this.decrypt(response.data);
      // handle voucher already processed response
      const vouchers = decrypted.voucher_details[0].vouchers;
      vouchers.forEach(el => {
        delete el.voucher_no;
        delete el.voucher_pin;
      });
      if (response.status !== 'success' && response.code == 1039) {
        log = {
          name: 'SEND_VOUCHER_LOG',
          url: this.SEND_VOUCHER_URL,
          desc: response.desc,
          requestData: JSON.stringify(payload),
          response: JSON.stringify(decrypted),
          file: `${__filename}, service = commEngineModule`
        };
        writeLog('Vouchagram', JSON.stringify(log));
        return vouchers;
      }

      // success scenario
      log = {
        name: 'SEND_VOUCHER_LOG',
        url: this.SEND_VOUCHER_URL,
        requestData: JSON.stringify(payload),
        response: JSON.stringify(decrypted),
        file: `${__filename}, service = commEngineModule`
      };
      writeLog('Vouchagram', JSON.stringify(log));
      return vouchers;

    } catch (err) {
      console.log(chalk.bold.bgRed('commNgn send Error'), err);
      writeLog('Vouchagram', JSON.stringify({ name: 'SEND_VOUCHER_ERR', err }));
      throw err;
    }
  }

  static getTemplateAndDynamicVars(orderDetail) {
    const isGift = orderDetail.gift === 'Y';
    const isPromoCode = orderDetail.is_show === 'N';
    const tempGiftTempId = isPromoCode ? this.GiftPromoTemplateId : this.GiftTemplateId;
    const promoTempId = isPromoCode ? this.PromoTemplateId : this.TemplateId;

    const templateId = isGift ? tempGiftTempId : promoTempId;

    const dynamicVars = isGift ? {
      "GIFT_MESSAGE": orderDetail.gift_text,
      "GIFT_BANNER": orderDetail.gift_img_url,
      "SENDER_NAME": orderDetail.delivery_sender_name,
      "SENDER_NAME_EMAIL": orderDetail.delivery_sender_name
    } : [];

    return { templateId, dynamicVars };
  }

  static determineCommMode(delivery_email, delivery_phone, whatsapp) {
    if (delivery_email && delivery_phone) {
      return whatsapp === 'Y' ? '4' : '5';
    }
    if (delivery_email) {
      return '2';
    }
    return whatsapp === 'Y' ? '6' : '1';
  }

  static buildRequestParams(orderDetail, templateId, dynamicVars) {
    const {
      delivery_name,
      delivery_email,
      delivery_phone,
      delivery_sender_name,
      guid,
      product_guid,
      quantity,
      delivery_city,
      delivery_state
    } = orderDetail;

    return [{
      TemplateId: templateId,
      ExternalOrderId: guid,
      ProductGuid: product_guid,
      Quantity: quantity,
      CustomerFName: delivery_name ? gyftr.dbDecrypt(delivery_name) : 'Customer',
      CustomerMName: '',
      CustomerLName: '',
      EmailTo: gyftr.dbDecrypt(delivery_email),
      MobileNo: gyftr.dbDecrypt(delivery_phone),
      CommunicationMode: this.determineCommMode(delivery_email, delivery_phone, orderDetail.whats_app),
      EmailSubject: `Dear [CustomerName] here is your [BRAND_NAME] INR [voucherfacevalue] gift voucher ${delivery_sender_name || ''}`,
      EmailCC: '',
      City: delivery_city || '',
      State: delivery_state || '',
      DynamicVars: dynamicVars
    }];
  }



  static async orderItemUpdate(item_id, delivery_status) {
    try {
      const queryStr = queryBuilder.orderItemUpdate();
      db.query(queryStr, [`${item_id}`, `${delivery_status}`, 'NULL']);
    } catch (err) {
      console.log("Error", err);
      throw err;
    }
  }

  static async updateOrderItemRemark(item_id, remark) {
    try {

      remark = remark.replace(/'/g, "\\'");

      console.log('Remark --------->', remark);

      const queryStr = `CALL update_order_remark(${item_id},'${remark}');`;
      db.query(queryStr);
    } catch (err) {
      console.log("Error", err);
      throw err;
    }
  }

  // add the voucher to order_details_x_vouchers
  static async addSendVoucherDetails(order_item_id, voucherGuid) {
    try {
      const queryStr = queryBuilder.addSendVoucherDetails();
      db.query(queryStr, [`${order_item_id}`, `${voucherGuid}`]);
    } catch (err) {
      console.log("Error", err);
      throw err;
    }
  }

  // fetch order details
  static async fetchOrderDetails(orderGuid) {

    try {
      const queryStr = queryBuilder.orderDetailsByGuid();
      const [orderDetail] = await db.query(queryStr, [`${orderGuid}`]);

      return orderDetail;
    } catch (err) {
      console.log(chalk.bold.bgBlue('FETCH_ORDER_ERR'), err);
      throw err;
    }
  }


  static async sendVoucher(orderGuid) {
    try {
      const orderDetails = await this.fetchOrderDetails(orderGuid);
      return await this.processOrderDetails(orderDetails);
    } catch (err) {
      await this.logSendVoucherError(err);
      throw err;
    }
  }

  static async processOrderDetails(orderDetails) {
    try {
      if (this.isEmptyOrder(orderDetails)) {
        return [this.createEmptyOrderResponse()];
      }

      return await this.processLineItems(orderDetails);
    } catch (err) {
      await this.processOrderDetails(err);
      throw err;
    }
  }

  static isEmptyOrder(orderDetails) {
    if (orderDetails.length === 0) {
      console.log(chalk.bold.bgGreen('Empty orderDetails'), orderDetails.length);
      return true;
    }
    return false;
  }

  static createEmptyOrderResponse() {
    return {
      deliveryStatus: false,
      message: 'order details not found'
    };
  }

  static async processLineItems(orderDetails) {
    const deliveryStatus = [];

    for (const lineItem of orderDetails) {
      const status = await this.processLineItem(lineItem);
      deliveryStatus.push(status);
    }

    return deliveryStatus;
  }

  static async processLineItem(lineItem) {
    try {
      if (lineItem.delivery_status !== 'I') {
        return this.createNonInitialStatusResponse(lineItem);
      }

      return await this.processSendVoucher(lineItem);
    } catch (err) {
      console.log(chalk.bold.bgBlue('processLineItem'), err);
      throw err;
    }
  }

  static createNonInitialStatusResponse(lineItem) {
    return {
      ExternalOrderId: lineItem.guid,
      deliveryStatus: true,
      message: 'order delivery status is not I'
    };
  }

  static async processSendVoucher(lineItem) {
    const sendVoucherResp = await this.commNgnSendVoucher(lineItem);

    if (this.isErrorResponse(sendVoucherResp)) {
      return this.createErrorResponse(lineItem, sendVoucherResp);
    }

    await this.updateSuccessfulVoucher(lineItem, sendVoucherResp);
    return this.createSuccessResponse(lineItem);
  }

  static isErrorResponse(response) {
    return response.status === 'error' && response.code !== '0000';
  }

  static createErrorResponse(lineItem, response) {
    return {
      ExternalOrderId: lineItem.guid,
      deliveryStatus: false,
      message: response.desc
    };
  }

  static async updateSuccessfulVoucher(lineItem, sendVoucherResp) {
    await this.orderItemUpdate(lineItem.id, 'C');

    if (sendVoucherResp && sendVoucherResp.status === 'error') {
      await this.updateOrderItemRemark(lineItem.id, sendVoucherResp.desc);
    }

    for (let voucher of sendVoucherResp) {
      await this.addSendVoucherDetails(lineItem.id, voucher.voucher_guid);
    }
  }

  static createSuccessResponse(lineItem) {
    return {
      ExternalOrderId: lineItem.guid,
      deliveryStatus: true,
      message: 'voucher sent successfully!'
    };
  }

  static async logSendVoucherError(err) {
    console.log(chalk.bold.bgBlue('SEND_VOUCHER_MODULE_ERR'), err);
    const errLog = {
      name: 'SEND_VOUCHER',
      error: err.message,
      file: `${__filename}, service = commEngineModule`
    };
    writeLog('app', JSON.stringify(errLog));
  }


  // Call the commEngine check Quantity API
  static async commNgnCheckQuantity(guid) {
    try {
      const encryptedGuid = this.encrypt([{ ProductGuid: guid }]);
      const payload = { data: encryptedGuid };
      const reqHeaders = {
        'Content-Type': 'application/json',
        username: this.USERNAME,
        password: this.PASSWORD
      };

      const [response] = await this.hitTheAPI(this.QTY_CHECK_URL, 'GET', reqHeaders, payload);
      let log={}
      if (response.status !== 'success') {
        // log to console & file
        log = {
          name: 'CHECK_QTY_ERR',
          url: this.QTY_CHECK_URL,
          requestData: JSON.stringify({
            raw: [{ ProductGuid: guid }],
            encrypted: payload
          }),
          response: JSON.stringify(response),
          file: `${__filename}, service = updateQuantityModule`
        };
        console.log(log);
        writeLog('Vouchagram', JSON.stringify(log));

        return false;
      }

      // Decrypt the response data
      const decrypted = this.decrypt(response.data);

      // Log the request and response
      log = {
        name: 'CHECK_QTY_LOG',
        url: this.QTY_CHECK_URL,
        requestData: JSON.stringify({
          raw: [{ ProductGuid: guid }],
          encrypted: payload
        }),
        response: JSON.stringify(decrypted),
        file: `${__filename}, service = updateQuantityModule`
      };
      writeLog('Vouchagram', JSON.stringify(log));
      return decrypted.QuantityResponse[0];
    } catch (err) {
      console.log('Quantity Check CRON Err:', err);
      // Write in the log file
      const log = {
        name: 'CHECK_QTY_ERR',
        url: this.QTY_CHECK_URL,
        err: JSON.stringify(err),
        file: `${__filename}, service = updateQuantityModule`
      };
      writeLog('Vouchagram', JSON.stringify(log));
      // throw the error
      throw err;
    }
  }

  // updateQuantity in DB
  static async updateQuantity(guid, avlQty) {
    try {
      const queryStr = `UPDATE products SET available_qty=${avlQty} WHERE product_guid='${guid}';`;
      await db.query(queryStr);
    } catch (err) {
      console.log('Quantity Update CRON Err:', err);
      throw err;
    }
  }

  // UPDATE QUANTITY MODULE
  static async updateProductQty(productGuid) {
    try {
      const commNgnResult = await this.commNgnCheckQuantity(productGuid);
      if (commNgnResult) {
        await this.updateQuantity(commNgnResult.ProductGuid, commNgnResult.AvailableQuantity);
      }
      // else, error already log to console and vochagram log files

      return true;
    } catch (err) {
      console.log(chalk.bold.bgBlue('QTY_UPDATE_MODULE_ERR'), err);
      const errLog = {
        name: 'CRON_ERR',
        cron: 'UPDATE_QTY',
        error: err.message,
        file: `${__filename}, service = updateProductQtyModule`
      };
      writeLog('app', JSON.stringify(errLog));
      return false;
    }
  }

  // GET VOUCHER DETAILS
  static async getVoucherStatus(externalOrderId) {
    // 1) create the payload
    const rawPayload = [{ sv_ex_order_id: externalOrderId }];
    const encryptedPayload = this.encrypt(rawPayload);
    const payload = { data: encryptedPayload };
    const reqHeaders = {
      'Content-Type': 'application/json',
      username: this.USERNAME,
      password: this.PASSWORD
    };

    // 2) hit the voucher status API
    let [response] = await this.hitTheAPI(this.VOUCHER_DTL_URL, 'GET', reqHeaders, payload, 61000);

    // 3) log to file
    const log = {
      URL: this.VOUCHER_DTL_URL + 'v1/voucher/checkstatus',
      rawPayload,
      reqPayload: payload,
      response
    };
    writeLog('Vouchagram', JSON.stringify(log));

    // 4) prepare the response
    if (response.status !== 'success' || response.code !== '0000') {
      return { error: 'voucher details not found', description: response.desc };
    }

    const decrypted = this.decrypt(response.data);
    const vouchers = decrypted.voucher_details[0].vouchers.map(el => {
      return {
        end_date: el.end_date,
        voucher_no: el.voucher_no,
        voucher_pin: el.voucher_pin,
        value: el.value,
        voucher_status: el.voucher_status,
        voucher_guid: el.voucher_guid
      };
    });
    decrypted.voucher_details[0].vouchers = vouchers;
    return decrypted.voucher_details;
  }

  // GET ALL VOUCHER DETAILS
  static async getAllVouchers(mobile, email) {
    // 1) create the payload
    const rawPayload = { ExternalOrderId: '', MobileNo: mobile };
    if (email) rawPayload.EmailId = email;
    const encryptedPayload = this.encrypt([rawPayload]);
    const payload = { data: encryptedPayload };
    const reqHeaders = {
      'Content-Type': 'application/json',
      username: this.USERNAME,
      password: this.PASSWORD
    };

    // 2) hit the voucher status API
    let response = await this.hitTheAPI(this.VOUCHER_STATUS_URL, 'POST', reqHeaders, payload, 61000);

    // 3) log to file
    const log = {
      URL: this.VOUCHER_STATUS_URL,
      rawPayload,
      reqPayload: payload,
      response
    };

    writeLog('Vouchagram', JSON.stringify(log));

    // 4) prepare the response
    if (response.status !== 'success' || response.code !== '0000') {
      return { error: 'voucher details not found', description: response.desc };
    }
    return this.decrypt(response.data);
  }


  /**
   * Sends vouchers in bulk for a given order
   * @param {string} orderGuid - The order GUID to process
   * @returns {Promise<{status: string, message?: string}>}
   */
  static async sendVoucherBulk(orderGuid) {
    try {
      const orderDetails = await this.fetchOrderDetailsBulk(orderGuid);

      if (!orderDetails?.length) {
        console.log(chalk.bold.bgGreen(' Empty orderDetails '), 0);
        return {
          status: STATUS.FAILED,
          message: 'order details not found'
        };
      }

      const orderGroupMap = this.createOrderGroupMap(orderDetails);
      const voucherResponse = await this.commNgnSendVoucherBulk(orderDetails);

      return await this.processVoucherResponse(voucherResponse, orderGroupMap, orderDetails);
    } catch (err) {
      return this.handleVoucherError(err);
    }
  }

  /**
   * Creates a map of external order IDs to internal IDs
   * @param {Array} orderDetails - Array of order details
   * @returns {Object} Map of external order IDs to internal IDs
   */
  static createOrderGroupMap(orderDetails) {
    return orderDetails.reduce((acc, item) => {
      acc[item.ExternalOrderId] = item.id;
      return acc;
    }, {});
  }

  /**
   * Processes successful voucher details
   * @param {Object} itemData - Voucher item data
   * @param {Object} orderGroupMap - Map of order IDs
   */
  static async processSuccessfulVoucher(itemData, orderGroupMap) {
    const itemId = orderGroupMap[itemData.external_order_id];
    await this.orderItemUpdate(itemId, 'C');

    const voucherDetails = itemData.voucher_details[0].vouchers;
    await Promise.all(
      voucherDetails.map(voucher =>
        this.addSendVoucherDetails(itemId, voucher.voucher_guid)
      )
    );
  }

  /**
   * Processes error voucher details
   * @param {Object} itemData - Voucher item data
   * @param {Object} orderGroupMap - Map of order IDs
   */
  static async processErrorVoucher(itemData, orderGroupMap) {
    const itemId = orderGroupMap[itemData.external_order_id];
    if (itemData.desc) {
      await this.updateOrderItemRemark(itemId, itemData.desc);
    }
  }

  /**
   * Processes the voucher response
   * @param {Object} response - Voucher response data
   * @param {Object} orderGroupMap - Map of order IDs
   * @param {Array} orderDetails - Original order details
   * @returns {Promise<{status: string}>}
   */
  static async processVoucherResponse(response, orderGroupMap, orderDetails) {
    if (!response.ResultType) {
      return { status: STATUS.FAILED };
    }

    if (response.ResultType === STATUS.ERROR) {
      await this.handleErrorResponse(response, orderDetails);
      return { status: STATUS.FAILED };
    }

    if (response.ResultType === STATUS.SUCCESS) {
      await this.processVoucherDetails(response.vouchersData, orderGroupMap);
      return { status: STATUS.SUCCESS_LOWER };
    }

    return { status: STATUS.FAILED };
  }

  /**
   * Processes voucher details
   * @param {Array} vouchersData - Array of voucher data
   * @param {Object} orderGroupMap - Map of order IDs
   */
  static async processVoucherDetails(vouchersData, orderGroupMap) {
    if (!vouchersData?.length) return;

    await Promise.all(vouchersData.map(async itemData => {
      if (itemData.status === STATUS.SUCCESS_LOWER) {
        await this.processSuccessfulVoucher(itemData, orderGroupMap);
      } else if (itemData.status === STATUS.ERROR_LOWER) {
        await this.processErrorVoucher(itemData, orderGroupMap);
      }
    }));
  }

  /**
   * Handles error response
   * @param {Object} response - Error response
   * @param {Array} orderDetails - Original order details
   */
  static async handleErrorResponse(response, orderDetails) {
    if (response.desc) {
      const queryStr = `update order_details set remark=? where order_id=?`;
      await db.query(queryStr, [JSON.stringify(response.desc), orderDetails[0].order_id]);
    }
  }

  /**
   * Handles voucher errors
   * @param {Error} err - Error object
   * @returns {{status: string}}
   */
  static handleVoucherError(err) {
    console.log(chalk.bold.bgBlue('SEND_VOUCHER_MODULE_ERR'), err);
    const errLog = {
      name: 'SEND_VOUCHER_ERR',
      error: err.message
    };
    writeLog('app', JSON.stringify(errLog));
    return { status: STATUS.FAILED };
  }


  static async commNgnSendVoucherBulk(ordersData) {
    try {

      var orderDetail = ordersData[0];

      const { templateId, dynamicVars } = this.getTemplateAndDynamicVars(orderDetail);
      const params = this.buildRequestParams(orderDetail, templateId, dynamicVars);

      writeLog('Vouchagram-params', JSON.stringify(params));
      const encryptedParams = this.encrypt(params);
      const payload = { data: encryptedParams };

      const reqHeaders = {
        'Content-Type': 'application/json',
        username: this.USERNAME,
        password: this.PASSWORD
      };

      console.log(this.SEND_VOUCHER_URL_MULTIPLE);

      const result = await this.hitTheAPI(
        this.SEND_VOUCHER_URL_MULTIPLE,
        'POST',
        reqHeaders,
        payload,
        61000
      );

      if (result.status == 'success') {
        const decrypted = this.decrypt(result.data);

        const log = {
          name: 'SEND_VOUCHER_LOG',
          requestData: payload,
          response: decrypted
        };
        writeLog('Vouchagram', JSON.stringify(log));

        return {
          ResultType: 'SUCCESS',
          vouchersData: decrypted
        };
      } else if (result.status == 'error') {
        if (result.code == 'EC017') {
          const decrypted = this.decrypt(result.data);

          const log = {
            name: 'SEND_VOUCHER_LOG',
            requestData: payload,
            response: decrypted
          };
          writeLog('Vouchagram', JSON.stringify(log));
          return {
            ResultType: 'ERROR',
            desc: decrypted
          };
        }
        else {
          const log = {
            name: 'SEND_VOUCHER_LOG',
            requestData: payload,
            response: result.desc
          };
          writeLog('Vouchagram', JSON.stringify(log));
          return {
            ResultType: 'ERROR',
            desc: result.desc
          };
        }
      } else {
        const log = {
          name: 'SEND_VOUCHER_LOG',
          requestData: payload,
          response: { status: 'error', desc: 'Not Getting Response' }
        };

        writeLog('Vouchagram', JSON.stringify(log));
        return {
          ResultType: 'ERROR',
          desc: 'Not Getting Response'
        };
      }

    } catch (err) {
      console.log(chalk.bold.bgRed('commNgn send Error'), err);
      writeLog('Vouchagram', JSON.stringify({ name: 'SEND_VOUCHER_ERR', err }));
      return {
        ResultType: 'ERROR',
        desc: err
      };
    }
  }

  static async fetchOrderDetailsBulk(orderGuid) {
    try {
      const queryStr = queryBuilder.orderDetailsByGuidBulk();
      const [orderDetail] = await db.query(queryStr, [`${orderGuid}`]);

      return orderDetail;
    } catch (err) {
      console.log(chalk.bold.bgRed('fetchOrderDetailsBulk Error'), err);
      throw err;
    }
  }
}

module.exports = CommEngine;
