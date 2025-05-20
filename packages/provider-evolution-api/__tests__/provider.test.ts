import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import axios from 'axios'
import mime from 'mime-types'
import { utils } from '@builderbot/bot'
import { EvolutionProvider } from '../src/evolution/provider'
import { EvolutionGlobalVendorArgs } from '../src/types'

jest.mock('axios')

jest.mock('../src/utils', () => ({
    downloadFile: jest.fn(),
    getProfile: jest.fn(),
}))

jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
}))

jest.mock('@builderbot/bot')

describe('#EvolutionProvider', () => {
    let evolutionProvider: EvolutionProvider

    beforeEach(() => {
        evolutionProvider = new EvolutionProvider({
            name: 'bot',
            apiKey: 'your_api_key',
            baseURL: 'http://localhost:8080',
            instanceName: 'test-instance',
        })

        // Reset mocks between tests
        jest.clearAllMocks()
    })

    describe('#afterHttpServerInit', () => {
        test('should emit "ready" event when successfully initialized', async () => {
            // Arrange
            const mockResponse = {
                data: { state: 'open' },
            }

            ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue(mockResponse)

            const mockEmit = jest.fn()
            evolutionProvider.emit = mockEmit as any

            // Act
            await evolutionProvider['afterHttpServerInit']()

            // Assert
            expect(mockEmit).toHaveBeenCalledWith('ready')
        })

        test('should emit "notice" event when connection fails', async () => {
            // Arrange
            const error = new Error('Connection error')
            ;(axios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValue(error)

            const mockEmit = jest.fn()
            evolutionProvider.emit = mockEmit as any

            // Act
            await evolutionProvider['afterHttpServerInit']()

            // Assert
            expect(mockEmit).toHaveBeenCalledWith('notice', {
                title: '🟠 ERROR AUTH 🟠',
                instructions: [
                    'Error connecting to Evolution API, please check your credentials',
                    'Make sure your instance is connected',
                    'Details: Connection error',
                ],
            })
        })
    })

    describe('#sendText', () => {
        test('should call sendMessage with the provided parameters', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Hello, World!'

            const originalSendMessage = evolutionProvider.sendMessage
            // Use a different approach to mock the method
            evolutionProvider.sendMessage = jest.fn() as any
            ;(evolutionProvider.sendMessage as jest.Mock).mockImplementation(() => Promise.resolve({}))

            // Act
            await evolutionProvider.sendText(fakeRecipient, fakeMessage)

            // Assert
            expect(evolutionProvider.sendMessage).toHaveBeenCalledWith(fakeRecipient, fakeMessage)

            // Restore original method
            evolutionProvider.sendMessage = originalSendMessage
        })
    })

    describe('#sendMessage', () => {
        test('should send message to the provided recipient', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Hello, World!'
            const fakeResponse = { data: { success: true } }

            ;(axios.post as jest.MockedFunction<typeof axios.post>).mockResolvedValue(fakeResponse)

            // Act
            const result = await evolutionProvider.sendMessage(fakeRecipient, fakeMessage)

            // Assert
            expect(axios.post).toHaveBeenCalledWith(
                'http://localhost:8080/message/sendText/test-instance',
                {
                    number: fakeRecipient,
                    text: fakeMessage,
                },
                {
                    headers: {
                        apikey: 'your_api_key',
                    },
                }
            )
            expect(result).toEqual(fakeResponse)
        })
    })

    describe('#sendImage', () => {
        test('should send image to the provided recipient', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeImageUrl = 'https://example.com/image.jpg'
            const fakeCaption = 'This is a test image'
            const fakeResponse = { data: { success: true } }

            // Mock the current time to make the test deterministic
            const originalDateNow = Date.now
            Date.now = jest.fn(() => 1672531200000) // 2023-01-01

            // Mock mime lookup and extension
            jest.spyOn(mime, 'lookup').mockReturnValue('image/jpeg')
            jest.spyOn(mime, 'extension').mockReturnValue('jpeg')

            // Clear any previous calls to axios.post
            ;(axios.post as jest.MockedFunction<typeof axios.post>).mockClear()
            ;(axios.post as jest.MockedFunction<typeof axios.post>).mockResolvedValue(fakeResponse)

            // Act
            const result = await evolutionProvider.sendImage(fakeRecipient, fakeImageUrl, undefined, fakeCaption)

            // Assert
            expect(axios.post).toHaveBeenCalledWith(
                'http://localhost:8080/message/sendMedia/test-instance',
                {
                    number: fakeRecipient,
                    mediaType: 'image',
                    mimeType: 'image/jpeg',
                    caption: fakeCaption,
                    media: fakeImageUrl,
                    fileName: 'image-1672531200000.jpeg',
                },
                {
                    headers: {
                        apikey: 'your_api_key',
                    },
                }
            )
            expect(result).toEqual(fakeResponse)

            // Restore original Date.now
            Date.now = originalDateNow
        })
    })

    describe('#busEvents', () => {
        test('should return an array of event handlers', () => {
            // Cast to any to access protected property for testing
            const events = (evolutionProvider as any)['busEvents']()

            // Assert
            expect(events.length).toBe(4)
            expect(events[0].event).toBe('auth_failure')
            expect(events[1].event).toBe('notice')
            expect(events[2].event).toBe('ready')
            expect(events[3].event).toBe('message')
        })

        test('should emit events with correct payloads', () => {
            // Cast to any to access protected property for testing
            const events = (evolutionProvider as any)['busEvents']()
            const mockEmit = jest.fn()
            evolutionProvider.emit = mockEmit as any

            // Create payloads that match the implementation
            const authPayload = { error: 'Auth failed' } as any
            const noticePayload = { instructions: ['Test instruction'], title: 'Test Title' } as any
            const messagePayload = { from: '1234567890', body: 'Test message' } as any

            // Act
            events[0].func(authPayload)
            events[1].func(noticePayload)
            // @ts-ignore - Ready event doesn't need payload
            events[2].func()
            events[3].func(messagePayload)

            // Assert
            expect(mockEmit).toHaveBeenCalledWith('auth_failure', authPayload)
            expect(mockEmit).toHaveBeenCalledWith('notice', {
                instructions: noticePayload.instructions,
                title: noticePayload.title,
            })
            expect(mockEmit).toHaveBeenCalledWith('ready', true)
            expect(mockEmit).toHaveBeenCalledWith('message', messagePayload)
        })
    })
})
