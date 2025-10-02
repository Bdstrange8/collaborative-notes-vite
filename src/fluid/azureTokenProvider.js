import * as jose from 'jose';

/**
 * Azure Fluid Relay Token Provider
 * Generates JWT tokens using the primary key (browser-compatible)
 */
export class AzureTokenProvider {
    constructor(tenantId, primaryKey, userId) {
        this.tenantId = tenantId;
        this.primaryKey = primaryKey;
        this.userId = userId;
    }

    async generateToken(tenantId, documentId, scopes) {
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

        // Convert the primary key to a Uint8Array for jose
        const secret = new TextEncoder().encode(this.primaryKey);
        
        // Sign the JWT using jose
        const token = await new jose.SignJWT(payload)
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(secret);

        return token;
    }

    async fetchOrdererToken(tenantId, documentId) {
        const token = await this.generateToken(tenantId, documentId, ['doc:read', 'doc:write', 'summary:write']);
        return {
            jwt: token,
            fromCache: false,
        };
    }

    async fetchStorageToken(tenantId, documentId) {
        const token = await this.generateToken(tenantId, documentId, ['doc:read', 'doc:write', 'summary:write']);
        return {
            jwt: token,
            fromCache: false,
        };
    }
}