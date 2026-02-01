import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import fs from 'fs'
import path from 'path'

jest.mock('telegram', () => ({
    TelegramClient: jest.fn().mockImplementation(() => ({
        start: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn().mockResolvedValue(undefined),
        sendFile: jest.fn().mockResolvedValue(undefined),
        getMe: jest.fn().mockResolvedValue({ id: '12345' }),
        iterDialogs: jest.fn().mockReturnValue({
            [Symbol.asyncIterator]: () => ({
                next: jest.fn().mockResolvedValue({ done: true }),
            }),
        }),
        markAsRead: jest.fn().mockResolvedValue(undefined),
        downloadMedia: jest.fn().mockResolvedValue(Buffer.from('media-data')),
        addEventHandler: jest.fn(),
        session: { save: jest.fn().mockReturnValue('session-string') },
    })),
    Api: {
        User: jest.fn(),
    },
}))

jest.mock('telegram/events/index.js', () => ({
    NewMessage: jest.fn().mockImplementation(() => ({})),
    NewMessageEvent: jest.fn(),
}))

jest.mock('telegram/sessions/index.js', () => ({
    StringSession: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('@builderbot/bot', () => {
    class MockProviderClass {
        emit = jest.fn()
        on = jest.fn()
        server = null
        vendor = null
    }
    return {
        ProviderClass: MockProviderClass,
        utils: {
            generateRefProvider: jest.fn().mockImplementation((prefix: string) => `${prefix}_mock-uuid`),
            delay: jest.fn().mockResolvedValue(undefined),
        },
    }
})

jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue('saved-session'),
    writeFileSync: jest.fn(),
    unlinkSync: jest.fn(),
}))

import { TelegramProvider } from '../src/telegram.provider'

