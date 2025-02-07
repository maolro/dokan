//COVERAGE_TAG: GET /dokan/v1/store-categories/default-category
//COVERAGE_TAG: PUT /dokan/v1/store-categories/default-category
//COVERAGE_TAG: GET /dokan/v1/store-categories
//COVERAGE_TAG: GET /dokan/v1/store-categories/(?P<id>[\d]+)
//COVERAGE_TAG: POST /dokan/v1/store-categories
//COVERAGE_TAG: PUT /dokan/v1/store-categories/(?P<id>[\d]+)
//COVERAGE_TAG: DELETE /dokan/v1/store-categories/(?P<id>[\d]+)

import { test, expect } from '@playwright/test';
import { ApiUtils } from '@utils/apiUtils';
import { endPoints } from '@utils/apiEndPoints';
import { payloads } from '@utils/payloads';

test.describe('store categories api test', () => {
    let apiUtils: ApiUtils;
    let categoryId: string;

    test.beforeAll(async ({ request }) => {
        apiUtils = new ApiUtils(request);
        [, categoryId] = await apiUtils.createStoreCategory(payloads.createStoreCategory());
    });

    test('get default store category @pro', async () => {
        const [response, responseBody] = await apiUtils.get(endPoints.getDefaultStoreCategory);
        expect(response.ok()).toBeTruthy();
        expect(responseBody).toBeTruthy();
    });

    test('set default store category @pro', async () => {
        const [response, responseBody] = await apiUtils.put(endPoints.setDefaultStoreCategory, { data: { id: categoryId } });
        expect(response.ok()).toBeTruthy();
        expect(responseBody).toBeTruthy();

        // restore default store category
        await apiUtils.setDefaultStoreCategory('Uncategorized', payloads.adminAuth);
    });

    test('get all store categories @pro', async () => {
        const [response, responseBody] = await apiUtils.get(endPoints.getAllStoreCategories);
        expect(response.ok()).toBeTruthy();
        expect(responseBody).toBeTruthy();
    });

    test('get single store category @pro', async () => {
        const [response, responseBody] = await apiUtils.get(endPoints.getSingleStoreCategory(categoryId));
        expect(response.ok()).toBeTruthy();
        expect(responseBody).toBeTruthy();
    });

    test('create a store category @pro', async () => {
        const [response, responseBody] = await apiUtils.post(endPoints.createStoreCategory, { data: payloads.createStoreCategory() });
        expect(response.status()).toBe(201);
        expect(response.ok()).toBeTruthy();
        expect(responseBody).toBeTruthy();
    });

    test('update a store category @pro', async () => {
        const [response, responseBody] = await apiUtils.put(endPoints.updateStoreCategory(categoryId), { data: payloads.updateStoreCategory() });
        expect(response.ok()).toBeTruthy();
        expect(responseBody).toBeTruthy();
    });

    test('delete a store category @pro', async () => {
        const [response, responseBody] = await apiUtils.delete(endPoints.deleteStoreCategory(categoryId), { params: payloads.paramsDeleteStoreCategory });
        expect(response.ok()).toBeTruthy();
        expect(responseBody).toBeTruthy();
    });
});
