
//paypal smart checkout button
;(function ( $, window, document ) {
    'use strict';

    if ('undefined' === typeof dokan_paypal || ! dokan_paypal.is_checkout_page) {
        return;
    }

    if ( 'smart' !== dokan_paypal.payment_button_type ) {
        return;
    }

    var selected_payment_method;

    var payment_method = {
        toggle_buttons: function (payment_method) {
            var isPayPal = payment_method === 'dokan_paypal_marketplace';
            var togglePaypal = isPayPal ? 'show' : 'hide';
            var toggleSubmit = isPayPal ? 'hide' : 'show';

            $( '#paypal-button-container' ).animate( { opacity: togglePaypal, height: togglePaypal, padding: togglePaypal }, 230 );
            $( '#place_order' ).animate( { opacity: toggleSubmit, height: toggleSubmit, padding: toggleSubmit }, 230 );
        },
        on_change: function () {
            $( 'form.checkout, form#order_review' ).on( 'click', 'input[name="payment_method"]', function(e) {
                if ( 'smart' !== dokan_paypal.payment_button_type ) {
                    return;
                }

                if ( selected_payment_method === e.target.value ) {
                    return;
                }

                selected_payment_method = e.target.value;
                payment_method.toggle_buttons(e.target.value);
            } );
        },
        init: function () {
            if (!window.paypal) {
                return;
            }

            if ( 'smart' !== dokan_paypal.payment_button_type ) {
                return;
            }

            let checked_payment_method = $('.woocommerce-checkout').find('input[name="payment_method"]:checked').val();
            payment_method.toggle_buttons(checked_payment_method);

            payment_method.on_change();
        }
    };

    setTimeout(() => {
        payment_method.init();
        $('.paypal-loader').hide();
    }, 6000);

})( jQuery, window, document );

