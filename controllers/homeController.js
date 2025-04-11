const config = JSON.parse(process.env.secret);

const chalk = require('chalk');
const _ = require('lodash');
const DB = require('../models/DbQuery');
const queryBuilder = require('../models/queryBuilder');
const { createSuccessResponse, createErrResponse, sendServerError } = require('../utils/api/responseBuilder');
const db = new DB(config.db);
const request = require('request');

exports.getCategoriesNavigation = async (req, res, next) => {
      try {
        const queryStr = queryBuilder.getNavigationData();
        
        let result = await db.query(queryStr);

        let finalResult = {
          navcatData : result[0],
          specialoffers : result[1]
        }
        
        const response = createSuccessResponse(finalResult);
        return res.status(200).json(response);

      } catch (err) {
        console.error(chalk.bold.bgMagenta('NAVIGATION_DATA_ERR:'), err);
        const errResp = createErrResponse(400, 'Data not found', 'validation error');
        return res.status(400).json(errResp);
      }
};


exports.content = async (req, res, next) => {
  try {

    const queryStr = queryBuilder.getHomeData();
    let result = await db.query(queryStr , ['home']);

    if (_.isEmpty(result[0][0])) return next(new AppError(400, 'Data not found'));

    result = {
      banner    : result[0][0].banner,
      seo_title  : result[0][0].seo_title,
      seo_keyword : result[0][0].seo_keyword,
      seo_description : result[0][0].seo_description,
      static_banners : result[0][0].static_banners,
      personalised_brands : result[1],
      top_brands : result[2]
    };
    const response = createSuccessResponse(result);
    return res.status(200).json(response);

  } catch (err) {
    console.error(chalk.bold.bgMagenta('CONTENT_DATA_ERR:'), err);
    const errResp = createErrResponse(400, 'Data not found', 'validation error');
    return res.status(400).json(errResp);
  }
};

exports.discount_list = async (req, res, next) => {
  try { 

    const queryStr = queryBuilder.getHomeData();
    let result = await db.query(queryStr , ['home']);

    if (_.isEmpty(result[0][0])) return next(new AppError(400, 'Data not found'));

    const response = createSuccessResponse(result[1]);
    return res.status(200).json(response);

  } catch (err) {
    console.error(chalk.bold.bgMagenta('DISCOUNT_LIST_ERR:'), err);
    const errResp = createErrResponse(400, 'discount list not found', 'validation error');
    return res.status(400).json(errResp);
  }
};
exports.brandSearchWithUrl = async (req, res, next) => {

  try {

    const { text } = req.body;

    let newString = text.replace(/'/g, "\\'");

    const queryStr = queryBuilder.brandSearch();
    let result = await db.query(queryStr ,[newString]);

    if (_.isEmpty(result[0][0])) return next(new AppError(400, 'Data not found'));

    const data = result[0];
    const response = createSuccessResponse(data, 'success');
    res.status(200).json(response);
  }
  catch (err) {
    console.error(chalk.bold.bgMagenta('CONTENT_DATA_ERR:'), err);
    const errResp = createErrResponse(400, 'Data not found', 'validation error');
    return res.status(400).json(errResp);
  }

}

exports.getPromotions = async (req,res,next) => {

  try{
    const queryStr = queryBuilder.getPromotionInfo();
    let result = await db.query(queryStr , ['WEBSITE']);

    if (_.isEmpty(result[0][0])) return next(new AppError(400, 'Data not found'));
    const response = createSuccessResponse(result[0]);
    return res.status(200).json(response);
  }
  catch(err){
    console.error(chalk.bold.bgMagenta('PROMOTION_DATA_ERR:'), err);
    const errResp = createErrResponse(400, 'Data not found', 'validation error');
    return res.status(400).json(errResp);
  }

}

exports.storeLocator = async (req, res, next) => {

  const {text , brand} = req.body;

  try{

    const queryStr = queryBuilder.storeLocator();
    let result = await db.query(queryStr , [text , brand]);

    if (_.isEmpty(result[0][0])) return next(new AppError(400, 'Data not found'));
    const response = createSuccessResponse(result[0]);
    return res.status(200).json(response);


  }catch(err){
    console.error(chalk.bold.bgMagenta('CONTENT_DATA_ERR:'), err);
    const errResp = createErrResponse(400, 'Data not found', 'validation error');
    return res.status(400).json(errResp);
  }

}

exports.resendVoucher = async (req, res, next) => {

  try {
      request.get({
          url: config.contactUs.RESENDVOUCHERURL + "?source="
              + encodeURIComponent(config.contactUs.SOURCE)
              + "&clientid=" + (config.contactUs.CLIENTID)
              + "&dealerid=" + encodeURIComponent(config.contactUs.DEALERID)
              + "&mobile=" + encodeURIComponent(req.body.mobile)
              + "&email=" + encodeURIComponent(req.body.email),
          headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
          },
      }, function (error, httpRes, body) {
          if (error){
            const errResp = createErrResponse(400, 'No Record Found',  error);
            return res.status(400).json(errResp);
          }
          else {
            const response = createSuccessResponse(body);
            res.status(200).json(response);
          }
      });
  } catch (err) {
      console.error(chalk.bold.bgMagenta('RESEND_VOUCHER_ERR:'), err);
      sendServerError(res, 'Error');
  }

}

