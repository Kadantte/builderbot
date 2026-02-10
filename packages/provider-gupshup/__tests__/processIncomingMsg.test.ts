import { describe, expect, jest, test, beforeEach } from '@jest/globals'

import { GupshupGlobalVendorArgs, GupshupIncomingMessage } from '../src/types'
import { processIncomingMessage } from '../src/utils/processIncomingMsg'

jest.mock('@builderbot/bot', () => ({
    utils: {
        generateRefProvider: jest.fn((type: string) => `__${type}__`),
    },
}))

describe('#processIncomingMessage', () => {
    const mockArgs: GupshupGlobalVendorArgs = {
        name: 'test-bot',
        port: 3000,
        apiKey: 'test-api-key',
        srcName: 'test-app',
        phoneNumber: '1234567890',
    }

    const createMockMessage = (
        type: 'text' | 'image' | 'audio' | 'document' | 'location' | 'file' | 'video' | 'contact',
        payloadContent: any,
        senderName: string = 'John Doe',
        source: string = '5491155551234'
    ): GupshupIncomingMessage => ({
        app: 'test-app',
        timestamp: Date.now(),
        type: 'message',
        payload: {
            id: `msg_${Date.now()}`,
            source,
            type,
            payload: payloadContent,
            sender: {
                name: senderName,
                phone: source,
                country_code: '54',
                dial_code: '911',
            },
            timestamp: new Date().toISOString(),
        },
    })

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('should process text message correctly', async () => {
        // Arrange
        const rawMessage = createMockMessage('text', { text: 'Hola mundo' })

        // Act
        const result = await processIncomingMessage(rawMessage, mockArgs)

        // Assert
        expect(result).toEqual({
            from: '5491155551234',
            name: 'John Doe',
            body: 'Hola mundo',
            url: '',
            host: { phone: '1234567890' },
        })
    })

    test('should process image message correctly', async () => {
        // Arrange
        const rawMessage = createMockMessage('image', { url: 'https://example.com/image.jpg' }, 'Jane', '5491155559999')

        // Act
        const result = await processIncomingMessage(rawMessage, mockArgs)

        // Assert
        expect(result.from).toBe('5491155559999')
        expect(result.url).toBe('https://example.com/image.jpg')
        expect(result.body).toContain('_event_media_')
    })

    test('should process audio message correctly', async () => {
        // Arrange
        const rawMessage = createMockMessage(
            'audio',
            { url: 'https://example.com/audio.ogg' },
            'Carlos',
            '5491155558888'
        )

        // Act
        const result = await processIncomingMessage(rawMessage, mockArgs)

        // Assert
        expect(result.from).toBe('5491155558888')
        expect(result.url).toBe('https://example.com/audio.ogg')
        expect(result.body).toContain('_event_voice_note_')
    })

    test('should process document message correctly', async () => {
        // Arrange
        const rawMessage = createMockMessage(
            'document',
            { url: 'https://example.com/doc.pdf' },
            'Maria',
            '5491155557777'
        )

        // Act
        const result = await processIncomingMessage(rawMessage, mockArgs)

        // Assert
        expect(result.from).toBe('5491155557777')
        expect(result.url).toBe('https://example.com/doc.pdf')
        expect(result.body).toContain('_event_document_')
    })

    test('should process location message correctly', async () => {
        // Arrange
        const rawMessage = createMockMessage(
            'location',
            { latitude: '-34.6037', longitude: '-58.3816' },
            'Pedro',
            '5491155556666'
        )

        // Act
        const result = await processIncomingMessage(rawMessage, mockArgs)

        // Assert
        expect(result.from).toBe('5491155556666')
        expect(result.body).toContain('_event_location_')
    })

    test('should return null for unknown message type', async () => {
        // Arrange
        const rawMessage = createMockMessage('contact', {}, 'Unknown', '5491155555555')
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

        // Act
        const result = await processIncomingMessage(rawMessage, mockArgs)

        // Assert
        expect(result).toBeNull()
        expect(consoleSpy).toHaveBeenCalledWith('[Gupshup] Unhandled message type: contact')

        consoleSpy.mockRestore()
    })

    test('should use phone as fallback name if sender name is missing', async () => {
        // Arrange
        const rawMessage: GupshupIncomingMessage = {
            app: 'test-app',
            timestamp: Date.now(),
            type: 'message',
            payload: {
                id: 'msg404',
                source: '5491155554444',
                type: 'text',
                payload: { text: 'Sin nombre' },
                sender: {
                    phone: '5491155554444',
                    name: '', // Empty name
                    country_code: '54',
                    dial_code: '911',
                },
                timestamp: new Date().toISOString(),
            },
        }

        // Act
        const result = await processIncomingMessage(rawMessage, mockArgs)

        // Assert
        expect(result.name).toBe('5491155554444')
    })
})