// paypal checkout process
;(function($, window, document) {
    $(document).ready(function() {
        if ('undefined' === typeof dokan_paypal || ! dokan_paypal.is_checkout_page) {
            return;
        }

        if ( 'smart' !== dokan_paypal.payment_button_type ) {
            return;
        }

        var dokan_paypal_marketplace = {
            checkout_form: $('form.checkout, form#order_review'),
            order_success_redirect_url: '',
            order_cancel_redirect_url: '',
            order_id: '',

            reset_order_data: function() {
                this.order_success_redirect_url = '';
                this.order_cancel_redirect_url = '';
                this.order_id = '';
            },
            is_paypal_selected: function() {
                return (
                    $('.woocommerce-checkout').find('input[name="payment_method"]:checked').val() ===
                    'dokan_paypal_marketplace'
                );
            },
            set_loading_on: function() {
                dokan_paypal_marketplace.checkout_form.addClass('processing').block({
                    message: null,
                    overlayCSS: {
                        background: '#fff',
                        opacity: 0.6
                    }
                });
            },
            set_loading_done: function() {
                dokan_paypal_marketplace.checkout_form.removeClass('processing').unblock();
            },
            submit_error: function(errorMessage) {
                dokan_paypal_marketplace.set_loading_done();
                dokan_paypal_marketplace.reset_order_data();
                $('.woocommerce-NoticeGroup-checkout, .woocommerce-error, .woocommerce-message').remove();
                dokan_paypal_marketplace.checkout_form.prepend(
                    '<div class="woocommerce-NoticeGroup woocommerce-NoticeGroup-checkout">' + errorMessage + '</div>'
                );

                dokan_paypal_marketplace.checkout_form
                    .find('.input-text, select, input:checkbox')
                    .trigger('validate')
                    .blur();

                dokan_paypal_marketplace.scroll_to_notice();
                $(document.body).trigger('checkout_error', [ errorMessage ]);
            },
            scroll_to_notice: function () {
                $('html, body').animate(
                    {
                        scrollTop: $('form.checkout, form#order_review').offset().top - 100
                    },
                    1000
                );
            },
            set_order: function() {
                return $.ajax({
                    type: 'POST',
                    url: wc_checkout_params.checkout_url,
                    data: dokan_paypal_marketplace.checkout_form.serialize(),
                    dataType: 'json',
                }).fail(function(jqXHR, textStatus, errorThrown) {
                    dokan_paypal_marketplace.submit_error('<div class="woocommerce-error">' + errorThrown + '</div>');
                });
            },
            create_order: function () {
                dokan_paypal_marketplace.set_loading_on();

                let create_order_data = {
                    order_id: dokan_paypal.order_id,
                    action: "dokan_paypal_create_order",
                    nonce: dokan_paypal.nonce
                };

                return $.ajax({
                    type: 'POST',
                    url: dokan.ajaxurl,
                    data: create_order_data,
                    dataType: 'json',
                }).fail(function(jqXHR, textStatus, errorThrown) {
                    dokan_paypal_marketplace.set_loading_done();
                    dokan_paypal_marketplace.submit_error('<div class="woocommerce-error">' + errorThrown + '</div>');
                });
            },
            do_submit: function() {
                dokan_paypal_marketplace.set_loading_on();
                if (dokan_paypal.is_checkout_pay_page) {
                    return dokan_paypal_marketplace.create_order();
                } else {
                    return dokan_paypal_marketplace.set_order();
                }
            },
            capture_payment: function (order_id, order_redirect_url, actions = false) {
                dokan_paypal_marketplace.set_loading_on();

                let capture_data = {
                    order_id: order_id,
                    action: "dokan_paypal_capture_payment",
                    nonce: dokan_paypal.nonce
                };

                $.ajax({
                    type: 'POST',
                    url: dokan.ajaxurl,
                    data: capture_data,
                    dataType: 'json',
                }).done(function(result) {
                    dokan_paypal_marketplace.set_loading_done();

                    try {
                        if (result.success) {
                            window.location.href = order_redirect_url;
                        } else {
                            if (result.data.data) {
                                let error_data = JSON.parse(result.data.data[0]);

                                if ('INSTRUMENT_DECLINED' === error_data.details[0].issue) {
                                    return actions.restart();
                                }
                            }

                            throw new Error(result.data.message);
                        }
                    } catch (err) {
                        // Reload page
                        if (result.reload === true) {
                            window.location.reload();
                            return;
                        }

                        // Add new errors
                        if (result.data.message) {
                            dokan_paypal_marketplace.submit_error('<div class="woocommerce-error">' + result.data.message + '</div>');
                        }
                    }
                }).fail(function(jqXHR, textStatus, errorThrown) {
                    dokan_paypal_marketplace.set_loading_done();
                    dokan_paypal_marketplace.submit_error('<div class="woocommerce-error">' + errorThrown + '</div>');
                });
            },
            render_ajax_response: function( res ) {
                try {
                    if ( dokan_paypal.is_checkout_pay_page ) {
                        res = res.data.data;
                    }
                    dokan_paypal_marketplace.set_loading_done();

                    if ( res.result === 'success' ) {
                        dokan_paypal_marketplace.order_success_redirect_url = res.success_redirect;
                        dokan_paypal_marketplace.order_cancel_redirect_url = res.cancel_redirect
                        dokan_paypal_marketplace.order_id = res.id;
                        return res.paypal_order_id;
                    } else if ( res.result === 'failure' ) {
                        throw new Error( 'Result failure' );
                    } else {
                        throw new Error( 'Invalid response' );
                    }
                } catch ( err ) {
                    // Reload page
                    if ( res.reload === true ) {
                        window.location.reload();
                    }
                    // Trigger update in case we need a fresh nonce
                    if ( res.refresh === true ) {
                        jQuery( document.body ).trigger( 'update_checkout' );
                    }
                    // Add new errors
                    if ( res.messages ) {
                        dokan_paypal_marketplace.submit_error( res.messages );
                    } else {
                        dokan_paypal_marketplace.submit_error( '<div class="woocommerce-error">' + wc_checkout_params.i18n_checkout_error + '</div>' );
                    }
                    return false;
                }
            },
            init_hosted_fields: function () {
                if (dokan_paypal.is_ucc_enabled && window.paypal.HostedFields.isEligible()) {
                    window.paypal.HostedFields.render({
                        createOrder: function () {
                            if (dokan_paypal_marketplace.is_paypal_selected()) {
                                return dokan_paypal_marketplace.do_submit().then( function( res ) {
                                    return dokan_paypal_marketplace.render_ajax_response( res );
                                });
                            }
                            return false;
                        },
                        styles: {
                            'input': {
                                'font-size': '17px',
                                'font-family': 'helvetica, tahoma, calibri, sans-serif',
                                'color': '#3a3a3a'
                            },
                            ':focus': {
                                'color': 'black'
                            }
                        },
                        fields: {
                            number: {
                                selector: '#dpm_card_number',
                                placeholder: 'card number',
                            },
                            cvv: {
                                selector: '#dpm_cvv',
                                placeholder: 'card security number',
                            },
                            expirationDate: {
                                selector: '#dpm_card_expiry',
                                placeholder: 'mm/yy',
                            }
                        }
                    }).then(function (hf) {
                        var formValid;

                        hf.on('validityChange', function (event) {
                            var field = event.fields[event.emittedBy];

                            var state = hf.getState();
                            formValid = Object.keys(state.fields).every(function (key) {
                                return state.fields[key].isValid;
                            });

                            if (formValid) {
                                $("#pay_unbranded_order").attr('disabled', false);
                            } else {
                                $("#pay_unbranded_order").attr('disabled', true);
                            }
                        });

                        $('#pay_unbranded_order').on('click', function (e) {
                            e.preventDefault();

                            if (!formValid) {
                                dokan_paypal_marketplace.submit_error('<div class="woocommerce-error">' + dokan_paypal.card_info_error_message +'</div>');
                                return false;
                            }

                            var billing_address = {};
                            if (dokan_paypal.billing_address) {
                                billing_address = dokan_paypal.billing_address;
                            } else {
                                var billing_address = {
                                    streetAddress: document.getElementById('billing_address_1').value,
                                    extendedAddress: document.getElementById('billing_address_2').value,
                                    region: document.getElementById('billing_state').value,
                                    locality: document.getElementById('billing_city').value,
                                    postalCode: document.getElementById('billing_postcode').value,
                                    countryCodeAlpha2: document.getElementById('billing_country').value
                                };
                            }

                            var args = {
                                contingencies: ['3D_SECURE'],
                                cardholderName: document.getElementById('dpm_name_on_card').value,
                                billingAddress: billing_address
                            };

                            hf.submit(args).then(function (res) {
                                dokan_paypal_marketplace.capture_payment(dokan_paypal_marketplace.order_id, dokan_paypal_marketplace.order_success_redirect_url);
                            }).catch(function (err) {
                                dokan_paypal_marketplace.submit_error('<div class="woocommerce-error">' + JSON.stringify(err) + '</div>');
                            });
                        });
                    }).catch(function (err) {
                        dokan_paypal_marketplace.submit_error('<div class="woocommerce-error">' + JSON.stringify(err) + '</div>');
                    });
                }
            },
            init_paypal: function () {
                window.paypal.Buttons({
                    createOrder: function(data, actions) {
                        if ( dokan_paypal_marketplace.is_paypal_selected() ) {
                            return dokan_paypal_marketplace.do_submit().then( function( res ) {
                                return dokan_paypal_marketplace.render_ajax_response( res );
                            });
                        }
                        return false;
                    },
                    onApprove: function(data, actions) {
                        dokan_paypal_marketplace.capture_payment(dokan_paypal_marketplace.order_id, dokan_paypal_marketplace.order_success_redirect_url, actions);
                    },
                    onCancel: function( data ) {
                        dokan_paypal_marketplace.set_loading_done();
                        dokan_paypal_marketplace.reset_order_data();
                        //window.location.href = dokan_paypal_marketplace.order_cancel_redirect_url;
                    },
                    onError: function (err) {
                        dokan_paypal_marketplace.set_loading_done();
                        var error_div = dokan_paypal_marketplace.checkout_form.find( '.woocommerce-NoticeGroup > ul.woocommerce-error, .woocommerce-NoticeGroup-checkout > ul.woocommerce-error' );
                        if ( error_div.length === 0 ) {
                            dokan_paypal_marketplace.submit_error('<div class="woocommerce-error">' + err + '</div>');
                        }
                        //window.location.href = order_redirect_url;
                    }
                })
                .render('#paypal-button-container')
                .catch(function (err) {
                    dokan_paypal_marketplace.submit_error('<div class="woocommerce-error">' + JSON.stringify(err) + '</div>');
                });

                dokan_paypal_marketplace.init_hosted_fields();
                $('.paypal-loader').hide();
            }
        };

        setTimeout(() => {
            dokan_paypal_marketplace.init_paypal();
            //$('.paypal-loader').hide();
        }, 5000);
    });

})(jQuery, window, document);