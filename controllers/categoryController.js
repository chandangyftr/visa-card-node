const config = {};
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg];
const chalk = require('chalk');
const _ = require('lodash');
const DB = require('../models/DbQuery');
const queryBuilder = require('../models/queryBuilder');
const { createSuccessResponse, createErrResponse } = require('../utils/api/responseBuilder');

const db = new DB(config.get('db'));

exports.getSubCategory = async (req, res, next) => {

    try {
        const { categoryId, brandId } = req.body;

        if (!categoryId) {
            return res.status(400).json(createErrResponse(400, 'category Id is required', 'BAD FIELD ERR'));
        }

        if (!brandId) {
            return res.status(400).json(createErrResponse(400, 'brand Id is required', 'BAD FIELD ERR'));
        }

        const queryStr = queryBuilder.getSubCategoryByCategoryAndBrand();
        const result = await db.query(queryStr, [categoryId, brandId]);

        const data = result[0][0];
        const response = createSuccessResponse(data, 'success');
        res.status(200).json(response);
    }
    catch (err) {
        console.error(chalk.bold.bgMagenta('CATEGORY_ERR:'), err);
        const errResp = createErrResponse(500, 'Something went wrong', 'Error Fetching sub category');
        res.status(500).json(errResp);
    }
}

exports.getBrandsByCategories = async (req, res, next) => {

    try {
        const params = extractBrandCatQueryParams(req);

        const queryStr = queryBuilder.getBrandsByCategoriesInfo();

        const result = await db.query(queryStr, [
            params.categorySlug,
            params.page,
            params.limit,
            params.userId,
            params.discountFilter,
            params.fromPriceRange,
            params.toPriceRange,
            params.brandFilter,
            params.newArrival,
            params.platform
        ]);


        let data = {
            products: result[0]

        }


        if (_.isEmpty(result[0]) || result[0].error) {
            const errResp = createErrResponse(400, 'No Data Found', '');
            return res.status(400).json(errResp)
        }

        const response = createSuccessResponse(data);

        res.status(200).json(response);
    }
    catch (err) {
        console.error(chalk.bold.bgMagenta('CATEGORY_ERR:'), err);
        const errResp = createErrResponse(500, 'Something went wrong', 'Error Fetching category with brands');
        res.status(500).json(errResp);
    }
}

const extractBrandCatQueryParams = (req) => {
    return {
        categorySlug: req.params?.category_slug || null,
        page: 1,
        limit: req.body?.limit || 1000,
        discountFilter: req.body?.discount_filter || null,
        fromPriceRange: req.body?.from_price_range || null,
        toPriceRange: req.body?.to_price_range || null,
        userId: 1, // Consider making this dynamic
        brandFilter: req.body?.brand_filter ? `'${req.body.brand_filter}'` : null,
        newArrival: req.body?.new_arrival || null,
        platform: 'WEBSITE'
    };
};


exports.getBrandsSubcategryByCategory = async (req, res, next) => {
    try {

        const params = extractBrandSubCatQueryParams(req);

        const queryStr = queryBuilder.getBrandsSubcategryByCategoryInfo();

        let data = {}

        const result = await db.query(queryStr, [
            params.categorySlug,
            params.page,
            params.limit,
            params.discountFilter,
            params.fromPriceRange,
            params.toPriceRange,
            params.brandFilter,
            params.platform
        ]);

        if (_.isEmpty(result[0][0]) || result[0][0].error) {
            const errResp = createErrResponse(400, 'No Data Found', '');
            return res.status(400).json(errResp)
        }

        data['data'] = result[0];
        const response = createSuccessResponse(data, 'success');
        res.status(200).json(response);

    }
    catch (err) {
        console.error(chalk.bold.bgMagenta('CATEGORY_ERR:'), err);
        const errResp = createErrResponse(500, 'Something went wrong', 'Error Fetching category with brands');
        res.status(500).json(errResp);
    }
}

const extractBrandSubCatQueryParams = (req) => {
    return {
        categorySlug: req.params?.category_slug || null,
        page: 1,
        limit: req.body?.limit || 1000,
        discountFilter: req.body?.discount_filter || null,
        fromPriceRange: req.body?.from_price_range || null,
        toPriceRange: req.body?.to_price_range || null,
        brandFilter: req.body?.brand_filter ? `'${req.body.brand_filter}'` : null,
        platform: 'WEBSITE'
    };
};