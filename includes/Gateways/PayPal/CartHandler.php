<?php

namespace WeDevs\Dokan\Gateways\PayPal;

use WeDevs\Dokan\Gateways\PayPal\PaymentMethod\DokanPayPal;
use WeDevs\Dokan\Gateways\PayPal\Utilities\Processor;

/**
 * Class CartHandler
 * @package WeDevs\Dokan\Gateways\PayPal
 *
 * @since DOKAN_LITE_SINCE
 *
 * @author weDevs
 */
class CartHandler extends DokanPayPal {

    /**
     * CartHandler constructor.
     *
     * @since DOKAN_LITE_SINCE
     */
    public function __construct() {
        parent::__construct();

        add_action( 'woocommerce_after_checkout_validation', [ $this, 'after_checkout_validation' ], 15, 2 );

        //show paypal smart payment buttons
        add_action( 'woocommerce_review_order_after_submit', [ $this, 'display_paypal_button' ] );
        add_action( 'woocommerce_pay_order_after_submit', [ $this, 'display_paypal_button' ], 20 );
        add_action( 'wp_enqueue_scripts', [ $this, 'payment_scripts' ] );
    }

    /**
     * Checkout page script added
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return void
     */
    public function payment_scripts() {
        if ( ! is_cart() && ! is_checkout() && ! isset( $_GET['pay_for_order'] ) ) { //phpcs:ignore WordPress.Security.NonceVerification.Recommended
            return;
        }

        // if our payment gateway is disabled
        if ( ! Helper::is_enabled() ) {
            return;
        }

        if ( 'smart' !== Helper::get_button_type() ) {
            return;
        }

        if ( ! apply_filters( 'dokan_paypal_load_payment_scripts', true ) ) {
            return;
        }

        //loading this scripts only in checkout page
        if ( ! is_order_received_page() && is_checkout() || is_checkout_pay_page() ) {
            global $wp;

            //get order id if this is a order review page
            $order_id = isset( $wp->query_vars['order-pay'] ) ? $wp->query_vars['order-pay'] : null;

            $paypal_js_sdk_url = $this->get_paypal_sdk_url();

            //paypal sdk enqueue
            wp_enqueue_script( 'dokan_paypal_sdk', $paypal_js_sdk_url, [], null, false ); //phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion

            wp_enqueue_script( 'dokan_paypal_checkout', DOKAN_PLUGIN_ASSEST . '/js/paypal-checkout.js', [ 'dokan_paypal_sdk' ], time(), true );

            //localize data
            $data = [
                'payment_button_type'     => Helper::get_button_type(),
                'is_checkout_page'        => is_checkout(),
                'is_ucc_enabled'          => Helper::is_ucc_enabled_for_all_seller_in_cart(),
                'nonce'                   => wp_create_nonce( 'dokan_paypal' ),
                'is_checkout_pay_page'    => is_checkout_pay_page(),
                'order_id'                => $order_id,
                'card_info_error_message' => __( 'Please fill up the card info!', 'dokan-lite' ),
            ];

            if ( is_checkout_pay_page() ) {
                // get order info
                $order = wc_get_order( $order_id );
                if ( $order instanceof \WC_Order ) {
                    $data['billing_address'] = [
                        'streetAddress'     => $order->get_billing_address_1(),
                        'extendedAddress'   => $order->get_billing_address_2(),
                        'region'            => $order->get_billing_state(),
                        'locality'          => $order->get_billing_city(),
                        'postalCode'        => $order->get_billing_postcode(),
                        'countryCodeAlpha2' => $order->get_billing_country(),
                    ];
                }
            }

            wp_localize_script( 'dokan_paypal_sdk', 'dokan_paypal', $data );

            //add BN code to script
            add_filter( 'script_loader_tag', [ $this, 'add_bn_code_to_script' ], 10, 3 );
        }
    }

