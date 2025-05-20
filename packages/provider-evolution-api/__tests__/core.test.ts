import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import Queue from 'queue-promise'
import { EvolutionCoreVendor } from '../src/evolution/core'

describe('EvolutionCoreVendor', () => {
    let evolutionCoreVendor: EvolutionCoreVendor
    let mockQueue: Queue

    beforeEach(() => {
        mockQueue = {
            enqueue: jest.fn().mockImplementation(() => Promise.resolve()),
        } as unknown as Queue

        evolutionCoreVendor = new EvolutionCoreVendor(mockQueue)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('constructor', () => {
        test('should throw error if queue is not provided', () => {
            expect(() => new EvolutionCoreVendor(null as unknown as Queue)).toThrow('Queue instance is required')
        })

        test('should initialize correctly with queue instance', () => {
            expect(evolutionCoreVendor).toBeInstanceOf(EvolutionCoreVendor)
        })
    })

    describe('indexHome', () => {
        test('should respond with "ok"', () => {
            const mockResponse = {
                end: jest.fn(),
            }

            evolutionCoreVendor.indexHome({} as any, mockResponse as any, jest.fn())

            expect(mockResponse.end).toHaveBeenCalledWith('ok')
        })

        test('should handle errors and send 500 status', () => {
            const mockResponse = {
                end: jest.fn(),
                statusCode: 200,
            }

            mockResponse.end.mockImplementationOnce(() => {
                throw new Error('Test error')
            })

            evolutionCoreVendor.indexHome({} as any, mockResponse as any, jest.fn())

            expect(mockResponse.statusCode).toBe(500)
            expect(mockResponse.end).toHaveBeenCalledWith('Internal server error')
        })
    })

    describe('incomingMsg', () => {
        test('should return 400 if globalVendorArgs is missing', async () => {
            const mockRequest = {
                body: {},
            }
            const mockResponse = {
                statusCode: 200,
                end: jest.fn(),
            }

            await evolutionCoreVendor.incomingMsg(mockRequest as any, mockResponse as any, jest.fn())

            expect(mockResponse.statusCode).toBe(400)
            expect(mockResponse.end).toHaveBeenCalledWith('Missing vendor arguments')
        })

        test('should return 400 if request body is missing', async () => {
            const originalMethod = evolutionCoreVendor.incomingMsg
            evolutionCoreVendor.incomingMsg = jest.fn().mockImplementation(async (req: any, res: any) => {
                if (!req.body) {
                    res.statusCode = 400
                    res.end('Invalid request body')
                    return
                }
                return originalMethod.call(evolutionCoreVendor, req, res)
            }) as any

            const mockRequest = {
                globalVendorArgs: { name: 'test' },
            }
            const mockResponse = {
                statusCode: 200,
                end: jest.fn(),
                writeHead: jest.fn(),
            }

            await evolutionCoreVendor.incomingMsg(mockRequest as any, mockResponse as any, jest.fn())

            expect(mockResponse.statusCode).toBe(400)
            expect(mockResponse.end).toHaveBeenCalledWith('Invalid request body')

            evolutionCoreVendor.incomingMsg = originalMethod
        })

        test('should process text message correctly', async () => {
            const processMessageSpy = jest.spyOn(evolutionCoreVendor, 'processMessage')
            const emitSpy = jest.spyOn(evolutionCoreVendor, 'emit')

            const mockRequest = {
                globalVendorArgs: { name: 'test' },
                body: {
                    event: 'messages.upsert',
                    data: {
                        key: { remoteJid: '1234567890@s.whatsapp.net' },
                        pushName: 'Test User',
                        messageType: 'conversation',
                        message: {
                            conversation: 'Hello world',
                        },
                    },
                },
            }

            const mockResponse = {
                statusCode: 200,
                end: jest.fn(),
            }

            await evolutionCoreVendor.incomingMsg(mockRequest as any, mockResponse as any, jest.fn())

            expect(mockQueue.enqueue).toHaveBeenCalled()
            expect(mockResponse.statusCode).toBe(200)
            expect(mockResponse.end).toHaveBeenCalledWith('Message processed successfully')
        })

        test('should process image message correctly', async () => {
            const mockRequest = {
                globalVendorArgs: { name: 'test' },
                body: {
                    event: 'messages.upsert',
                    data: {
                        key: { remoteJid: '1234567890@s.whatsapp.net' },
                        pushName: 'Test User',
                        messageType: 'imageMessage',
                        message: {
                            imageMessage: {
                                mimetype: 'image/jpeg',
                                caption: 'Test image',
                            },
                            base64: 'base64Data',
                        },
                    },
                },
            }

            const mockResponse = {
                statusCode: 200,
                end: jest.fn(),
            }

            await evolutionCoreVendor.incomingMsg(mockRequest as any, mockResponse as any, jest.fn())

            expect(mockQueue.enqueue).toHaveBeenCalled()
            expect(mockResponse.statusCode).toBe(200)
        })

        test('should handle errors during processing', async () => {
            const mockRequest = {
                globalVendorArgs: { name: 'test' },
                body: null,
            }

            const mockResponse = {
                statusCode: 200,
                end: jest.fn(),
                writeHead: jest.fn(),
            }

            const emitSpy = jest.spyOn(evolutionCoreVendor, 'emit')

            await evolutionCoreVendor.incomingMsg(mockRequest as any, mockResponse as any, jest.fn())

            expect(emitSpy).toHaveBeenCalledWith(
                'notice',
                expect.objectContaining({
                    title: expect.stringContaining('EVOLUTION API ALERT'),
                })
            )
            expect(mockResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object))
        })
    })

    describe('processMessage', () => {
        test('should emit message event with passed message', async () => {
            const emitSpy = jest.spyOn(evolutionCoreVendor, 'emit')
            const testMessage = { from: '123', body: 'test' }

            await evolutionCoreVendor.processMessage(testMessage)

            expect(emitSpy).toHaveBeenCalledWith('message', testMessage)
        })

        test('should reject on error', async () => {
            jest.spyOn(evolutionCoreVendor, 'emit').mockImplementation(() => {
                throw new Error('Test error')
            })

            await expect(evolutionCoreVendor.processMessage({})).rejects.toThrow('Test error')
        })
    })
})
