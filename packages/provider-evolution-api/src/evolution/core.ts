import EventEmitter from 'node:events'
import type polka from 'polka'
import type Queue from 'queue-promise'

import { processIncomingMessage } from '../utils/processIncomingMsg'

import type { Message, EvolutionGlobalVendorArgs, IncomingMessage, ContactMeta } from '~/types'

/**
 * Class representing EvolutionCoreVendor, a vendor class for WhatsApp Business API integration.
 * Handles webhook validation, message reception, and processing through Meta's Cloud API.
 * @extends EventEmitter
 */
export class EvolutionCoreVendor extends EventEmitter {
    /**
     * Queue for handling asynchronous message processing
     * @private
     */
    private readonly queue: Queue

    /**
     * Creates an instance of EvolutionCoreVendor.
     * @param {Queue} _queue - The queue instance for managing message processing.
     */
    constructor(_queue: Queue) {
        super()
        if (!_queue) {
            throw new Error('Queue instance is required')
        }
        this.queue = _queue
    }

    /**
     * Middleware function for health check endpoint.
     * Returns a simple response to verify the service is running.
     * @type {polka.Middleware}
     */
    public indexHome: polka.Middleware = (_, res) => {
        try {
            res.end('ok')
        } catch (error) {
            console.error('Error in indexHome middleware:', error)
            res.statusCode = 500
            res.end('Internal server error')
        }
    }

    /**
     * Validates webhook token from Meta.
     * @param {string} mode - The webhook mode (should be 'subscribe' for valid requests).
     * @param {string} token - The token provided in the webhook request.
     * @param {string} originToken - The expected token configured for this instance.
     * @returns {boolean} Returns true if token is valid, false otherwise.
     */
    public tokenIsValid(mode: string, token: string, originToken: string): boolean {
        if (!mode || !token || !originToken) {
            return false
        }
        return mode === 'subscribe' && originToken === token
    }

    /**
     * Extracts status information from webhook payload.
     * Used to identify errors reported by the Meta API.
     * @param {Object} obj - The webhook payload object.
     * @param {Array} obj.entry - The entry array from webhook payload.
     * @returns {Array<{status: any, reason: string}>} Array of status objects with reasons.
     * @private
     */
    private extractStatus(obj: { entry: any }): { status: any; reason: string }[] {
        if (!obj || !obj.entry) {
            return []
        }

        const entry = Array.isArray(obj.entry) ? obj.entry : []
        const statusArray: { status: any; reason: string }[] = []

        entry.forEach((entryItem: { changes?: any[] }) => {
            if (!entryItem || !entryItem.changes) return

            const changes = Array.isArray(entryItem.changes) ? entryItem.changes : []
            changes.forEach((change) => {
                if (!change || !change.value) return

                const values = change.value || {}
                const statuses = Array.isArray(values.statuses) ? values.statuses : []

                statuses.forEach(
                    (status: {
                        recipient_id?: string
                        errors?: { error_data?: { details?: string } }[]
                        status?: any
                    }) => {
                        const recipient_id = status.recipient_id || 'N/A'
                        const errorDetails = status.errors?.[0]?.error_data?.details || 'Unknown'
                        statusArray.push({
                            status: status.status || 'Unknown',
                            reason: `Number(${recipient_id}): ${errorDetails}`,
                        })
                    }
                )
            })
        })
        return statusArray
    }

    /**
     * Middleware function for webhook verification.
     * Handles the initial verification process required by Meta's Webhook API.
     * @type {polka.Middleware}
     */
    public verifyToken: polka.Middleware = async (req: any, res: any) => {
        try {
            const { query } = req
            const mode: string = query?.['hub.mode']
            const token: string = query?.['hub.verify_token']
            const challenge = query?.['hub.challenge']
            const globalVendorArgs: EvolutionGlobalVendorArgs = req['globalVendorArgs'] ?? null

            if (!mode || !token) {
                res.statusCode = 403
                res.end('No token or mode provided')
                return
            }

            if (this.tokenIsValid(mode, token, globalVendorArgs?.verifyToken)) {
                this.emit('ready')
                res.statusCode = 200
                res.end(challenge)
                return
            }

            res.statusCode = 403
            res.end('Invalid token')
        } catch (error) {
            console.error('Error in verifyToken middleware:', error)
            res.statusCode = 500
            res.end('Internal server error during token verification')
        }
    }

    /**
     * Middleware function for handling incoming webhook messages.
     * Processes incoming messages from WhatsApp and adds them to the processing queue.
     * @type {polka.Middleware}
     */
    public incomingMsg: polka.Middleware = async (req: any, res: any) => {
        try {
            const globalVendorArgs: EvolutionGlobalVendorArgs = req['globalVendorArgs'] ?? null
            if (!globalVendorArgs) {
                res.statusCode = 400
                res.end('Missing vendor arguments')
                return
            }

            const body = req?.body as IncomingMessage
            if (!body || !body.entry) {
                res.statusCode = 400
                res.end('Invalid request body')
                return
            }

            const { jwtToken, numberId, version } = globalVendorArgs

            // Check for errors reported by Meta
            const someErrors = this.extractStatus(body)
            const findError = someErrors.find((s) => s.status === 'failed')

            if (findError) {
                this.emit('notice', {
                    title: '🔔  META ALERT  🔔',
                    instructions: [findError.reason],
                })
                res.writeHead(400, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify(someErrors))
            }

            const entryValue = body.entry?.[0]?.changes?.[0]?.value
            if (!entryValue) {
                res.statusCode = 200
                res.end('No messages found')
                return
            }

            const messages = entryValue.messages
            const contacts = entryValue.contacts
            const messageId = entryValue.messages?.[0]?.id
            const messageTimestamp = entryValue.messages?.[0]?.timestamp

            if (!messages || !Array.isArray(messages) || messages.length === 0) {
                res.statusCode = 200
                res.end('No messages to process')
                return
            }

            await Promise.all(
                messages.map(async (message: any) => {
                    if (!message) return

                    let contact: ContactMeta | undefined
                    if (Array.isArray(contacts) && contacts.length > 0) {
                        ;[contact] = contacts
                    }

                    const to = entryValue.metadata?.display_phone_number
                    const pushName: string = contact?.profile?.name ?? 'Unknown'
                    const fileData =
                        message?.audio ??
                        message?.image ??
                        message?.video ??
                        message?.document ??
                        message?.sticker ??
                        (null as File | undefined)

                    const response: Message = await processIncomingMessage({
                        messageId,
                        messageTimestamp,
                        to,
                        pushName,
                        message,
                        jwtToken,
                        numberId,
                        version,
                        fileData,
                    })

                    if (response) {
                        await this.queue.enqueue(() => this.processMessage(response))
                    }
                })
            )

            res.statusCode = 200
            res.end('Messages enqueued successfully')
        } catch (error) {
            console.error('Error processing incoming message:', error)
            this.emit('notice', {
                title: '🔔  META ALERT  🔔',
                instructions: [error.message || 'An error occurred while processing messages.'],
            })
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(
                JSON.stringify({
                    error: error.message || 'An error occurred while processing messages.',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                })
            )
        }
    }

    /**
     * Processes a validated and formatted message by emitting it as an event.
     * @param {Message} message - The formatted message object ready for processing.
     * @returns {Promise<void>} Promise that resolves when processing is complete.
     */
    public processMessage = (message: Message): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!message) {
                reject(new Error('Invalid message object'))
                return
            }

            try {
                this.emit('message', message)
                resolve()
            } catch (error) {
                console.error('Error in message processing:', error)
                reject(error)
            }
        })
    }
}
