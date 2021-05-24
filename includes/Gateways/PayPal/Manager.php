<?php

namespace WeDevs\Dokan\Gateways\PayPal;

use WeDevs\Dokan\Gateways\PayPal\PaymentMethod\DokanPayPal;
use WeDevs\Dokan\Gateways\PayPal\Utilities\Processor;
use WeDevs\Dokan\Traits\ChainableContainer;
use WeDevs\Dokan\Gateways\Manager as GatewayManager;

//todo: 1, rewrite apis so that we can send custom apis, rewrite make_request() method
//todo: 2, check api calls and change return=representation to return=minimal while necessary, this will make api calls a little bit faster
//todo: 3, send some task to background process

/**
 * Class Manager
 * @package WeDevs\Dokan\Gateways\PayPal
 *
 * @since DOKAN_LITE_SINCE
 * @author weDevs
 */
class Manager {

    use ChainableContainer;

    /**
     * PayPal Manager constructor
     *
     * @since DOKAN_LITE_SINCE
     */
    public function __construct() {
        $this->register_gateway();
        $this->set_controllers();

        add_action( 'template_redirect', [ $this, 'handle_paypal_marketplace' ], 10 );
    }

    /**
     * Set controllers
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return void
     */
    private function set_controllers() {
        $this->container['vendor_withdraw_methods'] = new VendorWithdrawMethod();
        $this->container['paypal_wc_gateway']       = new DokanPayPal();
        $this->container['paypal_webhook']          = new WebhookHandler();
        $this->container['paypal_cart']             = new CartHandler();
        $this->container['ajax']                    = new Ajax();
    }

    /**
     * Register PayPal gateway
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return void
     */
    public function register_gateway() {
        GatewayManager::set_gateway( DokanPayPal::class );
    }

    /**
     * Handle paypal marketplace
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return void
     */
    public function handle_paypal_marketplace() {
        $user_id = dokan_get_current_user_id();
        if ( empty( $user_id ) || ! dokan_is_user_seller( $user_id ) ) {
            return;
        }

        if (
            ! isset( $_GET['action'] ) || (
            'dokan-paypal-marketplace-connect' !== $_GET['action'] &&
            'dokan-paypal-marketplace-connect-success' !== $_GET['action'] &&
            'dokan-paypal-merchant-status-update' !== $_GET['action'] )
        ) {
            return;
        }

        $get_data = wp_unslash( $_GET );

        if ( isset( $get_data['_wpnonce'] ) && 'dokan-paypal-marketplace-connect' === $get_data['action'] && ! wp_verify_nonce( $get_data['_wpnonce'], 'dokan-paypal-marketplace-connect' ) ) {
            wp_safe_redirect( add_query_arg( [ 'message' => 'error' ], dokan_get_navigation_url( 'settings/payment' ) ) );
            exit();
        }

        if ( isset( $get_data['_wpnonce'] ) && $_GET['action'] === 'dokan-paypal-marketplace-connect-success' && ! wp_verify_nonce( $get_data['_wpnonce'], 'dokan-paypal-marketplace-connect-success' ) ) {
            wp_safe_redirect(
                add_query_arg(
                    [
                        'status'  => 'error',
                        'message' => 'paypal_connect_error',
                    ],
                    dokan_get_navigation_url( 'settings/payment' )
                )
            );
            exit();
        }

        if ( isset( $get_data['_wpnonce'] ) && $_GET['action'] === 'dokan-paypal-merchant-status-update' && ! wp_verify_nonce( $get_data['_wpnonce'], 'dokan-paypal-merchant-status-update' ) ) {
            wp_safe_redirect( add_query_arg( [ 'message' => 'error' ], dokan_get_navigation_url( 'settings/payment' ) ) );
            exit();
        }

        if ( isset( $get_data['action'] ) && 'dokan-paypal-marketplace-connect-success' === $get_data['action'] ) {
            $this->handle_paypal_marketplace_connect_success_response();
        }

        if ( isset( $get_data['action'] ) && 'dokan-paypal-merchant-status-update' === $get_data['action'] ) {
            $merchant_id = Helper::get_seller_merchant_id( dokan_get_current_user_id() );
            $this->validate_merchant_status( $merchant_id );
        }
    }

