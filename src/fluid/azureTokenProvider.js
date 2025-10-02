/**
 * Simple Azure Fluid Relay Token Provider
 * Generates tokens using the primary key for development/testing
 */
export class AzureTokenProvider {
    constructor(tenantId, primaryKey, userId) {
        this.tenantId = tenantId;
        this.primaryKey = primaryKey;
        this.userId = userId;
    }

    async fetchOrdererToken(tenantId, documentId) {
        return {
            jwt: this.primaryKey,
            fromCache: false,
        };
    }

    async fetchStorageToken(tenantId, documentId) {
        return {
            jwt: this.primaryKey,
            fromCache: false,
        };
    }
}