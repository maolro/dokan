//COVERAGE_TAG: GET /dokan/v1
//COVERAGE_TAG: GET /dokan/v1/admin
//COVERAGE_TAG: GET /dokan/v2

import { test, expect } from '@playwright/test';
import { ApiUtils } from '@utils/apiUtils';
import { endPoints } from '@utils/apiEndPoints';

test.describe('dokan api endpoints test', () => {
    let apiUtils: ApiUtils;

    test.beforeAll(async ({ request }) => {
        apiUtils = new ApiUtils(request);
    });

    test('get all dokan v1 endpoints @lite', async () => {
        const [response, responseBody] = await apiUtils.get(endPoints.getAllDokanEndpointsV1);
        expect(response.ok()).toBeTruthy();
        expect(responseBody).toBeTruthy();
    });

    test('get all dokan v2 endpoints @lite', async () => {
        const [response, responseBody] = await apiUtils.get(endPoints.getAllDokanEndpointsV2);
        expect(response.ok()).toBeTruthy();
        expect(responseBody).toBeTruthy();
    });

    test('get all dokan v1 admin endpoints @lite', async () => {
        const [response, responseBody] = await apiUtils.get(endPoints.getAllDokanEndpointsAdmin);
        expect(response.ok()).toBeTruthy();
        expect(responseBody).toBeTruthy();
    });
});