    /**
     * Handle paypal marketplace success response process
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return void
     */
    public function handle_paypal_marketplace_connect_success_response() {
        $user_id         = dokan_get_current_user_id();
        $paypal_settings = get_user_meta( $user_id, Helper::get_seller_marketplace_settings_key(), true );
        $processor       = Processor::init();
        $merchant_data   = $processor->get_merchant_id( $paypal_settings['tracking_id'] );

        if ( is_wp_error( $merchant_data ) ) {
            Helper::log_paypal_error( $user_id, $merchant_data, 'dpm_connect_success_response', 'user' );
            wp_safe_redirect(
                add_query_arg(
                    [
                        'status'  => 'error',
                        'message' => Helper::get_error_message( $merchant_data ),
                    ],
                    dokan_get_navigation_url( 'settings/payment' )
                )
            );
            exit();
        }

        //storing paypal merchant id
        $merchant_id = $merchant_data['merchant_id'];
        update_user_meta( $user_id, Helper::get_seller_merchant_id_key(), $merchant_id );

        $paypal_settings['connection_status'] = 'success';

        update_user_meta(
            $user_id,
            Helper::get_seller_marketplace_settings_key(),
            $paypal_settings
        );

        //update paypal email in dokan profile settings
        $dokan_settings = get_user_meta( $user_id, 'dokan_profile_settings', true );

        $dokan_settings['payment']['dokan_paypal_marketplace'] = [
            'email' => $paypal_settings['email'],
        ];
        update_user_meta( $user_id, 'dokan_profile_settings', $dokan_settings );

        //validate merchant status for payment receiving
        $this->validate_merchant_status( $merchant_id );
    }

    /**
     * Validate status of a merchant and store data
     *
     * @param $merchant_id
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return void
     */
    public function validate_merchant_status( $merchant_id ) {
        $processor       = Processor::init();
        $merchant_status = $processor->get_merchant_status( $merchant_id );
        $user_id         = dokan_get_current_user_id();

        if ( is_wp_error( $merchant_status ) ) {
            Helper::log_paypal_error( $user_id, $merchant_status, 'dpm_validate_merchant_status', 'user' );
            wp_safe_redirect(
                add_query_arg(
                    [
                        'status'  => 'error',
                        'message' => Helper::get_error_message( $merchant_status ),
                    ],
                    dokan_get_navigation_url( 'settings/payment' )
                )
            );
            exit();
        }

        update_user_meta( $user_id, Helper::get_seller_enabled_for_received_payment_key(), false );
        update_user_meta( $user_id, Helper::get_seller_payments_receivable_key(), $merchant_status['payments_receivable'] );
        update_user_meta( $user_id, Helper::get_seller_primary_email_confirmed_key(), $merchant_status['primary_email_confirmed'] );

        //check if the user is able to receive payment
        if ( $merchant_status['payments_receivable'] && $merchant_status['primary_email_confirmed'] ) {
            $oauth_integrations = $merchant_status['oauth_integrations'];

            array_map(
                function ( $integration ) use ( $user_id ) {
                    if ( 'OAUTH_THIRD_PARTY' === $integration['integration_type'] && count( $integration['oauth_third_party'] ) ) {
                        update_user_meta( $user_id, Helper::get_seller_enabled_for_received_payment_key(), true );
                    }
                }, $oauth_integrations
            );
        }

        //check if the user is able to use UCC mode
        $products = $merchant_status['products'];

        array_map(
            function ( $value ) use ( $user_id ) {
                if ( 'PPCP_CUSTOM' === $value['name'] && 'SUBSCRIBED' === $value['vetting_status'] ) {
                    update_user_meta( $user_id, Helper::get_seller_enable_for_ucc_key(), true );
                }
            }, $products
        );
    }

    /**
     * Insert withdraw data to vendor balance
     *
     * @param array $withdraw
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return void
     */
    public function insert_into_vendor_balance( $withdraw ) {
        global $wpdb;

        //update debit amount in vendor table where trn_type is `dokan_orders`
        $wpdb->update(
            $wpdb->dokan_vendor_balance,
            [ 'debit' => (float) $withdraw['amount'] ],
            [
                'vendor_id' => $withdraw['vendor_id'],
                'trn_id'    => $withdraw['order_id'],
                'trn_type'  => 'dokan_orders',
            ],
            [ '%f' ],
            [ '%d', '%d' ]
        );

        //insert withdraw amount
        $wpdb->insert(
            $wpdb->prefix . 'dokan_vendor_balance',
            [
                'vendor_id'    => $withdraw['vendor_id'],
                'trn_id'       => $withdraw['order_id'],
                'trn_type'     => 'dokan_withdraw',
                'perticulars'  => 'Paid Via PayPal',
                'debit'        => 0,
                'credit'       => $withdraw['amount'],
                'status'       => 'approved',
                'trn_date'     => current_time( 'mysql' ),
                'balance_date' => current_time( 'mysql' ),
            ],
            [
                '%d',
                '%d',
                '%s',
                '%s',
                '%f',
                '%f',
                '%s',
                '%s',
                '%s',
            ]
        );

        //update vendor net amount after subtracting of payment fee
        $wpdb->update(
            $wpdb->dokan_orders,
            [ 'net_amount' => (float) $withdraw['amount'] ],
            [ 'order_id' => $withdraw['order_id'] ],
            [ '%f' ],
            [ '%d' ]
        );
    }

