/* User Login queries */
exports.sendOtp = () => 'CALL SEND_OTP(?,?)';
exports.userLogin = () => `CALL VERIFY_OTP(?,?)`;
exports.updateProfile = () => 'call update_user_details(?,?,?,?,?,?);';
exports.otpValidate = () => 'CALL otp_validate(?,?,?);';

exports.userDetailByTransactionGuid = () => 'call user_details_by_transaction_guid(?);';
exports.getUserDetail = () => 'CALL user_details(?)';
exports.getPendingRefundTxns = () => 'Call order_refund_pending_transactions(?);';
exports.orderDtlsByTxnGuid = () => 'CALL order_details_by_txn_guid(?)';
exports.getAllPromotions = () => 'CALL get_all_promotions(?,?,?,?,?,?,?,?)';
exports.getAllPromotionsDiscount = () => 'CALL get_all_promotions_discount()';
exports.getAllPromotionsOffer = () => 'CALL get_all_promotions_offer()';
exports.getPageContent = () => 'call get_page_content(?)'; 

exports.getHomeData = () => 'CALL home_page(?)';
exports.getClientList = () => 'CALL get_clients_by_mobile(?)';
exports.refundPayUTxnStatus = () => 'Call order_refund_transaction_status_update(?,?,?,?)';
exports.walletRefund = () => 'CALL wallet_refund_transactions(?)';
exports.reverseWalletDebitTransaction = () => 'CALL reverse_wallet_debit_transaction(?,?,?,?)';
exports.burnPoint = () => 'call debit_wallet_main_balance(?,?,?)';
exports.getTopOfferByCategoriesInfo = () => 'call get_all_promotions(?,?,?,?,?,?,?,?)';
exports.getCappingWallet = () => 'CALL get_capping_wallet_balance(?,?)';
exports.getPromotionInfo = () => 'call brand_promotions(?)';
exports.allOrderPendings = () => 'call all_order_pending(?)';
exports.apply_promocode = () => 'Call apply_promocode(?,?)';
exports.syncVouchers = ()  => `CALL UNSYNC_VOUCHER_TABLE_VOUCHER_LIST();`;
exports.isOrderProcess = () => 'CALL is_new_order_process(?)';
exports.storeLocator = () => 'CALL store_locator(?,?)';
exports.ticketBrandAndPurposes = () => 'CALL ticket_brands_and_purposes()';
exports.getTxnDetailsByReffId = () => `Select guid, amount, mihpayid from transactions where id = ?`;
exports.ticketPurposeDetails = () => 'CALL ticket_purpose_details(?,?)';
exports.verifying_orders = () => `CALL verifying_orders(?)`;
exports.registerUserSendOtp =() => 'CALL USER_REGISTRATION_SEND_OTP(?)';
exports.registerUser =() => 'CALL USER_REGISTRATION_PROCESS(?,?,?,?)';
exports.resetPassword = () => 'CALL reset_password(?,?);' 
exports.getSubCategoryByCategoryAndBrand = () => 'CALL get_sub_categories(?,?);';
exports.brandSearch = () => 'CALL brand_search(?)';
exports.mobileNumberCheck = () => 'CALL CHECK_USER_MOBILE(?,?);'; 
exports.getBrandsByCategoriesInfo = () => 'call brands_by_category(?,?,?,?,?,?,?,?,?,?)';
exports.getBrandsSubcategryByCategoryInfo = () => 'call brands_subcategory_by_category(?,?,?,?,?,?,?,?);';
exports.getBrandOrderDetailByUser = () => 'CALL user_brand_order_detail(?, ?);'


/* Navigation queries */
exports.getNavigationData = () => 'CALL categories_with_brands();';

/// Occasions queries

exports.getoccasions = () => 'CALL OCCASIONS();';

exports.getContentData = () => 'CALL get_page_content(?);';

/* Brand queries */
exports.getBrandData = () => 'CALL products_with_brand(?);';
exports.fetchPromocodes = () => 'CALL get_promocodepage();';
exports.getAllBrands = () => 'CALL get_all_brands(?,?);';
exports.getBrandsAndPurpose = () => 'CALL ticket_brands_and_purposes()';

/* User Cart queries */
exports.getProductguids = () => `CALL get_product_guid();`

exports.updateDeliveryDtls = () => {
    return 'CALL update_cart_item_delivery_detail(?,?,?,?,?)';
};

exports.updateCartItemQty = () => {
    return 'CALL update_cart_item_quantity(?, ?, ?, ?)';
};

exports.fetchCart = () => {
    return 'CALL user_cart_items(?,?)';
};
exports.removeCartItem = () => 'CALL remove_cart_item(?,?);';

exports.gift_detail = () => 'CALL gift_detail();';

exports.getWallet = () => 'CALL my_wallet_details(?,?);'

exports.addToCart = () => {
    return 'call add_to_cart(?,?,?,?,?,?,?,?,?,?)';   
};
exports.updateGiftingDetails = () => {
    return 'call update_gifting_cart_details(?,?,?,?,?,?,?)';   
};

/* Order queries */
exports.checkDeliveryDtl = () => 'CALL check_delivery_details(?, ?);';

exports.createOrder = () => {
    const query = 'call create_order(?,?,?,?,?,?);';
    console.log(query);
    return query;
};

exports.orderItemUpdate = () => `call order_item_update (?, ?, ?)`;

exports.addSendVoucherDetails = () => 'CALL add_send_voucher_details(?,?)';

exports.getUserOrders = () => 'CALL user_past_orders(?,?,?,?);';

exports.orderDetailsByGuid = () => `CALL order_details_by_guid (?)`;

exports.orderDetailsByTxnGuid = () => 'CALL order_details_by_txn_guid(?);';

exports.orderDtlsByOderId = () => 'CALL order_details_by_orderid(?,?);';

exports.userDtlsByTxnId = () => 'call user_details_by_transaction_guid(?);';

exports.changeTxnStatus = function () {
    return 'call change_transaction_status(?,?,?,?,?,?,?,?,?,?,?,?)';
};

exports.allOrderPendingSeamlessPg = () => 'call all_order_pending_seamless_pg(?)';

exports.getRelativeBrandInfo = () => 'CALL relative_brands(?)';

exports.orderDetailsByGuidBulk = () => `CALL order_details_by_guid_bulk (?)`;

exports.deleteDirectBuyNowItem = () => `DELETE FROM cart_items where user_id=? and buynow=1`