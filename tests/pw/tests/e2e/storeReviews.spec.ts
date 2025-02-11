import { test, Page } from '@playwright/test';
import { StoreReviewsPage } from '@pages/storeReviewsPage';
import { ApiUtils } from '@utils/apiUtils';
import { data } from '@utils/testData';
import { payloads } from '@utils/payloads';

const { VENDOR_ID } = global as any;

test.describe('Store Reviews test', () => {
    let admin: StoreReviewsPage;
    let vendor: StoreReviewsPage;
    let customer: StoreReviewsPage;
    let aPage: Page, vPage: Page, cPage: Page;
    let apiUtils: ApiUtils;

    test.beforeAll(async ({ browser, request }) => {
        const adminContext = await browser.newContext(data.auth.adminAuth);
        aPage = await adminContext.newPage();
        admin = new StoreReviewsPage(aPage);

        const vendorContext = await browser.newContext(data.auth.vendorAuth);
        vPage = await vendorContext.newPage();
        vendor = new StoreReviewsPage(vPage);

        const customerContext = await browser.newContext(data.auth.customerAuth);
        cPage = await customerContext.newPage();
        customer = new StoreReviewsPage(cPage);

        apiUtils = new ApiUtils(request);

        await apiUtils.updateBatchStoreReviews('trash', [], payloads.adminAuth);
        await apiUtils.createStoreReview(VENDOR_ID, payloads.createStoreReview, payloads.customerAuth);
        const [, reviewId] = await apiUtils.createStoreReview(VENDOR_ID, { ...payloads.createStoreReview, title: 'trashed test review' }, payloads.customerAuth);
        await apiUtils.deleteStoreReview(reviewId, payloads.adminAuth);
    });

    test.afterAll(async () => {
        await aPage.close();
        await vPage.close();
        await cPage.close();
    });

    test('dokan store reviews menu page is rendering properly @pro @explo', async () => {
        await admin.adminStoreReviewsRenderProperly();
    });

    test('admin can view store review @pro @explo', async () => {
        await admin.viewStoreReview();
    });

    test('admin can edit store review @pro', async () => {
        await admin.editStoreReview(data.storeReview.review());
    });

    test('admin can filter store reviews by vendor @pro', async () => {
        await admin.filterStoreReviews(data.storeReview.filter.byVendor);
    });

    test('admin can delete store review @pro', async () => {
        await admin.deleteStoreReview();
    });

    test('admin can restore deleted store review @pro', async () => {
        await admin.restoreStoreReview();
    });

    test('admin can permanently delete store review @pro', async () => {
        await admin.permanentlyDeleteStoreReview();
    });

    test('admin can perform store reviews bulk action @pro', async () => {
        await apiUtils.createStoreReview(VENDOR_ID, payloads.createStoreReview, payloads.customerAuth);
        await admin.storeReviewsBulkAction('trash');
    });

    test('customer can review store @pro', async () => {
        // remove any previous reviews
        await apiUtils.updateBatchStoreReviews('trash', [], payloads.adminAuth);
        await customer.reviewStore(data.predefined.vendorStores.vendor1, data.storeReview.review(), 'create');
    });

    test('customer can edit store review @pro', async () => {
        await customer.reviewStore(data.predefined.vendorStores.vendor1, data.storeReview.review(), 'edit');
    });

    test('customer can view own review @pro', async () => {
        await apiUtils.updateBatchStoreReviews('trash', [], payloads.adminAuth);
        await apiUtils.createStoreReview(VENDOR_ID, payloads.createStoreReview, payloads.customerAuth);
        await customer.viewOwnReview(data.predefined.vendorStores.vendor1);
    });

    test("vendor can't review own store @pro", async () => {
        await vendor.cantReviewOwnStore(data.predefined.vendorStores.vendor1);
    });
});
