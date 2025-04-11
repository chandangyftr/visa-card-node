const config = {}; 
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg]; 
const chalk = require("chalk");
const _ = require('lodash');
const DB = require('../models/DbQuery');
const queryBuilder = require('../models/queryBuilder');
const { createSuccessResponse, createErrResponse, sendServerError } = require('../utils/api/responseBuilder');
const db = new DB(config.get('db'));

exports.brands = async (req, res, next) => {
  try {
    const brand = req.params.brand;

    if (!brand) {
      const errResp = createErrResponse(400, 'Brand Slug is required', 'validation error');
      return res.status(400).json(errResp);
    }

    //checking user loogeg from app or website
    const queryStr = queryBuilder.getBrandData();
    let result = await db.query(queryStr, [brand]);


    if (_.isEmpty(result[0][0])) {
      const errResp = createErrResponse(400, 'Brand Slug is invalid!', 'validation error');
      return res.status(400).json(errResp)
    }
    result = { brand: result[0][0], products: result[1] };
    const response = createSuccessResponse(result);
    return res.status(200).json(response);

  } catch (err) {
    console.error(chalk.bold.bgMagenta('BRAND_DATA_ERR:'), err);
    const errResp = createErrResponse(400, 'Brand Data not found', 'validation error');
    return res.status(400).json(errResp);
  }
};

exports.fetchPromocodes = async (req, res, next) => {
  try {
    const queryStr = queryBuilder.fetchPromocodes();
    const [result] = await db.query(queryStr);

    if (_.isEmpty(result[0])) {
      const errResp = createErrResponse(400, 'No Record Found', ' error');
      return res.status(400).json(errResp)
    }

    const response = createSuccessResponse(result);
    res.status(200).json(response);
  } catch (err) {
    console.error(chalk.bold.bgMagenta('PROMOCODE_ERR:'), err);
    sendServerError(res, 'Error Fetching Promocodes');
  }
};

exports.applyPromocode = async (req, res, next) => {
  try {
    const { brandId, promocode } = req.body;

    if (!brandId) {
      const errResp = createErrResponse(400, 'Missing required field(s).', 'validation error');
      return res.status(400).json(errResp);
    }

    console.log('Promocode -------->',promocode);
    

    var queryStr = queryBuilder.apply_promocode();
    let result = await db.query(queryStr, [brandId, promocode]);


    if (_.isEmpty(result[0][0]) || result[0][0].error) {
      const errResp = createErrResponse(400, 'Invalid Promocode', 'validation error');
      return res.status(400).json(errResp)
    }
    result = { products: result[0] };
    const response = createSuccessResponse(result);
    return res.status(200).json(response);

  } catch (err) {
    console.error(chalk.bold.bgMagenta('APPLY_PROMOCODE_ERR:'), err);
    const errResp = createErrResponse(400, 'Promocode not found', 'validation error');
    return res.status(400).json(errResp);
  }
};

exports.getAllBrands = async (req, res, next) => {
  try {
    const offerType = req.params.offerType;
    const limit = req.body.limit || 50;

    if (!offerType) {
      return res.status(400).json(createErrResponse(400, 'Offer type param is required', 'BAD FIELD ERR'));
    }

    if (offerType != "DIS" && offerType != "OFFER") {
      return res.status(400).json(createErrResponse(400, 'Wrong Parameter Value.', 'BAD FIELD ERR'));
    }

 


    const queryStr = queryBuilder.getAllBrands();
    let result = await db.query(queryStr, [offerType, limit]);

    result = { brands: result[0], banner: result[1] };
    const response = createSuccessResponse(result);

    res.status(200).json(response);
  } catch (err) {
    console.error(chalk.bold.bgMagenta('All_BRANDS_ERR:'), err);
    sendServerError(res, 'Error Fetching All Brands');
  }
};

exports.getRelativetBrand = async (req,res,next) => {
  try {

    var brand = req.params.brand;

    const queryStr = queryBuilder.getRelativeBrandInfo();
    let [result] = await db.query(queryStr, [brand]);

    const response = createSuccessResponse(result);

    res.status(200).json(response);

  }
  catch (err) {
    console.log('Error coming in catch block --------->', err);
    console.error(chalk.bold.bgMagenta('RELATIVE_BRANDS_ERR:'), err);
    sendServerError(res, 'Error Fetching Relative Brands');
  }

}