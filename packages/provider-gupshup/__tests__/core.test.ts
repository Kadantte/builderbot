import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

import { GupshupCoreVendor } from '../src/gupshup/core'
import type { GupshupGlobalVendorArgs } from '../src/types'

jest.mock('../src/utils/processIncomingMsg')

const { processIncomingMessage } = jest.requireMock('../src/utils/processIncomingMsg') as {
    processIncomingMessage: any
}
const { processIncomingMessage: realProcessIncomingMessage } = jest.requireActual(
    '../src/utils/processIncomingMsg'
) as {
    processIncomingMessage: any
}

describe('#GupshupCoreVendor', () => {
    let coreVendor: GupshupCoreVendor

    const mockArgs: GupshupGlobalVendorArgs = {
        name: 'test-bot',
        port: 3000,
        apiKey: 'test-api-key',
        srcName: 'test-app',
        phoneNumber: '15556581240',
        webhook: {
            verify: async () => true,
        },
        logs: {
            inbound: true,
            status: 'all',
            outboundErrors: true,
            rawOnFailed: false,
        },
    }

    beforeEach(() => {
        coreVendor = new GupshupCoreVendor(mockArgs)
        jest.clearAllMocks()
        processIncomingMessage.mockReset()
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('#incomingMsg', () => {
        test('should respond with "OK" when webhook has no entries', async () => {
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }

            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(processIncomingMessage).not.toHaveBeenCalled()
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should process cloud messages and emit "message" event', async () => {
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'messages',
                                    value: {
                                        metadata: {
                                            display_phone_number: '15556581240',
                                            phone_number_id: '862813713572372',
                                        },
                                        contacts: [
                                            {
                                                profile: { name: 'Juan Giupponi' },
                                                wa_id: '5493364183950',
                                            },
                                        ],
                                        messages: [
                                            {
                                                from: '5493364183950',
                                                id: 'wamid.1',
                                                text: { body: 'hola' },
                                                timestamp: '1770811963',
                                                type: 'text',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const fakeBotContext = {
                from: '5493364183950',
                name: 'Juan Giupponi',
                body: 'hola',
            }

            processIncomingMessage.mockResolvedValue(fakeBotContext)
            const emitSpy = jest.spyOn(coreVendor, 'emit')

            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(processIncomingMessage).toHaveBeenCalledTimes(1)
            expect(processIncomingMessage).toHaveBeenCalledWith(
                {
                    message: {
                        from: '5493364183950',
                        id: 'wamid.1',
                        text: { body: 'hola' },
                        timestamp: '1770811963',
                        type: 'text',
                    },
                    contact: {
                        profile: { name: 'Juan Giupponi' },
                        wa_id: '5493364183950',
                    },
                    metadata: {
                        display_phone_number: '15556581240',
                        phone_number_id: '862813713572372',
                    },
                },
                mockArgs
            )
            expect(emitSpy).toHaveBeenCalledWith('notice', {
                title: '📩  GUPSHUP INBOUND',
                instructions: ['From: 5493364183950', 'Type: text', 'Body: hola'],
            })
            expect(emitSpy).toHaveBeenCalledWith('message', fakeBotContext)
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should integrate with parser canonical dispatch for mixed-case text type', async () => {
            processIncomingMessage.mockImplementation(realProcessIncomingMessage)

            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'messages',
                                    value: {
                                        metadata: {
                                            display_phone_number: '15556581240',
                                        },
                                        contacts: [
                                            {
                                                profile: { name: 'Ana' },
                                                wa_id: '5493364183999',
                                            },
                                        ],
                                        messages: [
                                            {
                                                from: '5493364183999',
                                                id: 'wamid.case.1',
                                                text: { body: 'hola canonico' },
                                                timestamp: '1770811963',
                                                type: ' TEXT ',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const emitSpy = jest.spyOn(coreVendor, 'emit')

            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(processIncomingMessage).toHaveBeenCalledTimes(1)
            expect(emitSpy).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    from: '5493364183999',
                    name: 'Ana',
                    body: 'hola canonico',
                    type: 'text',
                })
            )
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should reject webhook when verify hook returns false', async () => {
            const vendor = new GupshupCoreVendor({
                ...mockArgs,
                webhook: {
                    verify: async () => false,
                },
            })
            const mockReq = {
                body: {
                    entry: [
                        {
                            changes: [],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }

            await vendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(processIncomingMessage).not.toHaveBeenCalled()
            expect(mockRes.statusCode).toBe(401)
            expect(mockRes.end).toHaveBeenCalledWith('Unauthorized')
        })

        test('should respond with 500 when verify hook rejects', async () => {
            const vendor = new GupshupCoreVendor({
                ...mockArgs,
                webhook: {
                    verify: async () => Promise.reject(new Error('verify rejected')),
                },
            })
            const mockReq = {
                body: {
                    entry: [],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            await vendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(mockRes.statusCode).toBe(500)
            expect(mockRes.end).toHaveBeenCalledWith('Error')
            expect(consoleSpy).toHaveBeenCalledWith('Webhook Error:', expect.any(Error))

            consoleSpy.mockRestore()
        })

        test('should respond with 500 when verify hook throws synchronously', async () => {
            const vendor = new GupshupCoreVendor({
                ...mockArgs,
                webhook: {
                    verify: () => {
                        throw new Error('verify sync throw')
                    },
                },
            })
            const mockReq = {
                body: {
                    entry: [],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            await vendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(mockRes.statusCode).toBe(500)
            expect(mockRes.end).toHaveBeenCalledWith('Error')
            expect(consoleSpy).toHaveBeenCalledWith('Webhook Error:', expect.any(Error))

            consoleSpy.mockRestore()
        })

        test('should dedupe inbound messages by id before emitting', async () => {
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'messages',
                                    value: {
                                        contacts: [{ wa_id: '5493364183950', profile: { name: 'Juan' } }],
                                        messages: [
                                            {
                                                from: '5493364183950',
                                                id: 'wamid.dup',
                                                text: { body: 'hola 1' },
                                                timestamp: '1770811963',
                                                type: 'text',
                                            },
                                            {
                                                from: '5493364183950',
                                                id: 'wamid.dup',
                                                text: { body: 'hola 2' },
                                                timestamp: '1770811964',
                                                type: 'text',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const emitSpy = jest.spyOn(coreVendor, 'emit')

            processIncomingMessage.mockResolvedValue({ from: '5493364183950', name: 'Juan', body: 'hola 1' })

            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(processIncomingMessage).toHaveBeenCalledTimes(1)
            expect(emitSpy).toHaveBeenCalledWith('message', { from: '5493364183950', name: 'Juan', body: 'hola 1' })
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should process duplicated id on retry when first processing fails', async () => {
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'messages',
                                    value: {
                                        contacts: [{ wa_id: '5493364183950', profile: { name: 'Juan' } }],
                                        messages: [
                                            {
                                                from: '5493364183950',
                                                id: 'wamid.retry',
                                                text: { body: 'hola retry' },
                                                timestamp: '1770811963',
                                                type: 'text',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const firstRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const secondRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const emitSpy = jest.spyOn(coreVendor, 'emit')

            processIncomingMessage.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce({
                from: '5493364183950',
                name: 'Juan',
                body: 'hola retry',
            })

            await coreVendor.incomingMsg(mockReq as any, firstRes as any, jest.fn())
            await coreVendor.incomingMsg(mockReq as any, secondRes as any, jest.fn())

            expect(processIncomingMessage).toHaveBeenCalledTimes(2)
            expect(firstRes.statusCode).toBe(200)
            expect(secondRes.statusCode).toBe(200)
            expect(emitSpy).toHaveBeenCalledWith('message', {
                from: '5493364183950',
                name: 'Juan',
                body: 'hola retry',
            })
        })

        test('should process same message id again after dedupe ttl expires', async () => {
            const vendor = new GupshupCoreVendor({
                ...mockArgs,
                webhook: {
                    verify: async () => true,
                    dedupeTtlMs: 50,
                },
            })
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'messages',
                                    value: {
                                        contacts: [{ wa_id: '5493364183950', profile: { name: 'Juan' } }],
                                        messages: [
                                            {
                                                from: '5493364183950',
                                                id: 'wamid.expire',
                                                text: { body: 'hola ttl' },
                                                timestamp: '1770811963',
                                                type: 'text',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const firstRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const secondRes = {
                end: jest.fn(),
                statusCode: 0,
            }

            let now = 1_000
            const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now)
            processIncomingMessage.mockResolvedValue({ from: '5493364183950', name: 'Juan', body: 'hola ttl' })

            await vendor.incomingMsg(mockReq as any, firstRes as any, jest.fn())
            now = 1_051
            await vendor.incomingMsg(mockReq as any, secondRes as any, jest.fn())

            expect(processIncomingMessage).toHaveBeenCalledTimes(2)
            expect(firstRes.statusCode).toBe(200)
            expect(secondRes.statusCode).toBe(200)

            dateNowSpy.mockRestore()
        })

        test('should isolate failed message processing and continue batch', async () => {
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'messages',
                                    value: {
                                        contacts: [
                                            { wa_id: '5493364183950', profile: { name: 'Juan' } },
                                            { wa_id: '5493364183000', profile: { name: 'Maria' } },
                                        ],
                                        messages: [
                                            {
                                                from: '5493364183950',
                                                id: 'wamid.fail',
                                                text: { body: 'hola fail' },
                                                timestamp: '1770811963',
                                                type: 'text',
                                            },
                                            {
                                                from: '5493364183000',
                                                id: 'wamid.ok',
                                                text: { body: 'hola ok' },
                                                timestamp: '1770811964',
                                                type: 'text',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const emitSpy = jest.spyOn(coreVendor, 'emit')
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            processIncomingMessage
                .mockRejectedValueOnce(new Error('message failed'))
                .mockResolvedValueOnce({ from: '5493364183000', name: 'Maria', body: 'hola ok' })

            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(processIncomingMessage).toHaveBeenCalledTimes(2)
            expect(emitSpy).toHaveBeenCalledWith('message', {
                from: '5493364183000',
                name: 'Maria',
                body: 'hola ok',
            })
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
            expect(consoleSpy).toHaveBeenCalledWith(
                '[Gupshup] Error processing inbound message wamid.fail:',
                'message failed'
            )

            consoleSpy.mockRestore()
        })

        test('should process one concurrent delivery for the same message id', async () => {
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'messages',
                                    value: {
                                        contacts: [{ wa_id: '5493364183950', profile: { name: 'Juan' } }],
                                        messages: [
                                            {
                                                from: '5493364183950',
                                                id: 'wamid.concurrent',
                                                text: { body: 'hola concurrente' },
                                                timestamp: '1770811963',
                                                type: 'text',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const firstRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const secondRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const emitSpy = jest.spyOn(coreVendor, 'emit')

            let resolveProcessing: ((value: unknown) => void) | undefined
            processIncomingMessage.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolveProcessing = resolve
                    })
            )

            const firstCallPromise = coreVendor.incomingMsg(mockReq as any, firstRes as any, jest.fn())
            await Promise.resolve()

            const secondCallPromise = coreVendor.incomingMsg(mockReq as any, secondRes as any, jest.fn())
            resolveProcessing?.({ from: '5493364183950', name: 'Juan', body: 'hola concurrente' })

            await firstCallPromise
            await secondCallPromise

            expect(processIncomingMessage).toHaveBeenCalledTimes(1)
            const messageEmits = emitSpy.mock.calls.filter(([eventName]) => eventName === 'message')
            expect(messageEmits).toHaveLength(1)
            expect(messageEmits[0][1]).toEqual({
                from: '5493364183950',
                name: 'Juan',
                body: 'hola concurrente',
            })
            expect(firstRes.statusCode).toBe(200)
            expect(secondRes.statusCode).toBe(200)
        })

        test('should process multiple messages from same webhook', async () => {
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'messages',
                                    value: {
                                        contacts: [
                                            {
                                                profile: { name: 'Juan' },
                                                wa_id: '5493364183950',
                                            },
                                            {
                                                profile: { name: 'Maria' },
                                                wa_id: '5493364183000',
                                            },
                                        ],
                                        messages: [
                                            {
                                                from: '5493364183950',
                                                id: 'wamid.1',
                                                text: { body: 'hola 1' },
                                                timestamp: '1770811963',
                                                type: 'text',
                                            },
                                            {
                                                from: '5493364183000',
                                                id: 'wamid.2',
                                                text: { body: 'hola 2' },
                                                timestamp: '1770811964',
                                                type: 'text',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const emitSpy = jest.spyOn(coreVendor, 'emit')

            processIncomingMessage
                .mockResolvedValueOnce({ from: '5493364183950', name: 'Juan', body: 'hola 1' })
                .mockResolvedValueOnce({ from: '5493364183000', name: 'Maria', body: 'hola 2' })

            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(processIncomingMessage).toHaveBeenCalledTimes(2)
            expect(emitSpy).toHaveBeenCalledWith('message', {
                from: '5493364183950',
                name: 'Juan',
                body: 'hola 1',
            })
            expect(emitSpy).toHaveBeenCalledWith('message', {
                from: '5493364183000',
                name: 'Maria',
                body: 'hola 2',
            })
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should skip inbound notice when inbound logs are disabled', async () => {
            const vendor = new GupshupCoreVendor({
                ...mockArgs,
                logs: {
                    ...mockArgs.logs,
                    inbound: false,
                },
            })
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'messages',
                                    value: {
                                        contacts: [
                                            {
                                                profile: { name: 'Juan' },
                                                wa_id: '5493364183950',
                                            },
                                        ],
                                        messages: [
                                            {
                                                from: '5493364183950',
                                                id: 'wamid.1',
                                                text: { body: 'hola' },
                                                timestamp: '1770811963',
                                                type: 'text',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const fakeBotContext = {
                from: '5493364183950',
                name: 'Juan',
                body: 'hola',
            }

            processIncomingMessage.mockResolvedValue(fakeBotContext)
            const emitSpy = jest.spyOn(vendor, 'emit')

            await vendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(emitSpy).not.toHaveBeenCalledWith(
                'notice',
                expect.objectContaining({
                    title: '📩  GUPSHUP INBOUND',
                })
            )
            expect(emitSpy).toHaveBeenCalledWith('message', fakeBotContext)
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should process status events and emit status notice', async () => {
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'statuses',
                                    value: {
                                        statuses: [{ id: 'wamid.1', status: 'sent' }],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const emitSpy = jest.spyOn(coreVendor, 'emit')

            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(processIncomingMessage).not.toHaveBeenCalled()
            expect(emitSpy).toHaveBeenCalledWith(
                'notice',
                expect.objectContaining({
                    title: '📨  GUPSHUP STATUS',
                    instructions: expect.arrayContaining(['Status: sent', 'Recipient: unknown']),
                })
            )
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should isolate status listener failures and continue webhook processing', async () => {
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'statuses',
                                    value: {
                                        statuses: [{ id: 'wamid.1', status: 'sent', recipient_id: '5493364183950' }],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            coreVendor.on('status', () => {
                throw new Error('status listener failed')
            })

            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
            expect(consoleSpy).toHaveBeenCalledWith(
                '[Gupshup] Error dispatching status event:',
                'status listener failed'
            )

            consoleSpy.mockRestore()
        })

        test('should isolate notice listener failures and continue webhook processing', async () => {
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'statuses',
                                    value: {
                                        statuses: [{ id: 'wamid.1', status: 'sent', recipient_id: '5493364183950' }],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            coreVendor.on('notice', () => {
                throw new Error('notice listener failed')
            })

            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
            expect(consoleSpy).toHaveBeenCalledWith(
                '[Gupshup] Error dispatching notice event:',
                'notice listener failed'
            )

            consoleSpy.mockRestore()
        })

        test('should skip non-failed statuses when status log mode is failed', async () => {
            const vendor = new GupshupCoreVendor({
                ...mockArgs,
                logs: {
                    ...mockArgs.logs,
                    status: 'failed',
                },
            })
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'statuses',
                                    value: {
                                        statuses: [{ recipient_id: '5493364183950', status: 'sent' }],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const emitSpy = jest.spyOn(vendor, 'emit')

            await vendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(emitSpy).not.toHaveBeenCalledWith('notice', expect.anything())
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should emit alert notice when status is failed', async () => {
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'messages',
                                    value: {
                                        statuses: [
                                            {
                                                recipient_id: '5493364183950',
                                                status: 'failed',
                                                errors: [
                                                    {
                                                        title: 'Message failed',
                                                        details: 'Rejected by destination number',
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const emitSpy = jest.spyOn(coreVendor, 'emit')

            await coreVendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(processIncomingMessage).not.toHaveBeenCalled()
            expect(emitSpy).toHaveBeenCalledWith(
                'notice',
                expect.objectContaining({
                    title: '🔔  GUPSHUP ALERT  🔔',
                    instructions: expect.arrayContaining([
                        'Status: failed',
                        'Recipient: 5493364183950',
                        'Rejected by destination number',
                    ]),
                })
            )
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should include raw payload when rawOnFailed is enabled', async () => {
            const vendor = new GupshupCoreVendor({
                ...mockArgs,
                logs: {
                    ...mockArgs.logs,
                    status: 'failed',
                    rawOnFailed: true,
                },
            })
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'statuses',
                                    value: {
                                        statuses: [
                                            {
                                                recipient_id: '5493364183950',
                                                status: 'failed',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const emitSpy = jest.spyOn(vendor, 'emit')

            await vendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(emitSpy).toHaveBeenCalledWith(
                'notice',
                expect.objectContaining({
                    title: '🔔  GUPSHUP ALERT  🔔',
                    instructions: expect.arrayContaining([expect.stringContaining('Raw: ')]),
                })
            )
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should respond with 500 on top-level webhook error', async () => {
            const vendor = new GupshupCoreVendor({
                ...mockArgs,
                webhook: {
                    verify: async () => {
                        throw new Error('verify failed')
                    },
                },
            })
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'messages',
                                    value: {
                                        messages: [
                                            {
                                                from: '5493364183950',
                                                id: 'wamid.1',
                                                text: { body: 'hola' },
                                                timestamp: '1770811963',
                                                type: 'text',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            await vendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(mockRes.statusCode).toBe(500)
            expect(mockRes.end).toHaveBeenCalledWith('Error')
            expect(consoleSpy).toHaveBeenCalled()

            consoleSpy.mockRestore()
        })

        test('should emit security warning once when webhook verification is missing', async () => {
            const vendor = new GupshupCoreVendor({
                ...mockArgs,
                webhook: undefined,
            })
            const emitSpy = jest.spyOn(vendor, 'emit')
            const mockReq = {
                body: {
                    object: 'whatsapp_business_account',
                },
            }
            const mockRes = {
                end: jest.fn(),
                statusCode: 0,
            }

            await vendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())
            await vendor.incomingMsg(mockReq as any, mockRes as any, jest.fn())

            expect(emitSpy).toHaveBeenCalledWith(
                'notice',
                expect.objectContaining({
                    title: '🟠  GUPSHUP SECURITY NOTICE  🟠',
                    instructions: expect.arrayContaining([
                        'Webhook verification is disabled.',
                        expect.stringContaining('webhook.verify'),
                    ]),
                })
            )
            const securityNotices = emitSpy.mock.calls.filter(
                ([eventName, payload]) => eventName === 'notice' && payload?.title === '🟠  GUPSHUP SECURITY NOTICE  🟠'
            )
            expect(securityNotices).toHaveLength(1)
        })
    })
})
