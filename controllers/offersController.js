const config = {}; 
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg]; 
const _ = require('lodash');
const DB = require('../models/DbQuery');
const queryBuilder = require('../models/queryBuilder');
const db = new DB(config.get('db'));


exports.discountHandler = async (req, res, next) => {
  try {
   
    const queryStr = queryBuilder.getAllPromotionsDiscount();
    const result = await db.query(queryStr, []);

    const newQueryStr = queryBuilder.getPageContent();
    const result2 = await db.query(newQueryStr, ['DISCOUNT']);

    const discounts = { ...result[0] };
    const discountResults = [];
    for (const el in discounts) {
      discountResults.push(discounts[el]);
    }

    let dataObj = {
      content: {
        discount_banner: result2[0][0].discount_banner,
        discount_content: result2[0][0].discount_content,
        mobile_banner : result2[0][0].mobile_banner,
        seo_title : result2[0][0].seo_title,
        seo_keyword : result2[0][0].seo_keyword,
        seo_description : result2[0][0].seo_description

      },
      products: discountResults
    }

    res.json({
      status: 'success',
      code: 200,
      results: discountResults.length,
      data: dataObj
    });
  } catch (err) {
     console.log(err);
  }
};

exports.bogoHandler = async (req, res, next) => {
  try {
    
    const queryStr = queryBuilder.getAllPromotionsOffer();
    let result = await db.query(queryStr, []);

    const offers = { ...result[0] };

    const newQueryStr = queryBuilder.getPageContent();
    const result2 = await db.query(newQueryStr, ['OFFER']);

    const bogoResults = [];
    for (const el in offers) {
      bogoResults.push(offers[el]);
    }

    let dataObj = {
      content: {
        offer_banner: result2[0][0].offer_banner,
        offer_content: result2[0][0].offer_content,
        mobile_banner : result2[0][0].mobile_banner,
        seo_title : result2[0][0].seo_title,
        seo_keyword : result2[0][0].seo_keyword,
        seo_description : result2[0][0].seo_description
      },
      products: bogoResults
    }

    res.json({
      status: 'SUCCESS',
      code: 200,
      results: bogoResults.length,
      data: dataObj
    });
  } catch (err) {
    console.log(err);
    
    if (process.env.NODE_ENV === 'development') return res.send(err);
    next(new AppError('Error Fetching Offers', 500));
  }
};