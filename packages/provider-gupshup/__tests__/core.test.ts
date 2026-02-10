import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

import { GupshupCoreVendor } from '../src/gupshup/core'
import type { GupshupGlobalVendorArgs } from '../src/types'

// Mock the module first (hoisted)
jest.mock('../src/utils/processIncomingMsg')

// Then import - use require to get mocked version
const { processIncomingMessage } = jest.requireMock('../src/utils/processIncomingMsg') as {
    processIncomingMessage: any
}

describe('#GupshupCoreVendor', () => {
    let coreVendor: GupshupCoreVendor
    const mockArgs: GupshupGlobalVendorArgs = {
        name: 'test-bot',
        port: 3000,
        apiKey: 'test-api-key',
        srcName: 'test-app',
        phoneNumber: '1234567890',
    }

    beforeEach(() => {
        coreVendor = new GupshupCoreVendor(mockArgs)
        jest.clearAllMocks()
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('#incomingMsg', () => {
        test('should respond with "OK" for non-message events', async () => {
            // Arrange
            const mockReq = {
                body: { type: 'message-event' }, // Status event, not a message
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }

            // Act
            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            // Assert
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should process incoming message and emit "message" event', async () => {
            // Arrange
            const fakePayload = {
                type: 'message',
                payload: {
                    id: 'msg123',
                    source: '5491155551234',
                    type: 'text',
                    payload: { text: 'Hola' },
                    sender: { name: 'John' },
                },
            }
            const mockReq = { body: fakePayload }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const fakeBotContext = {
                from: '5491155551234',
                name: 'John',
                body: 'Hola',
            }
            processIncomingMessage.mockResolvedValue(fakeBotContext)
            const emitSpy = jest.spyOn(coreVendor, 'emit')

            // Act
            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            // Assert
            expect(emitSpy).toHaveBeenCalledWith('message', fakeBotContext)
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should not emit "message" if processIncomingMessage returns null', async () => {
            // Arrange
            const fakePayload = {
                type: 'message',
                payload: {
                    id: 'msg123',
                    source: '5491155551234',
                    type: 'unknown_type',
                    payload: {},
                    sender: { name: 'John' },
                },
            }
            const mockReq = { body: fakePayload }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            processIncomingMessage.mockResolvedValue(null)
            const emitSpy = jest.spyOn(coreVendor, 'emit')

            // Act
            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            // Assert
            expect(emitSpy).not.toHaveBeenCalled()
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should respond with 500 on error', async () => {
            // Arrange
            const mockReq = { body: { type: 'message' } }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            processIncomingMessage.mockRejectedValue(new Error('Test error'))
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            // Act
            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            // Assert
            expect(mockRes.statusCode).toBe(500)
            expect(mockRes.end).toHaveBeenCalledWith('Error')
            expect(consoleSpy).toHaveBeenCalled()

            consoleSpy.mockRestore()
        })
    })
})