    /**
     * Process seller withdraw
     *
     * @param array $withdraw
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return void
     */
    public function process_seller_withdraw( $withdraw ) {
        $ip = dokan_get_client_ip();

        $data = [
            'user_id' => $withdraw['vendor_id'],
            'amount'  => $withdraw['amount'],
            'date'    => current_time( 'mysql' ),
            'status'  => 1,
            'method'  => Helper::get_gateway_id(),
            /* translators: %d: order id */
            'notes'   => sprintf( __( 'Order %d payment Auto paid via PayPal', 'dokan-lite' ), $withdraw['order_id'] ),
            'ip'      => $ip,
        ];

        dokan()->withdraw->insert_withdraw( $data );
    }

    /**
     * Handle vendor balance and withdraw request
     *
     * @param array $withdraw_data
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return void
     */
    public function handle_vendor_balance( array $withdraw_data ) {
        $this->insert_into_vendor_balance( $withdraw_data );
        $this->process_seller_withdraw( $withdraw_data );
    }

    /**
     * Store each order capture id
     *
     * @param array $purchase_units
     * @param \WC_Order $order
     *
     * @since DOKAN_LITE_SINCE
     *
     * @return void
     */
    public function store_capture_payment_data( $purchase_units, \WC_Order $order ) {
        //add capture id to meta data
        $meta_key_prefix = '_dokan_paypal_payment_';

        foreach ( $purchase_units as $key => $unit ) {
            $capture_id = $unit['payments']['captures'][0]['id'];

            $seller_receivable              = $unit['payments']['captures'][0]['seller_receivable_breakdown'];
            $paypal_fee_data                = $seller_receivable['paypal_fee'];
            $paypal_processing_fee_currency = $paypal_fee_data['currency_code'];
            $paypal_processing_fee          = $paypal_fee_data['value'];
            $platform_fee                   = $seller_receivable['platform_fees'][0]['amount']['value'];//admin commission

            //maybe this is a suborder id. if there is no suborder then it will be the main order id
            $_order_id = $unit['custom_id'];

            $invoice_id = $unit['invoice_id'];

            //may be a suborder
            $_order = wc_get_order( $_order_id );

            $_order->add_order_note(
                /* translators: %s: paypal processing fee */
                sprintf( __( 'PayPal processing fee is %s', 'dokan-lite' ), $paypal_processing_fee )
            );

            //add order note to parent order
            if ( $_order_id !== $invoice_id ) {
                $order_url = $_order->get_edit_order_url();
                $order->add_order_note(
                    /* translators: 1$s: a tag with url , 2$s: paypal processing fee  */
                    sprintf( __( 'PayPal processing for sub order %1$s is %2$s', 'dokan-lite' ), "<a href='{$order_url}'>{$_order_id}</a>", $paypal_processing_fee )
                );
            }

            $_order->update_meta_data( $meta_key_prefix . 'capture_id', $capture_id );
            $_order->update_meta_data( $meta_key_prefix . 'processing_fee', $paypal_processing_fee );
            $_order->update_meta_data( $meta_key_prefix . 'processing_currency', $paypal_processing_fee_currency );
            $_order->update_meta_data( $meta_key_prefix . 'platform_fee', $platform_fee );
            $_order->update_meta_data( 'dokan_gateway_fee', $paypal_processing_fee );
            $_order->update_meta_data( 'dokan_gateway_fee_paid_by', 'seller' );
            $_order->save_meta_data();

            $seller_id = dokan_get_seller_id_by_order( $_order->get_id() );
            $withdraw_data = [
                'vendor_id' => $seller_id,
                'order_id'  => $_order->get_id(),
                'amount'    => $seller_receivable['net_amount']['value'],
            ];

            $this->handle_vendor_balance( $withdraw_data );
        }
    }
}