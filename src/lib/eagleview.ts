import { logger } from './logger';

export interface EagleViewConfig {
    clientId: string;
    clientSecret: string;
    baseUrl: string;
    authUrl: string;
}

function getConfig(): EagleViewConfig {
    return {
        clientId: process.env.EAGLEVIEW_CLIENT_ID || '',
        clientSecret: process.env.EAGLEVIEW_CLIENT_SECRET || '',
        baseUrl: process.env.EAGLEVIEW_API_BASE_URL || 'https://sandbox.apis.eagleview.com',
        authUrl: process.env.EAGLEVIEW_AUTH_URL || 'https://apicenter.eagleview.com/oauth2/v1/token',
    };
}

let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

/**
 * Retrieves a Client Credentials access token from EagleView.
 * Caches the token in memory until it expires.
 */
export async function getEagleViewToken(): Promise<string> {
    const config = getConfig();
    if (!config.clientId || !config.clientSecret) {
        throw new Error('EAGLEVIEW_CLIENT_ID or EAGLEVIEW_CLIENT_SECRET is missing from environment variables.');
    }

    // Return cached token if still valid (with a 60s buffer)
    if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 60000) {
        return cachedToken;
    }

    logger.info('EagleView', 'Requesting new access token...');

    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    
    const response = await fetch(config.authUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        const errText = await response.text();
        logger.error('EagleView', 'Failed to retrieve access token', { status: response.status, response: errText });
        throw new Error(`Failed to retrieve EagleView access token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);

    logger.info('EagleView', 'Access token retrieved successfully');
    return cachedToken!;
}

/**
 * Helper to fetch property data. Initiates a POST request, then polls the GET result endpoint.
 * This simplifies the frontend's job by handling the polling server-side up to a timeout.
 */
export async function fetchEagleViewPropertyData(address: string, maxWaitMs = 60000): Promise<any> {
    const token = await getEagleViewToken();
    const config = getConfig();

    // 1. Submit Request
    logger.info('EagleView', 'Submitting property data request', { address });
    const postRes = await fetch(`${config.baseUrl}/property/v2/request`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            address: {
                completeAddress: address
            }
        })
    });

    if (!postRes.ok) {
        const errText = await postRes.text();
        logger.error('EagleView', 'POST request failed', { status: postRes.status, response: errText });
        // Return raw error object if it's JSON
        try { return JSON.parse(errText); } catch { throw new Error(`POST /property/v2/request failed: ${postRes.status} ${errText}`); }
    }

    const postData = await postRes.json();
    const requestId = postData.request?.id || postData.requestId;

    if (!requestId) {
        console.error("NO REQUEST ID, POST DATA WAS:", postData);
        throw new Error('No requestId returned from EagleView POST request. Response: ' + JSON.stringify(postData));
    }

    logger.info('EagleView', 'Request submitted, polling for results...', { requestId });

    // 2. Poll for Result
    const startTime = Date.now();
    let attempt = 0;

    while (Date.now() - startTime < maxWaitMs) {
        attempt++;
        // Wait 2 seconds between polls
        await new Promise(r => setTimeout(r, 2000));

        const getRes = await fetch(`${config.baseUrl}/property/v2/result/${requestId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });

        if (!getRes.ok) {
            // Some APIs return 404 or 202 while processing, handle those if needed
            if (getRes.status === 202 || getRes.status === 404) {
                continue; // Still processing
            }
            const errText = await getRes.text();
            logger.error('EagleView', 'GET result failed', { status: getRes.status, response: errText });
            throw new Error(`GET /property/v2/result failed: ${getRes.status} ${errText}`);
        }

        const getData = await getRes.json();
        
        // Check if status is complete. If 'status' field doesn't exist, assume we got the data.
        const status = getData.status ? getData.status.toLowerCase() : '';
        if (status === 'processing' || status === 'pending' || status === 'in progress') {
            continue;
        }

        logger.info('EagleView', 'Data retrieved successfully', { attempt, requestId });
        return {
            metadata: {
                requestId,
                pollingAttempts: attempt,
                durationMs: Date.now() - startTime
            },
            data: getData
        };
    }

    throw new Error(`Timed out waiting for EagleView data after ${maxWaitMs}ms (requestId: ${requestId})`);
}
