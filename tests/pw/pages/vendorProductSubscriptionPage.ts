import { Page } from '@playwright/test';
import { VendorPage } from '@pages/vendorPage';
import { CustomerPage } from '@pages/customerPage';
import { selector } from '@pages/selectors';
import { data } from '@utils/testData';
import { customer } from '@utils/interfaces';

export class VendorProductSubscriptionPage extends VendorPage {
    constructor(page: Page) {
        super(page);
    }

    customerPage = new CustomerPage(this.page);

    // product subscription

    // vendor return request render properly
    async vendorUserSubscriptionsRenderProperly() {
        await this.goIfNotThere(data.subUrls.frontend.vDashboard.userSubscriptions);

        // filter
        const { filterByCustomerInput, result, ...filters } = selector.vendor.vUserSubscriptions.filters;
        await this.multipleElementVisible(filters);

        const noSubscriptionsFound = await this.isVisible(selector.vendor.vUserSubscriptions.noSubscriptionsFound);
        if (noSubscriptionsFound) {
            return;
        }
    }

    // vendor view product subscription
    async viewProductSubscription(value: string) {
        // todo: go to subscription details via link , get subscription id via api
        // todo:
    }

    // filter product subscriptions
    async filterProductSubscriptions(filterBy: string, inputValue: string): Promise<void> {
        await this.goIfNotThere(data.subUrls.frontend.vDashboard.userSubscriptions);

        switch (filterBy) {
            case 'by-customer':
                await this.click(selector.vendor.vUserSubscriptions.filters.filterByCustomer);
                await this.typeAndWaitForResponse(data.subUrls.ajax, selector.vendor.vUserSubscriptions.filters.filterByCustomerInput, inputValue);
                await this.toContainText(selector.vendor.vUserSubscriptions.filters.result, inputValue);
                await this.press(data.key.enter);
                break;

            case 'by-date':
                await this.setAttributeValue(selector.vendor.vUserSubscriptions.filters.filterByDate, 'value', inputValue);
                break;

            default:
                break;
        }

        await this.clickAndWaitForResponseAndLoadState(data.subUrls.frontend.vDashboard.userSubscriptions, selector.vendor.vUserSubscriptions.filters.filter);
        await this.notToHaveCount(selector.vendor.vUserSubscriptions.numberOfRowsFound, 0);
    }

    // customer

    // cancel product subscription
    async customerViewProductSubscription(subscriptionId: string) {
        await this.goIfNotThere(data.subUrls.frontend.productSubscriptionDetails(subscriptionId));

        // subscription heading is visible
        await this.toBeVisible(selector.customer.cSubscription.subscriptionDetails.subscriptionHeading);

        // subscription action elements are visible
        const { reActivate, ...actions } = selector.customer.cSubscription.subscriptionDetails.actions;
        await this.multipleElementVisible(actions);
        // todo: add more fields
    }

    // cancel product subscription
    async cancelProductSubscription(subscriptionId: string) {
        await this.goIfNotThere(data.subUrls.frontend.productSubscriptionDetails(subscriptionId));

        await this.clickAndWaitForResponseAndLoadState(data.subUrls.frontend.productSubscriptionDetails(subscriptionId), selector.customer.cSubscription.subscriptionDetails.actions.cancel, 302);
        await this.toContainText(selector.customer.cWooSelector.wooCommerceSuccessMessage, 'Your subscription has been cancelled.');
    }

    // reactivate product subscription
    async reactivateProductSubscription(subscriptionId: string) {
        await this.goIfNotThere(data.subUrls.frontend.productSubscriptionDetails(subscriptionId));
        const subscriptionIsActive = await this.isVisible(selector.customer.cSubscription.subscriptionDetails.actions.cancel);
        subscriptionIsActive && (await this.cancelProductSubscription(subscriptionId));

        await this.clickAndWaitForResponseAndLoadState(data.subUrls.frontend.productSubscriptionDetails(subscriptionId), selector.customer.cSubscription.subscriptionDetails.actions.reActivate, 302);
        await this.toContainText(selector.customer.cWooSelector.wooCommerceSuccessMessage, 'Your subscription has been reactivated.');
    }

    // change address of product subscription
    async changeAddressOfProductSubscription(subscriptionId: string, shippingInfo: customer['customerInfo']['shipping']) {
        await this.goIfNotThere(data.subUrls.frontend.productSubscriptionDetails(subscriptionId));

        await this.clickAndWaitForLoadState(selector.customer.cSubscription.subscriptionDetails.actions.changeAddress);
        await this.customerPage.updateShippingFields(shippingInfo);
        await this.clickAndWaitForResponseAndLoadState(data.subUrls.frontend.shippingAddress, selector.customer.cAddress.shipping.shippingSaveAddress, 302);
        await this.toContainText(selector.customer.cWooSelector.wooCommerceSuccessMessage, data.customer.address.addressChangeSuccessMessage);
    }

    // change payment of product subscription
    async changePaymentOfProductSubscription(subscriptionId: string) {
        await this.goIfNotThere(data.subUrls.frontend.productSubscriptionDetails(subscriptionId));
        await this.clickAndWaitForLoadState(selector.customer.cSubscription.subscriptionDetails.actions.changePayment);
        // todo: change to new card
        await this.clickAndWaitForResponseAndLoadState(data.subUrls.frontend.productSubscriptionDetails(subscriptionId), selector.customer.cSubscription.subscriptionDetails.changePaymentMethod);
        await this.toContainText(selector.customer.cWooSelector.wooCommerceSuccessMessage, 'Payment method updated.');
    }

    // renew product subscription
    async renewProductSubscription(subscriptionId: string) {
        await this.goIfNotThere(data.subUrls.frontend.productSubscriptionDetails(subscriptionId));
        await this.clickAndWaitForLoadState(selector.customer.cSubscription.subscriptionDetails.actions.renewNow);
        await this.customerPage.paymentOrder('stripe');
    }

    // buy product subscription
    async buyProductSubscription(productName: string) {
        await this.customerPage.addProductToCart(productName, 'single-product');
        await this.customerPage.placeOrder('stripe');
    }
}
