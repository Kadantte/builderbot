import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import Queue from 'queue-promise'

import { GoHighLevelCoreVendor } from '../src/gohighlevel/core'
import { TokenManager } from '../src/utils/tokenManager'
import { GHLMessage } from '../src/types'

jest.mock('../src/utils/processIncomingMsg', () => ({
    processIncomingMessage: jest.fn(),
}))

describe('#GoHighLevelCoreVendor', () => {
    let coreVendor: GoHighLevelCoreVendor
    let tokenManager: TokenManager
    let mockNext: any

    beforeEach(() => {
        const queue = new Queue({ concurrent: 1, interval: 100, start: true })
        tokenManager = new TokenManager('client_id', 'client_secret', 'http://localhost/callback')
        coreVendor = new GoHighLevelCoreVendor(queue, tokenManager)
        mockNext = jest.fn()
    })

    afterEach(() => {
        jest.clearAllMocks()
        tokenManager.destroy()
    })

    describe('#indexHome', () => {
        test('should respond with "running ok"', () => {
            const mockResponse = { end: jest.fn() }

            coreVendor.indexHome(null as any, mockResponse as any, mockNext)

            expect(mockResponse.end).toHaveBeenCalledWith('running ok')
        })
    })

    describe('#oauthCallback', () => {
        test('should return 400 if no code provided', async () => {
            const req = { query: {} }
            const res = { statusCode: 0, end: jest.fn() }

            await coreVendor.oauthCallback(req as any, res as any, mockNext)

            expect(res.statusCode).toBe(400)
            expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Missing authorization code' }))
        })

        test('should return 500 if token exchange fails', async () => {
            const req = { query: { code: 'test_code' } }
            const res = { statusCode: 0, end: jest.fn() }

            jest.spyOn(tokenManager, 'exchangeAuthorizationCode').mockRejectedValue(
                new Error('Exchange failed')
            )

            await coreVendor.oauthCallback(req as any, res as any, mockNext)

            expect(res.statusCode).toBe(500)
            expect(res.end).toHaveBeenCalledWith(
                JSON.stringify({ error: 'Failed to exchange authorization code' })
            )
        })

        test('should return 200 on successful token exchange', async () => {
            const req = { query: { code: 'valid_code' } }
            const res = { statusCode: 0, end: jest.fn() }

            jest.spyOn(tokenManager, 'exchangeAuthorizationCode').mockResolvedValue({
                access_token: 'token',
                refresh_token: 'refresh',
                token_type: 'Bearer',
                expires_in: 86400,
                scope: 'all',
                locationId: 'loc_123',
            })

            await coreVendor.oauthCallback(req as any, res as any, mockNext)

            expect(res.statusCode).toBe(200)
            expect(res.end).toHaveBeenCalledWith(
                JSON.stringify({ message: 'Authorization successful', locationId: 'loc_123' })
            )
        })
    })

    describe('#incomingMsg', () => {
        test('should return 400 for invalid webhook payload', async () => {
            const req = { body: null }
            const res = { statusCode: 0, end: jest.fn() }

            await coreVendor.incomingMsg(req as any, res as any, mockNext)

            expect(res.statusCode).toBe(400)
            expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Invalid webhook payload' }))
        })

        test('should return 400 when payload has no type', async () => {
            const req = { body: { locationId: 'loc_123' } }
            const res = { statusCode: 0, end: jest.fn() }

            await coreVendor.incomingMsg(req as any, res as any, mockNext)

            expect(res.statusCode).toBe(400)
        })

        test('should return 200 when message is processed', async () => {
            const req = {
                body: {
                    type: 'InboundMessage',
                    locationId: 'loc_123',
                    direction: 'inbound',
                    body: 'Hello',
                    phone: '+1234567890',
                    messageId: 'msg_123',
                },
            }
            const res = { statusCode: 0, end: jest.fn() }

            const { processIncomingMessage } = require('../src/utils/processIncomingMsg')
            ;(processIncomingMessage as jest.Mock).mockReturnValue({
                type: 'text',
                from: '1234567890',
                to: 'loc_123',
                body: 'Hello',
                name: 'Unknown',
                pushName: 'Unknown',
            })

            await coreVendor.incomingMsg(req as any, res as any, mockNext)

            expect(res.statusCode).toBe(200)
            expect(res.end).toHaveBeenCalledWith(JSON.stringify({ success: true }))
        })

        test('should return 200 when processIncomingMessage returns null', async () => {
            const req = {
                body: {
                    type: 'OutboundMessage',
                    locationId: 'loc_123',
                    direction: 'outbound',
                },
            }
            const res = { statusCode: 0, end: jest.fn() }

            const { processIncomingMessage } = require('../src/utils/processIncomingMsg')
            ;(processIncomingMessage as jest.Mock).mockReturnValue(null)

            await coreVendor.incomingMsg(req as any, res as any, mockNext)

            expect(res.statusCode).toBe(200)
            expect(res.end).toHaveBeenCalledWith(JSON.stringify({ success: true }))
        })
    })

    describe('#processMessage', () => {
        test('should emit a "message" event and resolve', async () => {
            const mockMessage: GHLMessage = {
                type: 'text',
                from: '1234567890',
                to: 'loc_123',
                body: 'Hello',
                name: 'Test',
                pushName: 'Test',
            }
            const mockEmit = jest.fn()
            coreVendor.emit = mockEmit as any

            await coreVendor.processMessage(mockMessage)

            expect(mockEmit).toHaveBeenCalledWith('message', mockMessage)
        })

        test('should reject if emit throws', async () => {
            const mockMessage: GHLMessage = {
                type: 'text',
                from: '1234567890',
                to: 'loc_123',
                body: 'Hello',
                name: 'Test',
                pushName: 'Test',
            }
            const mockEmitError = jest.fn(() => {
                throw new Error('Emit error')
            })
            coreVendor.emit = mockEmitError as any

            await expect(coreVendor.processMessage(mockMessage)).rejects.toThrow('Emit error')
        })
    })
})
