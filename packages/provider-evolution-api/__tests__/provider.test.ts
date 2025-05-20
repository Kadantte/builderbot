import axios from 'axios'
import fs from 'fs'
import { writeFile } from 'fs/promises'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import mime from 'mime-types'
import path from 'path'
import Queue from 'queue-promise'
import { EvolutionProvider } from '../src/evolution/provider'
import * as utils from '../src/utils'
import type { BotContext } from '@builderbot/bot/dist/types'

jest.mock('fs')
jest.mock('fs/promises')
jest.mock('axios')
jest.mock('mime-types')

// Define proper types for our mocks
interface MockedServer {
    use: jest.Mock
    post: jest.Mock
}

interface MockedVendor {
    indexHome: jest.Mock
    incomingMsg: jest.Mock
}

// Define types for event handler payloads
interface NoticePayload {
    instructions: string[]
    title: string
    [key: string]: any
}

describe('EvolutionProvider', () => {
    let evolutionProvider: EvolutionProvider
    const defaultConfig = {
        name: 'bot',
        apiKey: 'test-api-key',
        baseURL: 'http://localhost:8080',
        instanceName: 'test-instance',
        port: 3000,
    }

    beforeEach(() => {
        jest.clearAllMocks()
        evolutionProvider = new EvolutionProvider(defaultConfig)
    })

    describe('constructor', () => {
        test('should initialize with default config and override with provided values', () => {
            expect(evolutionProvider.globalVendorArgs).toEqual(defaultConfig)
            expect(evolutionProvider.queue).toBeInstanceOf(Queue)
        })
    })

    describe('initVendor', () => {
        test('should initialize vendor core', async () => {
            const result = await evolutionProvider['initVendor']()
            expect(result).toBeDefined()
            expect(evolutionProvider.vendor).toBeDefined()
        })
    })

    describe('beforeHttpServerInit', () => {
        test('should set up server middleware', () => {
            // Create properly typed mock server
            const mockServer: MockedServer = {
                use: jest.fn().mockReturnThis(),
                post: jest.fn().mockReturnThis(),
            }

            // Create properly typed mock vendor
            const mockVendor: MockedVendor = {
                indexHome: jest.fn(),
                incomingMsg: jest.fn(),
            }

            // Set mocks on provider
            evolutionProvider.server = mockServer as any
            evolutionProvider.vendor = mockVendor as any

            evolutionProvider['beforeHttpServerInit']()

            expect(mockServer.use).toHaveBeenCalledTimes(2)
            expect(mockServer.post).toHaveBeenCalledTimes(2)
            expect(mockServer.post).toHaveBeenCalledWith('/', mockVendor.indexHome)
            expect(mockServer.post).toHaveBeenCalledWith('/webhook', mockVendor.incomingMsg)
        })
    })

    describe('afterHttpServerInit', () => {
        test('should emit ready event when instance state is open', async () => {
            const emitSpy = jest.spyOn(evolutionProvider, 'emit')

            // Mock axios response for open state
            jest.spyOn(axios, 'get').mockResolvedValueOnce({
                data: { state: 'open' },
            })

            await evolutionProvider['afterHttpServerInit']()

            expect(axios.get).toHaveBeenCalledWith('http://localhost:8080/instance/connectionState/test-instance', {
                headers: { apikey: 'test-api-key' },
            })
            expect(emitSpy).toHaveBeenCalledWith('ready')
        })

        test('should emit notice event when instance state is not open', async () => {
            const emitSpy = jest.spyOn(evolutionProvider, 'emit')

            // Mock axios response for closed state
            jest.spyOn(axios, 'get').mockResolvedValueOnce({
                data: { state: 'closed' },
            })

            await evolutionProvider['afterHttpServerInit']()

            expect(emitSpy).toHaveBeenCalledWith(
                'notice',
                expect.objectContaining({
                    title: expect.stringContaining('ERROR AUTH'),
                    instructions: expect.arrayContaining([expect.any(String)]),
                })
            )
        })

        test('should emit notice event when connection fails', async () => {
            const emitSpy = jest.spyOn(evolutionProvider, 'emit')

            // Mock axios error
            jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('Connection failed'))

            await evolutionProvider['afterHttpServerInit']()

            expect(emitSpy).toHaveBeenCalledWith(
                'notice',
                expect.objectContaining({
                    title: expect.stringContaining('ERROR AUTH'),
                    instructions: expect.arrayContaining([expect.stringContaining('Error connecting')]),
                })
            )
        })
    })

    describe('busEvents', () => {
        test('should return array of event handlers', () => {
            const events = evolutionProvider['busEvents']()

            expect(events).toBeInstanceOf(Array)
            expect(events).toHaveLength(4)
            expect(events.map((e) => e.event)).toEqual(['auth_failure', 'notice', 'ready', 'message'])
        })

        test('each event handler should call emit with correct parameters', () => {
            const emitSpy = jest.spyOn(evolutionProvider, 'emit')
            const events = evolutionProvider['busEvents']()

            // Create full payload objects that satisfy the expected types
            const authPayload = {
                type: 'auth_failure',
                from: 'test',
                body: 'auth failure message',
                instructions: ['Instruction 1'],
                title: 'Auth Failure',
            }

            const noticePayload: NoticePayload = {
                instructions: ['test instruction'],
                title: 'test title',
                from: 'system',
                body: 'notice message',
            }

            const readyPayload = {
                type: 'ready',
                from: 'system',
                body: 'system ready',
                instructions: [],
                title: 'Ready',
            }

            const messagePayload = {
                from: 'test',
                body: 'test message',
                instructions: [],
                title: 'test message',
            } as BotContext

            // Test each event handler
            events.find((e) => e.event === 'auth_failure')?.func(authPayload)
            expect(emitSpy).toHaveBeenCalledWith('auth_failure', authPayload)

            events.find((e) => e.event === 'notice')?.func(noticePayload)
            expect(emitSpy).toHaveBeenCalledWith('notice', noticePayload)

            events.find((e) => e.event === 'ready')?.func(readyPayload)
            expect(emitSpy).toHaveBeenCalledWith('ready', true)

            events.find((e) => e.event === 'message')?.func(messagePayload)
            expect(emitSpy).toHaveBeenCalledWith('message', messagePayload)
        })
    })

    describe('sendMedia', () => {
        test('should call sendImage for image files', async () => {
            // Mock generalDownload
            jest.spyOn(utils, 'generalDownload').mockResolvedValueOnce('/tmp/test.jpg')

            // Mock mime.lookup
            jest.spyOn(mime, 'lookup').mockReturnValueOnce('image/jpeg')

            // Mock sendImage
            const sendImageMock = jest.spyOn(evolutionProvider, 'sendImage').mockResolvedValueOnce({ success: true })

            const result = await evolutionProvider.sendMedia(
                '1234567890',
                'https://example.com/image.jpg',
                'Test caption'
            )

            expect(utils.generalDownload).toHaveBeenCalledWith('https://example.com/image.jpg')
            expect(mime.lookup).toHaveBeenCalledWith('/tmp/test.jpg')
            expect(sendImageMock).toHaveBeenCalledWith('1234567890', '/tmp/test.jpg', 'Test caption')
            expect(result).toEqual({ success: true })
        })

        test('should call sendVideo for video files', async () => {
            jest.spyOn(utils, 'generalDownload').mockResolvedValueOnce('/tmp/test.mp4')
            jest.spyOn(mime, 'lookup').mockReturnValueOnce('video/mp4')

            const sendVideoMock = jest.spyOn(evolutionProvider, 'sendVideo').mockResolvedValueOnce({ success: true })

            const result = await evolutionProvider.sendMedia(
                '1234567890',
                'https://example.com/video.mp4',
                'Test video'
            )

            expect(sendVideoMock).toHaveBeenCalledWith('1234567890', '/tmp/test.mp4', 'Test video')
            expect(result).toEqual({ success: true })
        })

        test('should call sendAudio for audio files', async () => {
            jest.spyOn(utils, 'generalDownload').mockResolvedValueOnce('/tmp/test.mp3')
            jest.spyOn(mime, 'lookup').mockReturnValueOnce('audio/mpeg')

            const sendAudioMock = jest.spyOn(evolutionProvider, 'sendAudio').mockResolvedValueOnce({ success: true })

            const result = await evolutionProvider.sendMedia('1234567890', 'https://example.com/audio.mp3', '')

            expect(sendAudioMock).toHaveBeenCalledWith('1234567890', '/tmp/test.mp3')
            expect(result).toEqual({ success: true })
        })

        test('should call sendFile for other file types', async () => {
            jest.spyOn(utils, 'generalDownload').mockResolvedValueOnce('/tmp/test.pdf')
            jest.spyOn(mime, 'lookup').mockReturnValueOnce('application/pdf')

            const sendFileMock = jest.spyOn(evolutionProvider, 'sendFile').mockResolvedValueOnce({ success: true })

            const result = await evolutionProvider.sendMedia(
                '1234567890',
                'https://example.com/document.pdf',
                'Test document'
            )

            expect(sendFileMock).toHaveBeenCalledWith('1234567890', '/tmp/test.pdf', 'Test document')
            expect(result).toEqual({ success: true })
        })

        test('should throw error if mime type cannot be determined', async () => {
            jest.spyOn(utils, 'generalDownload').mockResolvedValueOnce('/tmp/unknown')
            jest.spyOn(mime, 'lookup').mockReturnValueOnce(false)

            await expect(evolutionProvider.sendMedia('1234567890', 'https://example.com/unknown', '')).rejects.toThrow(
                'No se pudo determinar el tipo MIME'
            )
        })
    })

    describe('sendImage', () => {
        test('should read file and send to API correctly', async () => {
            // Mock fs.readFileSync
            jest.mocked(fs.readFileSync).mockReturnValueOnce('base64content')

            // Mock mime.lookup
            jest.mocked(mime.lookup).mockReturnValueOnce('image/jpeg')

            // Create a type-safe mock implementation
            const originalMethod = evolutionProvider.sendMessageEvoApi
            evolutionProvider.sendMessageEvoApi = jest.fn() as any
            ;(evolutionProvider.sendMessageEvoApi as jest.Mock).mockResolvedValue({ success: true })

            const result = await evolutionProvider.sendImage('1234567890', '/tmp/test.jpg', 'Test caption')

            expect(fs.readFileSync).toHaveBeenCalledWith('/tmp/test.jpg', { encoding: 'base64' })
            expect(mime.lookup).toHaveBeenCalledWith('/tmp/test.jpg')
            expect(evolutionProvider.sendMessageEvoApi).toHaveBeenCalledWith(
                {
                    number: '1234567890',
                    media: 'base64content',
                    mimetype: 'image/jpeg',
                    mediatype: 'image',
                    caption: 'Test caption',
                    delay: 0,
                },
                '/message/sendMedia/'
            )
            expect(result).toEqual({ success: true })

            // Restore original method
            evolutionProvider.sendMessageEvoApi = originalMethod
        })

        test('should use filename as caption if none provided', async () => {
            jest.mocked(fs.readFileSync).mockReturnValueOnce('base64content')
            jest.mocked(mime.lookup).mockReturnValueOnce('image/jpeg')

            // Create a type-safe mock implementation
            const originalMethod = evolutionProvider.sendMessageEvoApi
            evolutionProvider.sendMessageEvoApi = jest.fn() as any
            ;(evolutionProvider.sendMessageEvoApi as jest.Mock).mockResolvedValue({ success: true })

            await evolutionProvider.sendImage('1234567890', '/tmp/test.jpg', '')

            expect(evolutionProvider.sendMessageEvoApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    caption: 'test.jpg',
                }),
                '/message/sendMedia/'
            )

            // Restore original method
            evolutionProvider.sendMessageEvoApi = originalMethod
        })
    })

    describe('sendText', () => {
        test('should call sendMessageToApi with correct parameters', async () => {
            // Create a type-safe mock implementation
            const originalMethod = evolutionProvider.sendMessageToApi
            evolutionProvider.sendMessageToApi = jest.fn() as any
            ;(evolutionProvider.sendMessageToApi as jest.Mock).mockResolvedValue({ success: true })

            const result = await evolutionProvider.sendText('1234567890', 'Hello, World!')

            expect(evolutionProvider.sendMessageToApi).toHaveBeenCalledWith(
                {
                    number: '1234567890',
                    text: 'Hello, World!',
                    delay: 0,
                },
                '/message/sendText/'
            )
            expect(result).toEqual({ success: true })

            // Restore original method
            evolutionProvider.sendMessageToApi = originalMethod
        })
    })

    describe('sendMessage', () => {
        test('should call sendText if no media option is provided', async () => {
            const sendTextMock = jest
                .spyOn(evolutionProvider, 'sendText')
                .mockResolvedValueOnce({ success: true } as any)

            const result = await evolutionProvider.sendMessage('1234567890', 'Hello, World!')

            expect(sendTextMock).toHaveBeenCalledWith('1234567890', 'Hello, World!')
            expect(result).toEqual({ success: true })
        })

        test('should call sendMedia if media option is provided', async () => {
            const sendMediaMock = jest
                .spyOn(evolutionProvider, 'sendMedia')
                .mockResolvedValueOnce({ success: true } as any)

            const result = await evolutionProvider.sendMessage('1234567890', 'Message with media', {
                media: 'https://example.com/image.jpg',
            })

            expect(sendMediaMock).toHaveBeenCalledWith(
                '1234567890',
                'https://example.com/image.jpg',
                'Message with media'
            )
            expect(result).toEqual({ success: true })
        })
    })

    describe('saveFile', () => {
        test('should save file to temporary directory', async () => {
            // Mock context with media data
            const ctx = {
                from: '1234567890',
                type: 'imageMessage',
                mimetype: 'image/jpeg',
                body: 'ref_123',
                base64: 'base64content',
            }

            // Create a spy for writeFile instead of trying to mock it directly
            const writeFileSpy = jest.spyOn(writeFile, 'apply').mockImplementation(() => Promise.resolve())

            const result = await evolutionProvider.saveFile(ctx)

            // Should generate path with proper extension
            expect(result).toMatch(/\.jpg$/)
        })

        test('should handle custom options', async () => {
            const ctx = {
                from: '1234567890',
                type: 'documentMessage',
                mimetype: 'application/pdf',
                body: 'ref_123',
                base64: 'base64content',
            }

            // Create a spy for writeFile instead of trying to mock it directly
            const writeFileSpy = jest.spyOn(writeFile, 'apply').mockImplementation(() => Promise.resolve())

            const result = await evolutionProvider.saveFile(ctx, {
                path: '/custom/path',
            })

            expect(result).toMatch(/\/custom\/path\/.*\.pdf$/)
        })

        test('should throw error if no base64 data is provided', async () => {
            const ctx = {
                from: '1234567890',
                type: 'imageMessage',
                mimetype: 'image/jpeg',
                body: 'ref_123',
                // No base64 data
            }

            await expect(evolutionProvider.saveFile(ctx)).rejects.toThrow('No multimedia data found')
        })
    })
})