    /**
     * Add bn code and merchant ids to paypal script
     *
     * @param $tag
     * @param $handle
     * @param $source
     *
     * @return string
     */
    public function add_bn_code_to_script( $tag, $handle, $source ) {
        if ( 'dokan_paypal_sdk' === $handle ) {
            $paypal_merchant_ids = [];

            //if this is a order review page
            if ( is_checkout_pay_page() ) {
                global $wp;

                //get order id if this is a order review page
                $order_id = isset( $wp->query_vars['order-pay'] ) ? $wp->query_vars['order-pay'] : null;

                $order = wc_get_order( $order_id );

                foreach ( $order->get_items( 'line_item' ) as $key => $line_item ) {
                    $product_id = $line_item->get_product_id();
                    $seller_id  = get_post_field( 'post_author', $product_id );

                    $merchant_id = Helper::get_seller_merchant_id( $seller_id );
                    $merchant_id = apply_filters( 'dokan_paypal_marketplace_merchant_id', $merchant_id, $product_id );

                    $paypal_merchant_ids[ 'seller_' . $seller_id ] = $merchant_id;
                }
            } elseif ( is_checkout() ) {
                foreach ( WC()->cart->get_cart() as $item ) {
                    $product_id = $item['data']->get_id();
                    $seller_id  = get_post_field( 'post_author', $product_id );

                    $merchant_id = Helper::get_seller_merchant_id( $seller_id );
                    $merchant_id = apply_filters( 'dokan_paypal_marketplace_merchant_id', $merchant_id, $product_id );

                    $paypal_merchant_ids[ 'seller_' . $seller_id ] = $merchant_id;
                }
            }

            if ( count( $paypal_merchant_ids ) > 1 ) {
                $source .= '&merchant-id=*';
            } elseif ( 1 === count( $paypal_merchant_ids ) ) {
                //get the first item of associative array
                $paypal_merchant_id = reset( $paypal_merchant_ids );
                $source             .= '&merchant-id=' . $paypal_merchant_id;
            }

            //get token if ucc mode enabled
            $data_client_token = '';
            if ( Helper::is_ucc_enabled_for_all_seller_in_cart() ) {
                $processor    = Processor::init();
                $client_token = $processor->get_generated_client_token();

                if ( is_wp_error( $client_token ) ) {
                    dokan_log( 'dokan paypal marketplace generated access token error: ' . $client_token->get_error_message() );
                } else {
                    $data_client_token = 'data-client-token="' . esc_attr( $client_token ) . '"';
                }
            }

            //@codingStandardsIgnoreStart
            $tag = '<script async type="text/javascript" src="' . esc_url( $source ) . '" id="' . esc_attr( $handle ) . '-js"
data-merchant-id="' . esc_attr( implode( ',', $paypal_merchant_ids ) ) . '" ' . $data_client_token . ' data-partner-attribution-id="' . esc_attr( Processor::BN_CODE ) . '"></script>';
            //@codingStandardsIgnoreEnd
        }

        return $tag;
    }

    /**
     * Display PayPal button on the checkout page order review.
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return void
     */
    public function display_paypal_button() {
        if ( ! apply_filters( 'dokan_paypal_display_paypal_button', true ) ) {
            return;
        }
        // do not load if button type is not smart
        if ( Helper::get_button_type() !== 'smart' ) {
            return;
        }
        ?>
        <img src="<?php echo DOKAN_PLUGIN_ASSEST . '/images/spinner-2x.gif'; ?>" class="paypal-loader" style="margin: 0 auto;" alt="PayPal is loading...">
        <div id="paypal-button-container" style="display:none;">
            <?php if ( Helper::is_ucc_enabled_for_all_seller_in_cart() ) : ?>
                <div class="unbranded_checkout">
                    <a id="pay_unbranded_order" href="#" class="button alt" value="<?php esc_attr_e( 'Place order', 'dokan-lite' ); ?>"><?php esc_html_e( 'Pay', 'dokan-lite' ); ?></a>
                    <p class="text-center"><?php esc_html_e( 'OR', 'dokan-lite' ); ?></p>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * Validation after checkout
     *
     * @param $data
     * @param $errors
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return void
     */
    public function after_checkout_validation( $data, $errors ) {
        if ( $this->id !== $data['payment_method'] ) {
            return;
        }

        $available_vendors = [];
        foreach ( WC()->cart->get_cart() as $item ) {
            $product_id = $item['data']->get_id();
            // check if this is a vendor subscription product
            if ( Helper::is_vendor_subscription_product( $product_id ) ) {
                continue;
            }

            $available_vendors[ get_post_field( 'post_author', $product_id ) ][] = $item['data'];
        }

        foreach ( array_keys( $available_vendors ) as $vendor_id ) {
            if ( ! Helper::is_seller_enable_for_receive_payment( $vendor_id ) ) {
                //$vendor      = dokan()->vendor->get( $vendor_id );
                //$vendor_name = sprintf( '<a href="%s">%s</a>', esc_url( $vendor->get_shop_url() ), $vendor->get_shop_name() );

                $vendor_products = [];
                foreach ( $available_vendors[ $vendor_id ] as $product ) {
                    $vendor_products[] = sprintf( '<a href="%s">%s</a>', $product->get_permalink(), $product->get_name() );
                }

                $errors->add(
                    'paypal-not-configured',
                    /* translators: %s: vendor products */
                    sprintf( __( '<strong>Error!</strong>Remove product %s and continue checkout, this product/vendor is not eligible to be paid with PayPal', 'dokan-lite' ), implode( ', ', $vendor_products ) )
                );
            }
        }
    }

    /**
     * Make paypal sdk url based on settings
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return string
     */
    public function get_paypal_sdk_url() {
        $client_id         = Helper::get_client_id();
        $paypal_js_sdk_url = esc_url( 'https://www.paypal.com/sdk/js?' );

        //add hosted fields component if ucc mode is enabled
        if ( Helper::is_ucc_enabled_for_all_seller_in_cart() ) {
            $paypal_js_sdk_url .= 'components=hosted-fields,buttons&';
        }

        $currency = get_woocommerce_currency();
        $paypal_js_sdk_url .= "client-id={$client_id}&currency={$currency}&intent=capture";

        return $paypal_js_sdk_url;
    }
}