exports.ticketCreate = async (req, res, next) => {

  try {
      request.post({
          url: contactUs.MISSCALLAPIURL,
          headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
          },
          json: true,
          body: {
              "Name": req.body.name,
              "Number": req.body.mobile,
              "email": req.body.email,
              "Brand_Id": req.body.Brand_Id,
              "PurposeId": req.body.PurposeId,
              "PurposeOfCallId": req.body.PurposeOfCallId,
              "Program": 54,
              "SendEmail": "YES",
              "SendSms": "YES",
              "QueryMode": config.contactUs.QueryMode,
              "Source": config.contactUs.SOURCE
          },
      }, function (error, httpRes, body) {
          if (error){
            const errResp = createErrResponse(400, 'No Record Found!',  error);
            return res.status(400).json(errResp);
          }
            
          else {
            const response = createSuccessResponse(body);
            res.status(200).json(response);
          }
      });
  } catch (err) {
      console.error(chalk.bold.bgMagenta('TICKET_CREATE_ERR:'), err);
      sendServerError(res, 'Error');
  }


}

exports.getBrandAndPurpose = async (req,res,next) => {
  try {
    const queryStr = queryBuilder.getBrandsAndPurpose();
    const result = await db.query(queryStr);

    if (_.isEmpty(result[0])) {
      const errResp = createErrResponse(400, 'No Record Found', ' error');
      return res.status(400).json(errResp)
    }

    let data = {};

    data['brands'] = result[0];
    data['purposes'] = result[1];

    const response = createSuccessResponse(data);
    res.status(200).json(response);
  } catch (err) {
    console.error(chalk.bold.bgMagenta('GET_PROMOCODE_AND_PURPOSE_ERR:'), err);
    sendServerError(res, 'Error Fetching get promocode and purpose');
  }
}

exports.getPurposeDetailByPurposeIdAndBrandMasterId = async (req, res, next) => {

  try {
      var purposeId = req.body.purposeId;
      var brandMasterId = req.body.brandMasterId;

      if (!purposeId) return res.status(400).json(createErrResponse(400, 'purpose Id is required', 'BAD_REQUEST'));

      if (!brandMasterId) return res.status(400).json(createErrResponse(400, 'brand Master Id is required', 'BAD_REQUEST'));


      const queryStr = queryBuilder.ticketPurposeDetails();

      const [[result]] = await db.query(queryStr , [purposeId , brandMasterId]);

      const response = createSuccessResponse(result);
      res.status(200).json(response);
  }
  catch (err) {
      console.error(chalk.bold.bgMagenta('GET_MASTER_DETAIL_BY_PRODUCT_ID_ERR'), err);
      sendServerError(res, 'Error');
  }



}

exports.getTopOffersByCategories = async (req, res, next) => {

  try{
    var sub_cat_ids  = req.body.id;
    var brand_ids = req.body.brandid;
    var categories = req.body.categories;
    var limit = req.body.limit;
    var from_price = req.body.from;
    var to_price = req.body.to;

    sub_cat_ids = sub_cat_ids ? sub_cat_ids : null;
    brand_ids = brand_ids ? brand_ids : null;
    categories = categories ? categories : null;
    limit = limit ? limit : null;
    from_price = from_price ? from_price : null;
    to_price  = to_price ? to_price : null;

    const queryStr = queryBuilder.getTopOfferByCategoriesInfo();
    let result = await db.query(queryStr , [ categories, limit, 1 , from_price, to_price, sub_cat_ids, brand_ids , 'WEBSITE']);

    if (_.isEmpty(result[0])) {
      const errResp = createErrResponse(400, 'No Record Found', ' error');
      return res.status(400).json(errResp)
    }

    const response = createSuccessResponse(result[0]);
    return res.status(200).json(response);

  }
  catch(err){
    console.error(chalk.bold.bgMagenta('Top_Offers_By_Categories_ERR:'), err);
    const errResp = createErrResponse(400, 'Data not found', 'validation error');
    return res.status(400).json(errResp);
  }

}