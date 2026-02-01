import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

import { parseGHLNumber } from '../src/utils/number'
import { processIncomingMessage } from '../src/utils/processIncomingMsg'
import { TokenManager } from '../src/utils/tokenManager'
import { GHLIncomingWebhook } from '../src/types'

jest.mock('@builderbot/bot', () => ({
    utils: {
        generateRefProvider: jest.fn((type: string) => `__ref_provider_${type}__`),
    },
}))

describe('#parseGHLNumber', () => {
    test('should remove + symbol from number', () => {
        expect(parseGHLNumber('+1234567890')).toBe('1234567890')
    })

    test('should remove spaces from number', () => {
        expect(parseGHLNumber('1 234 567 890')).toBe('1234567890')
    })

    test('should remove dashes from number', () => {
        expect(parseGHLNumber('1-234-567-890')).toBe('1234567890')
    })

    test('should handle combined formatting', () => {
        expect(parseGHLNumber('+1 (234) 567-890')).toBe('1(234)567890')
    })

    test('should return non-string values as-is', () => {
        expect(parseGHLNumber(12345 as any)).toBe(12345)
    })
})

describe('#processIncomingMessage', () => {
    test('should return null for null input', () => {
        expect(processIncomingMessage(null as any)).toBeNull()
    })

    test('should return null for outbound messages', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'OutboundMessage',
            locationId: 'loc_123',
            direction: 'outbound',
        }
        expect(processIncomingMessage(webhook)).toBeNull()
    })

    test('should process inbound text message', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'InboundMessage',
            locationId: 'loc_123',
            direction: 'inbound',
            body: 'Hello World',
            phone: '+1234567890',
            contactId: 'contact_123',
            conversationId: 'conv_123',
            messageId: 'msg_123',
            dateAdded: '2025-01-01T00:00:00.000Z',
        }

        const result = processIncomingMessage(webhook)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('text')
        expect(result!.body).toBe('Hello World')
        expect(result!.from).toBe('1234567890')
        expect(result!.to).toBe('loc_123')
        expect(result!.contactId).toBe('contact_123')
        expect(result!.conversationId).toBe('conv_123')
        expect(result!.message_id).toBe('msg_123')
    })

    test('should process inbound message with image attachment', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'InboundMessage',
            locationId: 'loc_123',
            direction: 'inbound',
            body: '',
            phone: '+1234567890',
            contactId: 'contact_123',
            messageId: 'msg_456',
            attachments: [
                { url: 'https://example.com/image.jpg', type: 'image/jpeg' },
            ],
        }

        const result = processIncomingMessage(webhook)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('image')
        expect(result!.url).toBe('https://example.com/image.jpg')
        expect(result!.attachments).toHaveLength(1)
    })

    test('should process inbound message with video attachment', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'InboundMessage',
            locationId: 'loc_123',
            direction: 'inbound',
            body: '',
            phone: '+1234567890',
            contactId: 'contact_123',
            messageId: 'msg_789',
            attachments: [
                { url: 'https://example.com/video.mp4', type: 'video/mp4' },
            ],
        }

        const result = processIncomingMessage(webhook)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('video')
        expect(result!.url).toBe('https://example.com/video.mp4')
    })

    test('should process inbound message with audio attachment', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'InboundMessage',
            locationId: 'loc_123',
            direction: 'inbound',
            body: '',
            phone: '+1234567890',
            contactId: 'contact_123',
            messageId: 'msg_audio',
            attachments: [
                { url: 'https://example.com/audio.mp3', type: 'audio/mp3' },
            ],
        }

        const result = processIncomingMessage(webhook)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('audio')
    })

    test('should process inbound message with document attachment', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'InboundMessage',
            locationId: 'loc_123',
            direction: 'inbound',
            body: '',
            phone: '+1234567890',
            contactId: 'contact_123',
            messageId: 'msg_doc',
            attachments: [
                { url: 'https://example.com/file.pdf', type: 'application/pdf' },
            ],
        }

        const result = processIncomingMessage(webhook)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('document')
    })

    test('should use contactId as name fallback', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'InboundMessage',
            locationId: 'loc_123',
            direction: 'inbound',
            body: 'Hi',
            phone: '+1234567890',
            contactId: 'contact_ABC',
            messageId: 'msg_name',
        }

        const result = processIncomingMessage(webhook)

        expect(result!.name).toBe('contact_ABC')
        expect(result!.pushName).toBe('contact_ABC')
    })
})

describe('#TokenManager', () => {
    let tokenManager: TokenManager

    beforeEach(() => {
        tokenManager = new TokenManager('client_id', 'client_secret', 'http://localhost/callback')
    })

    afterEach(() => {
        tokenManager.destroy()
    })

    test('should initialize with empty tokens', () => {
        expect(tokenManager.getAccessToken()).toBe('')
        expect(tokenManager.getRefreshToken()).toBe('')
    })

    test('should set tokens correctly', () => {
        tokenManager.setTokens({
            access_token: 'test_token',
            refresh_token: 'test_refresh',
            expires_in: 86400,
        })

        expect(tokenManager.getAccessToken()).toBe('test_token')
        expect(tokenManager.getRefreshToken()).toBe('test_refresh')
    })

    test('should report token as not expired after setting', () => {
        tokenManager.setTokens({
            access_token: 'test_token',
            expires_in: 86400,
        })

        expect(tokenManager.isTokenExpired()).toBe(false)
    })

    test('should report token as expired when no token set', () => {
        expect(tokenManager.isTokenExpired()).toBe(true)
    })

    test('should return access token from getValidToken when not expired', async () => {
        tokenManager.setTokens({
            access_token: 'valid_token',
            expires_in: 86400,
        })

        const token = await tokenManager.getValidToken()
        expect(token).toBe('valid_token')
    })

    test('should throw error on refreshAccessToken when no refresh token', async () => {
        await expect(tokenManager.refreshAccessToken()).rejects.toThrow('No refresh token available')
    })

    test('destroy should clear refresh timer', () => {
        tokenManager.setTokens({
            access_token: 'test',
            expires_in: 86400,
        })

        tokenManager.destroy()
        // Should not throw
        tokenManager.destroy()
    })
})
