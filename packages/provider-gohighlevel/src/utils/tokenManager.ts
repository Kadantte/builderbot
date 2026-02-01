import axios from 'axios'
import EventEmitter from 'node:events'

import type { GHLOAuthTokens } from '~/types'

const GHL_AUTH_URL = 'https://services.leadconnectorhq.com/oauth/token'

export class TokenManager extends EventEmitter {
    private accessToken: string = ''
    private refreshToken: string = ''
    private clientId: string
    private clientSecret: string
    private redirectUri: string
    private expiresAt: number = 0
    private refreshTimer: ReturnType<typeof setTimeout> | null = null

    constructor(clientId: string, clientSecret: string, redirectUri: string = '') {
        super()
        this.clientId = clientId
        this.clientSecret = clientSecret
        this.redirectUri = redirectUri
    }

    getAccessToken(): string {
        return this.accessToken
    }

    getRefreshToken(): string {
        return this.refreshToken
    }

    isTokenExpired(): boolean {
        return Date.now() >= this.expiresAt
    }

    setTokens(tokens: Partial<GHLOAuthTokens>): void {
        if (tokens.access_token) this.accessToken = tokens.access_token
        if (tokens.refresh_token) this.refreshToken = tokens.refresh_token
        if (tokens.expires_in) {
            this.expiresAt = Date.now() + tokens.expires_in * 1000
            this.scheduleRefresh(tokens.expires_in)
        }
    }

    async exchangeAuthorizationCode(code: string): Promise<GHLOAuthTokens> {
        const response = await axios.post(
            GHL_AUTH_URL,
            new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.redirectUri,
            }).toString(),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }
        )
        const tokens: GHLOAuthTokens = response.data
        this.setTokens(tokens)
        this.emit('tokens_updated', tokens)
        return tokens
    }

    async refreshAccessToken(): Promise<GHLOAuthTokens> {
        if (!this.refreshToken) {
            throw new Error('No refresh token available')
        }
        try {
            const response = await axios.post(
                GHL_AUTH_URL,
                new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: this.refreshToken,
                }).toString(),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                }
            )
            const tokens: GHLOAuthTokens = response.data
            this.setTokens(tokens)
            this.emit('tokens_updated', tokens)
            return tokens
        } catch (error) {
            this.emit('token_error', error)
            throw error
        }
    }

    async getValidToken(): Promise<string> {
        if (this.isTokenExpired() && this.refreshToken) {
            await this.refreshAccessToken()
        }
        return this.accessToken
    }

    private scheduleRefresh(expiresIn: number): void {
        if (this.refreshTimer) clearTimeout(this.refreshTimer)
        // Refresh 5 minutes before expiry
        const refreshIn = Math.max((expiresIn - 300) * 1000, 60000)
        this.refreshTimer = setTimeout(async () => {
            try {
                await this.refreshAccessToken()
            } catch (error) {
                this.emit('token_error', error)
            }
        }, refreshIn)
    }

    destroy(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer)
            this.refreshTimer = null
        }
    }
}
