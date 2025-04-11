const express = require('express');
const router = express.Router();

const {
    decryptBody,
    encryptHandler,
    decryptHandler,
} = require('../controllers/middlewares/encryptionMiddleware');

const userController = require('../controllers/userController.js');
const brandsController = require('../controllers/brandsController.js');
const homeController = require('../controllers/homeController.js');
const offersController = require('../controllers/offersController');
const categoryController = require('../controllers/categoryController.js');
const cartController = require('../controllers/cartController.js');
const ottCtrl = require('./../controllers/ottController');
const orderController = require('./../controllers/orderController');
const cronServices = require('./../controllers/services/cronServices');


const rateLimit = require('express-rate-limit');
const rateLimiterCheckMobile = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: 3, // limit each IP to 20 requests per windowMs
    message: { code:400,  message: 'Too many hits from this Client, please try again after 3 Minutes.' },
    keyGenerator: (request, response) => request.body.mobile
});
const rateLimiterRegister = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: 3, // limit each IP to 20 requests per windowMs
    message: { code:400, message: 'Too many hits from this Client, please try again after 3 Minutes.' },
    keyGenerator: (request, response) => request.body.mobile
});

const rateLimiterTransaction = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: 3, // limit each IP to 20 requests per windowMs
    message: { code:400,  message: 'Too many hits from this IP, please try again after 15 Minutes.' }
});
  


//Encryption api's
router.post('/data/encrypt', encryptHandler);
router.post('/data/decrypt', decryptHandler); 
 
//Home Content Api's
router.get('/home/categories', homeController.getCategoriesNavigation);
router.get('/home/content', homeController.content);

router.get('/home/discount_list',homeController.discount_list);
router.post('/home/brandsearch',decryptBody, homeController.brandSearchWithUrl);
router.get('/home/promotions',homeController.getPromotions);
router.get('/home/storelocator',homeController.storeLocator); 
router.post('/home/getTopOffersByCategory', homeController.getTopOffersByCategories); 
router.post('/home/ticketbrands', homeController.getBrandAndPurpose);
router.post('/home/ticketpurposedetail',homeController.getPurposeDetailByPurposeIdAndBrandMasterId);

router.post('/create/ticket', homeController.ticketCreate);
router.post('/resend/voucher', homeController.resendVoucher);

router.get('/categories/brands/:category_slug', categoryController.getBrandsByCategories);

router.post('/brandsubcategorybycategory', categoryController.getBrandsSubcategryByCategory);

//Brand Api's
router.get('/brand/:brand', brandsController.brands);
router.get('/promocodes', brandsController.fetchPromocodes);
router.post('/brand/apply-promocode',decryptBody, brandsController.applyPromocode);
router.post('/all/brands/:offerType',decryptBody, brandsController.getAllBrands);

router.get('/relative-brands/:brand', brandsController.getRelativetBrand);



// Category Api's
router.post('/getSubcategory',decryptBody, categoryController.getSubCategory);

//User login Api's
router.post('/ott/generate-otp', decryptBody, userController.authGuard, ottCtrl.OttRegistration);

// router.post('/loginUser',decryptBody, userController.loginUser)
// user login 
router.post('/check/mobile',decryptBody, rateLimiterCheckMobile, userController.checkMobileNumber);
router.post('/login',decryptBody, userController.Login);
router.post('/register', decryptBody, rateLimiterRegister, userController.Register);
router.post('/updateUserProfile',decryptBody, userController.authGuard,userController.updateProfile);
router.post('/mywallet', userController.authGuard, userController.getMyWallet);
router.post('/getUserDetail', userController.authGuard, userController.getUserDetail);

//Cart Api's
router.post('/cart/add',decryptBody, userController.authGuard, ottCtrl.addToCart);
router.post('/cart/updateGiftingDetails',decryptBody, userController.authGuard, cartController.updateGiftingDetails);
router.post('/cart/update',decryptBody, userController.authGuard, cartController.updateCartItemQty);
router.post('/cart/remove',decryptBody, userController.authGuard, cartController.deleteCartItem);
router.post('/cart/getall',userController.authGuard, cartController.getCartItems);
router.post('/cart/getUserBrandOrderDetail',decryptBody, userController.authGuard, cartController.getUserBrandOrderDetail)
router.post('/cart/updateDeliveryDetail',decryptBody, userController.authGuard, cartController.updateDeliveryDtls);
router.get('/cart/gifting-templates', cartController.giftTemplates)

//Order Api's

router.get('/offers/bogo', offersController.bogoHandler);                                                // done 06-02-2023
router.get('/offers/discount', offersController.discountHandler);  
   
router.post('/order/createorder',decryptBody, userController.authGuard, orderController.createOrder);
router.post('/order/allorders', decryptBody, rateLimiterTransaction, userController.authGuard, orderController.fetchAllOrders);
router.post('/order/getorder',decryptBody,  userController.authGuard, orderController.getOrderDetails);
router.post('/order/seamless/payment',orderController.pgseamlessResponseCheck);

//Cron service routes
//router.get('/cron/sendvouchercron/:ordernumber', cronServices.sendVoucher);
router.get('/cron/checktransactionstatusPgSeamless/:ordernumber', cronServices.checkTransactionStatusPgSeamless);

router.get('/cron/seamlesspg/refund/:order_guid', cronServices.refundPgSeamless);

router.get('/cron/sendvouchercronBulk/:ordernumber', cronServices.sendVoucherBulk);



module.exports = router;
