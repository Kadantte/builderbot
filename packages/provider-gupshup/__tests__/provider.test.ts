import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import axios from 'axios'

import { GupshupProvider } from '../src/gupshup/provider'
import { GupshupGlobalVendorArgs } from '../src/types'

jest.mock('axios')

jest.mock('@builderbot/bot', () => ({
    ProviderClass: class {
        server: any = { use: jest.fn().mockReturnThis(), post: jest.fn().mockReturnThis() }
        emit = jest.fn()
    },
    utils: {
        generalDownload: jest.fn(),
    },
}))

describe('#GupshupProvider', () => {
    let provider: GupshupProvider
    const mockArgs: GupshupGlobalVendorArgs = {
        name: 'test-bot',
        port: 3000,
        apiKey: 'test-api-key',
        srcName: 'TestApp',
        phoneNumber: '1234567890',
    }

    beforeEach(() => {
        jest.clearAllMocks()
        provider = new GupshupProvider(mockArgs)
    })

    describe('#constructor', () => {
        test('should initialize with provided arguments', () => {
            // Assert
            expect(provider.globalVendorArgs.apiKey).toBe('test-api-key')
            expect(provider.globalVendorArgs.srcName).toBe('TestApp')
            expect(provider.globalVendorArgs.phoneNumber).toBe('1234567890')
        })

        test('should create axios instance with correct baseURL and headers', () => {
            // Assert - axios.create should have been called with config
            expect(axios.create).toHaveBeenCalledWith({
                baseURL: 'https://api.gupshup.io/wa/api/v1',
                headers: {
                    apikey: 'test-api-key',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            })
        })
    })

    describe('#initVendor', () => {
        test('should create and return GupshupCoreVendor instance', async () => {
            // Act
            const vendor = await provider['initVendor']()

            // Assert
            expect(vendor).toBeDefined()
            expect(provider.vendor).toBe(vendor)
        })
    })

    describe('#busEvents', () => {
        test('should return array with message and notice event handlers', () => {
            // Act
            const events = provider['busEvents']()

            // Assert
            expect(events).toHaveLength(2)
            expect(events[0].event).toBe('message')
            expect(events[1].event).toBe('notice')
        })
    })

    describe('#sendMessage', () => {
        test('should call sendText when no options provided', async () => {
            // Arrange
            const recipient = '5491155551234'
            const message = 'Hello!'
            const sendTextSpy = jest.spyOn(provider as any, 'sendText').mockResolvedValue({ status: 'sent' })

            // Act
            await provider.sendMessage(recipient, message)

            // Assert
            expect(sendTextSpy).toHaveBeenCalledWith(recipient, message)
        })

        test('should call sendButtons when options.buttons is provided', async () => {
            // Arrange
            const recipient = '5491155551234'
            const message = 'Choose:'
            const buttons = [{ body: 'Option 1' }, { body: 'Option 2' }]
            const sendButtonsSpy = jest
                .spyOn(provider as any, 'sendButtons')
                .mockResolvedValue({ error: 'Not implemented' })

            // Act
            await provider.sendMessage(recipient, message, { buttons })

            // Assert
            expect(sendButtonsSpy).toHaveBeenCalledWith(recipient, message, buttons)
        })

        test('should call sendMedia when options.media is provided', async () => {
            // Arrange
            const recipient = '5491155551234'
            const message = 'Check this image'
            const media = 'https://example.com/image.jpg'
            const sendMediaSpy = jest.spyOn(provider as any, 'sendMedia').mockResolvedValue({ status: 'sent' })

            // Act
            await provider.sendMessage(recipient, message, { media })

            // Assert
            expect(sendMediaSpy).toHaveBeenCalledWith(recipient, message, media)
        })
    })

    describe('#sendText', () => {
        test('should send text message with correct URLSearchParams payload', async () => {
            // Arrange
            const mockPost = jest.fn()
            ;(mockPost as any).mockResolvedValue({ data: { messageId: 'abc123' } })
            ;(provider as any).http = { post: mockPost }

            // Act
            await (provider as any).sendText('5491155551234', 'Hello World')

            // Assert
            expect(mockPost).toHaveBeenCalledWith('/msg', expect.any(URLSearchParams))

            // Verify the URLSearchParams content
            const calledParams = (mockPost as any).mock.calls[0][1] as URLSearchParams
            expect(calledParams.get('channel')).toBe('whatsapp')
            expect(calledParams.get('source')).toBe('1234567890')
            expect(calledParams.get('destination')).toBe('5491155551234')
            expect(calledParams.get('src.name')).toBe('TestApp')

            const messagePayload = JSON.parse(calledParams.get('message') || '{}')
            expect(messagePayload.type).toBe('text')
            expect(messagePayload.text).toBe('Hello World')
        })
    })

    describe('#sendMedia', () => {
        test('should send media message with correct payload', async () => {
            // Arrange
            const mockPost = jest.fn()
            ;(mockPost as any).mockResolvedValue({ data: { messageId: 'def456' } })
            ;(provider as any).http = { post: mockPost }

            // Act
            await (provider as any).sendMedia('5491155551234', 'My caption', 'https://example.com/image.jpg')

            // Assert
            expect(mockPost).toHaveBeenCalledWith('/msg', expect.any(URLSearchParams))

            const calledParams = (mockPost as any).mock.calls[0][1] as URLSearchParams
            const messagePayload = JSON.parse(calledParams.get('message') || '{}')
            expect(messagePayload.type).toBe('image')
            expect(messagePayload.originalUrl).toBe('https://example.com/image.jpg')
            expect(messagePayload.caption).toBe('My caption')
        })
    })

    describe('#sendButtons', () => {
        test('should return not implemented error', async () => {
            // Act
            const result = await (provider as any).sendButtons('5491155551234', 'Choose:', [])

            // Assert
            expect(result).toEqual({ error: 'Buttons not implemented yet for Gupshup' })
        })
    })

    describe('#saveFile', () => {
        test('should return NOT_IMPLEMENTED_YET', async () => {
            // Act
            const result = await provider.saveFile({})

            // Assert
            expect(result).toBe('NOT_IMPLEMENTED_YET')
        })
    })

    describe('#afterHttpServerInit', () => {
        test('should emit ready and notice events', async () => {
            // Arrange
            const emitSpy = jest.spyOn(provider, 'emit')

            // Act
            await provider['afterHttpServerInit']()

            // Assert
            expect(emitSpy).toHaveBeenCalledWith('ready')
            expect(emitSpy).toHaveBeenCalledWith(
                'notice',
                expect.objectContaining({
                    title: '🟢 Gupshup Provider Ready',
                })
            )
        })
    })
})