describe('#TelegramProvider', () => {
    let provider: TelegramProvider

    beforeEach(() => {
        jest.clearAllMocks()
        ;(fs.existsSync as jest.MockedFunction<typeof fs.existsSync>).mockReturnValue(true)

        provider = new TelegramProvider({
            name: 'test-telegram',
            port: 3000,
            apiId: 12345,
            apiHash: 'test-hash',
            getCode: async () => '12345',
            apiNumber: '+1234567890',
        })
    })

    // ===== Constructor =====

    describe('#constructor', () => {
        test('should instantiate correctly with valid args', () => {
            expect(provider).toBeDefined()
            expect(provider.globalVendorArgs.apiId).toBe(12345)
            expect(provider.globalVendorArgs.apiHash).toBe('test-hash')
        })

        test('should throw if apiId is missing', () => {
            expect(() => {
                new TelegramProvider({
                    apiId: undefined as any,
                    apiHash: 'hash',
                    getCode: async () => '12345',
                })
            }).toThrow('Must provide Telegram API ID')
        })

        test('should throw if apiHash is missing', () => {
            expect(() => {
                new TelegramProvider({
                    apiId: 12345,
                    apiHash: undefined as any,
                    getCode: async () => '12345',
                })
            }).toThrow('Must provide Telegram API Hash')
        })

        test('should create session directory if it does not exist', () => {
            ;(fs.existsSync as jest.MockedFunction<typeof fs.existsSync>).mockReturnValue(false)

            new TelegramProvider({
                apiId: 12345,
                apiHash: 'hash',
                getCode: async () => '12345',
            })

            expect(fs.mkdirSync).toHaveBeenCalled()
        })
    })

    // ===== sendMessage =====

    describe('#sendMessage', () => {
        test('should send a text message', async () => {
            await provider.sendMessage('user123', 'Hello')

            expect(provider.client.sendMessage).toHaveBeenCalledWith('user123', {
                message: 'Hello',
            })
        })

        test('should delegate to sendButtons when buttons are provided', async () => {
            const sendButtonsSpy = jest.spyOn(provider, 'sendButtons').mockResolvedValue(undefined)

            await provider.sendMessage('user123', 'Pick one', {
                buttons: [{ body: 'Option 1' }],
            } as any)

            expect(sendButtonsSpy).toHaveBeenCalledWith('user123', 'Pick one', [{ body: 'Option 1' }])
        })

        test('should delegate to sendMedia when mediaURL is provided', async () => {
            const sendMediaSpy = jest.spyOn(provider, 'sendMedia').mockResolvedValue(undefined)

            await provider.sendMessage('user123', 'caption', {
                mediaURL: 'https://example.com/image.jpg',
            } as any)

            expect(sendMediaSpy).toHaveBeenCalledWith('user123', 'https://example.com/image.jpg', 'caption')
        })
    })

    // ===== sendButtons =====

    describe('#sendButtons', () => {
        test('should return undefined (not implemented)', async () => {
            const result = await provider.sendButtons('user123', 'text', [])
            expect(result).toBeUndefined()
        })
    })

    // ===== sendMedia =====

    describe('#sendMedia', () => {
        test('should fetch media, write to disk, and send via client', async () => {
            const mockBuffer = new ArrayBuffer(8)
            const mockHeaders = new Map([['content-type', 'image/png']])
            global.fetch = jest.fn().mockResolvedValue({
                arrayBuffer: () => Promise.resolve(mockBuffer),
                headers: { get: (key: string) => 'image/png' },
            }) as any

            jest.spyOn(path, 'join').mockReturnValue('/tmp/media/test.png')

            await provider.sendMedia('user123', 'https://example.com/img.png', 'caption')

            expect(fs.writeFileSync).toHaveBeenCalled()
            expect(provider.client.sendFile).toHaveBeenCalledWith('user123', expect.objectContaining({
                file: expect.any(String),
                caption: 'caption',
            }))
        })

        test('should handle voice note extensions', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
                headers: { get: () => 'audio/ogg' },
            }) as any

            jest.spyOn(path, 'join').mockReturnValue('/tmp/media/test.ogg')

            await provider.sendMedia('user123', 'https://example.com/voice.ogg', 'caption')

            expect(provider.client.sendFile).toHaveBeenCalledWith('user123', expect.objectContaining({
                voiceNote: true,
            }))
        })

        test('should handle video_note caption with mp4', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
                headers: { get: () => 'video/mp4' },
            }) as any

            jest.spyOn(path, 'join').mockReturnValue('/tmp/media/test.mp4')

            await provider.sendMedia('user123', 'https://example.com/vid.mp4', 'video_note')

            expect(provider.client.sendFile).toHaveBeenCalledWith('user123', expect.objectContaining({
                videoNote: true,
            }))
        })
    })

    // ===== saveFile =====

    describe('#saveFile', () => {
        test('should download and save file returning path', async () => {
            const ctx = {
                message: {
                    file: { mimeType: 'image/jpeg' },
                },
                from: 'user123',
            }
            const options = { path: '/tmp/saved' }

            jest.spyOn(path, 'join').mockReturnValue('/tmp/saved/12345-user123.jpeg')

            const result = await provider.saveFile(ctx as any, options)

            expect(provider.client.downloadMedia).toHaveBeenCalled()
            expect(fs.writeFileSync).toHaveBeenCalled()
            expect(result).toBe('/tmp/saved/12345-user123.jpeg')
        })

        test('should return empty string if message has no file', async () => {
            const ctx = {
                message: { file: null },
                from: 'user123',
            }

            const result = await provider.saveFile(ctx as any, { path: '/tmp' })

            expect(result).toBe('')
        })

        test('should handle errors gracefully', async () => {
            const ctx = {
                message: {
                    file: { mimeType: 'image/png' },
                },
                from: 'user123',
            }

            provider.client.downloadMedia = jest.fn().mockRejectedValue(new Error('Download failed')) as any

            const result = await provider.saveFile(ctx as any, { path: '/tmp' })

            expect(result).toBeUndefined()
        })
    })

    // ===== busEvents =====

    describe('#busEvents', () => {
        test('should return array with message event handler', () => {
            const events = provider['busEvents']()
            expect(events).toHaveLength(1)
            expect(events[0].event).toBe('message')
        })

        test('should detect voice messages and set body to voice_note event', () => {
            const events = provider['busEvents']()
            const handler = events[0].func

            const payload = {
                message: {
                    voice: true,
                    media: null,
                    message: 'test',
                },
                body: 'test',
            }

            handler(payload as any)

            expect(payload.body).toMatch(/_event_voice_note_/)
        })

        test('should detect media messages and set body to media event', () => {
            const events = provider['busEvents']()
            const handler = events[0].func

            const payload = {
                message: {
                    voice: false,
                    media: { someData: true },
                    message: 'media caption',
                },
                body: 'original',
                caption: undefined as string | undefined,
            }

            handler(payload as any)

            expect(payload.body).toMatch(/_event_media_/)
            expect(payload.caption).toBe('media caption')
        })

        test('should emit message event after processing', () => {
            const events = provider['busEvents']()
            const handler = events[0].func

            const payload = {
                message: { voice: false, media: null, message: 'hello' },
                body: 'hello',
            }

            handler(payload as any)

            expect(provider.emit).toHaveBeenCalledWith('message', payload)
        })
    })

    // ===== _getStringSession =====

    describe('#_getStringSession', () => {
        test('should use telegramJwt when available', () => {
            provider.globalVendorArgs.telegramJwt = 'jwt-token'
            ;(fs.existsSync as jest.MockedFunction<typeof fs.existsSync>).mockReturnValue(false)

            const session = provider['_getStringSession']()
            expect(session).toBeDefined()
        })

        test('should read session from file if no jwt', () => {
            provider.globalVendorArgs.telegramJwt = undefined
            ;(fs.existsSync as jest.MockedFunction<typeof fs.existsSync>).mockReturnValue(true)

            provider['_getStringSession']()

            expect(fs.readFileSync).toHaveBeenCalled()
        })
    })

    // ===== markAsRead =====

    describe('#markAsRead', () => {
        test('should delegate to client.markAsRead', async () => {
            await provider.markAsRead('user123')
            expect(provider.client.markAsRead).toHaveBeenCalledWith('user123')
        })
    })

    // ===== getUnreadMessages =====

    describe('#getUnreadMessages', () => {
        test('should return array of unread message lists', async () => {
            const result = await provider.getUnreadMessages()
            expect(Array.isArray(result)).toBe(true)
        })
    })

    // ===== getRespondedConversations =====

    describe('#getRespondedConversations', () => {
        test('should return array of responded conversation messages', async () => {
            const result = await provider.getRespondedConversations()
            expect(Array.isArray(result)).toBe(true)
        })
    })

    // ===== HTTP server hooks =====

    describe('#beforeHttpServerInit', () => {
        test('should be a no-op', () => {
            expect(() => provider['beforeHttpServerInit']()).not.toThrow()
        })
    })

    describe('#afterHttpServerInit', () => {
        test('should be a no-op', () => {
            expect(() => provider['afterHttpServerInit']()).not.toThrow()
        })
    })
})
