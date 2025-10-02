import jwt from 'jsonwebtoken';

/**
 * Azure Fluid Relay Token Provider
 * Generates JWT tokens using the primary key
 */
export class AzureTokenProvider {
    constructor(tenantId, primaryKey, userId) {
        this.tenantId = tenantId;
        this.primaryKey = primaryKey;
        this.userId = userId;
    }

    generateToken(tenantId, documentId, scopes) {
        const payload = {
            documentId: documentId,
            scopes: scopes,
            tenantId: tenantId,
            user: {
                id: this.userId,
                name: this.userId,
            },
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
            ver: '1.0',
        };

        return jwt.sign(payload, this.primaryKey, {
            algorithm: 'HS256',
        });
    }

    async fetchOrdererToken(tenantId, documentId) {
        const token = this.generateToken(tenantId, documentId, ['doc:read', 'doc:write', 'summary:write']);
        return {
            jwt: token,
            fromCache: false,
        };
    }

    async fetchStorageToken(tenantId, documentId) {
        const token = this.generateToken(tenantId, documentId, ['doc:read', 'doc:write']);
        return {
            jwt: token,
            fromCache: false,
        };
    }
}