import { ProviderClass, utils } from '@builderbot/bot'
import type { Vendor } from '@builderbot/bot/dist/provider/interface/provider'
import type { BotContext, Button, SendOptions } from '@builderbot/bot/dist/types'
import axios, { AxiosError, AxiosResponse } from 'axios'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import Queue from 'queue-promise'

import { EvolutionCoreVendor } from './core'
import type { EvolutionInterface } from '../interface/evolution'
import { downloadFile } from '../utils'

import type { EvolutionGlobalVendorArgs, Message, SaveFileOptions } from '~/types'

/**
 * Evolution API Provider implementation
 * Handles all communication with Evolution API for sending messages, media, etc.
 */
class EvolutionProvider extends ProviderClass<EvolutionInterface> implements EvolutionInterface {
    public vendor: Vendor<EvolutionInterface>
    public queue: Queue = new Queue()

    public globalVendorArgs: EvolutionGlobalVendorArgs = {
        name: 'bot',
        apiKey: '',
        baseURL: 'http://localhost:8080',
        instanceName: '',
        port: 3000,
    }

    /**
     * Creates an instance of Evolution Provider
     * @param args Provider configuration
     */
    constructor(args: EvolutionGlobalVendorArgs) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        this.queue = new Queue({
            concurrent: 1,
            interval: 100,
            start: true,
        })
    }

    /**
     * Initialize HTTP server middleware
     */
    protected beforeHttpServerInit(): void {
        this.server = this.server
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .post(
                '/',
                this.vendor?.indexHome ||
                    ((_, res) => {
                        res.end('OK')
                        return
                    })
            )
    }

    /**
     * Initialize vendor core
     */
    protected async initVendor(): Promise<Vendor<any>> {
        const vendor = new EvolutionCoreVendor(this.queue)
        this.vendor = vendor as unknown as Vendor<EvolutionInterface>
        return Promise.resolve(this.vendor)
    }

    /**
     * Build standard headers for API requests
     * @param additionalHeaders Optional additional headers to include
     * @returns Headers object with apiKey
     */
    private builderHeader(additionalHeaders: Record<string, string> = {}): Record<string, string> {
        const { apiKey } = this.globalVendorArgs
        return {
            apikey: apiKey,
            ...additionalHeaders,
        }
    }

    /**
     * Verify connection with Evolution API after HTTP server initialization
     */
    protected async afterHttpServerInit(): Promise<void> {
        try {
            const { baseURL, instanceName } = this.globalVendorArgs

            // Verify connection with Evolution API
            const response = await axios.get(`${baseURL}/instance/connectionState/${instanceName}`, {
                headers: this.builderHeader(),
            })

            if (response.data.state === 'open') {
                this.emit('ready')
            } else {
                throw new Error(`Instance state: ${response.data.state}`)
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            this.emit('notice', {
                title: '🟠 ERROR AUTH 🟠',
                instructions: [
                    'Error connecting to Evolution API, please check your credentials',
                    'Make sure your instance is connected',
                    `Details: ${errorMessage}`,
                ],
            })
        }
    }

    /**
     * Event bus configuration
     */
    protected busEvents() {
        return [
            {
                event: 'auth_failure',
                func: (payload: any) => this.emit('auth_failure', payload),
            },
            {
                event: 'notice',
                func: ({ instructions, title }: { instructions: string[]; title: string }) =>
                    this.emit('notice', { instructions, title }),
            },
            {
                event: 'ready',
                func: () => this.emit('ready', true),
            },
            {
                event: 'message',
                func: (payload: BotContext) => {
                    this.emit('message', payload)
                },
            },
        ]
    }

    /**
     * Send text message
     * @param to Recipient phone number
     * @param message Text message to send
     */
    async sendText(to: string, message: string): Promise<any> {
        return this.sendMessage(to, message)
    }

    /**
     * Send text message (main implementation)
     * @param to Recipient phone number
     * @param message Text message to send
     */
    public async sendMessage<K = any>(to: string, message: string, _args?: any): Promise<K> {
        const { baseURL, instanceName } = this.globalVendorArgs

        try {
            return (await axios.post(
                `${baseURL}/message/sendText/${instanceName}`,
                {
                    number: to,
                    text: message,
                },
                {
                    headers: this.builderHeader(),
                }
            )) as K
        } catch (error) {
            const errorMessage =
                error instanceof AxiosError ? error.response?.data?.message || error.message : 'Unknown error'
            console.error(`Error sending message: ${errorMessage}`)
            throw error
        }
    }

    /**
     * Send image media
     * @param to Recipient phone number
     * @param mediaUrl Image URL or base64
     * @param mediaName Optional filename
     * @param caption Optional image caption
     */
    async sendImage(to: string, mediaUrl: string, mediaName?: string, caption?: string): Promise<any> {
        const { baseURL, instanceName } = this.globalVendorArgs

        try {
            const mimeType = mime.lookup(mediaUrl) || 'image/png'
            const timestamp = Date.now ? Date.now() : new Date().getTime()
            const fileName = mediaName || `image-${timestamp}.${mime.extension(mimeType) || 'png'}`

            return await axios.post(
                `${baseURL}/message/sendMedia/${instanceName}`,
                {
                    number: to,
                    mediaType: 'image',
                    mimeType,
                    caption,
                    media: mediaUrl,
                    fileName,
                },
                {
                    headers: this.builderHeader(),
                }
            )
        } catch (error) {
            const errorMessage =
                error instanceof AxiosError ? error.response?.data?.message || error.message : 'Unknown error'
            console.error(`Error sending image: ${errorMessage}`)
            throw error
        }
    }

    /**
     * Send image from URL
     * @param to Recipient phone number
     * @param url Image URL
     * @param mediaName Optional filename
     * @param caption Optional image caption
     */
    async sendImageUrl(to: string, url: string, mediaName?: string, caption?: string): Promise<any> {
        return this.sendImage(to, url, mediaName, caption)
    }

    /**
     * Send video media
     * @param to Recipient phone number
     * @param mediaUrl Video URL or base64
     * @param mediaName Optional filename
     * @param caption Optional video caption
     */
    async sendVideo(to: string, mediaUrl: string, mediaName?: string, caption?: string): Promise<any> {
        const { baseURL, instanceName } = this.globalVendorArgs

        try {
            const timestamp = Date.now ? Date.now() : new Date().getTime()
            const fileName = mediaName || `video-${timestamp}.mp4`

            return await axios.post(
                `${baseURL}/message/video/${instanceName}`,
                {
                    number: to,
                    mediaType: 'video',
                    mimeType: 'video/mp4',
                    caption,
                    media: mediaUrl,
                    fileName,
                },
                {
                    headers: this.builderHeader(),
                }
            )
        } catch (error) {
            const errorMessage =
                error instanceof AxiosError ? error.response?.data?.message || error.message : 'Unknown error'
            console.error(`Error sending video: ${errorMessage}`)
            throw error
        }
    }

    /**
     * Send video from URL
     * @param to Recipient phone number
     * @param url Video URL
     * @param mediaName Optional filename
     * @param caption Optional video caption
     */
    async sendVideoUrl(to: string, url: string, mediaName?: string, caption?: string): Promise<any> {
        return this.sendVideo(to, url, mediaName, caption)
    }

    /**
     * Send audio media
     * @param to Recipient phone number
     * @param mediaUrl Audio URL or base64
     * @param mediaName Optional filename
     * @param caption Optional audio caption
     */
    async sendAudio(to: string, mediaUrl: string, mediaName?: string, caption?: string): Promise<any> {
        const { baseURL, instanceName } = this.globalVendorArgs

        try {
            const timestamp = Date.now ? Date.now() : new Date().getTime()
            const fileName = mediaName || `audio-${timestamp}.mp3`

            return await axios.post(
                `${baseURL}/message/audio/${instanceName}`,
                {
                    number: to,
                    mediaType: 'audio',
                    mimeType: 'audio/mp3',
                    caption,
                    media: mediaUrl,
                    fileName,
                },
                {
                    headers: this.builderHeader(),
                }
            )
        } catch (error) {
            const errorMessage =
                error instanceof AxiosError ? error.response?.data?.message || error.message : 'Unknown error'
            console.error(`Error sending audio: ${errorMessage}`)
            throw error
        }
    }

    /**
     * Send audio from URL
     * @param to Recipient phone number
     * @param url Audio URL
     * @param mediaName Optional filename
     * @param caption Optional audio caption
     */
    async sendAudioUrl(to: string, url: string, mediaName?: string, caption?: string): Promise<any> {
        return this.sendAudio(to, url, mediaName, caption)
    }

    /**
     * Generic media sending method
     * @param to Recipient phone number
     * @param file File content
     * @param type Media type
     */
    async sendMedia(to: string, file: string, type: string): Promise<any> {
        const { baseURL, instanceName } = this.globalVendorArgs

        try {
            return await axios.post(
                `${baseURL}/message/${type}/${instanceName}`,
                {
                    number: to,
                    [type]: file,
                },
                {
                    headers: this.builderHeader(),
                }
            )
        } catch (error) {
            const errorMessage =
                error instanceof AxiosError ? error.response?.data?.message || error.message : 'Unknown error'
            console.error(`Error sending ${type}: ${errorMessage}`)
            throw error
        }
    }

    /**
     * Send list message
     * @param to Recipient phone number
     * @param list List content
     */
    async sendList(to: string, list: any): Promise<any> {
        const { baseURL, instanceName } = this.globalVendorArgs

        try {
            return await axios.post(
                `${baseURL}/message/list/${instanceName}`,
                {
                    number: to,
                    list,
                },
                {
                    headers: this.builderHeader(),
                }
            )
        } catch (error) {
            const errorMessage =
                error instanceof AxiosError ? error.response?.data?.message || error.message : 'Unknown error'
            console.error(`Error sending list: ${errorMessage}`)
            throw error
        }
    }

    /**
     * Send complete list
     * @param to Recipient phone number
     * @param list List content
     */
    async sendListComplete(to: string, list: any): Promise<any> {
        return this.sendList(to, list)
    }

    /**
     * Save file from context
     * @param ctx Message context containing file information
     * @param options Save options
     * @returns Path to saved file or error message
     */
    public async saveFile(ctx: Partial<Message & BotContext>, options: SaveFileOptions = {}): Promise<string> {
        try {
            if (!ctx.url) {
                return 'ERROR: No URL provided'
            }

            // Get token from context or use a default empty string
            const token = ctx.token || ''

            // Download the file from the URL
            const fileData = await downloadFile(ctx.url, token)
            if (!fileData) {
                return 'ERROR: Failed to download file'
            }

            // Generate filename using timestamp and extension from downloaded file
            const timestamp = Date.now ? Date.now() : new Date().getTime()
            const fileName = `file-${timestamp}.${fileData.extension}`

            // Create full path by joining target directory with filename
            const pathFile = join(options?.path ?? tmpdir(), fileName)

            // Write buffer to file
            await writeFile(pathFile, fileData.buffer)

            // Return resolved absolute path
            return resolve(pathFile)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            console.error(`[Error saving file]: ${errorMessage}`)
            return 'ERROR: ' + errorMessage
        }
    }

    /**
     * Queue message for sending via Evolution API
     * @param body Message body
     */
    sendMessageMeta = (body: any): Promise<any> => {
        return new Promise((resolve, reject) =>
            this.queue.add(async () => {
                try {
                    const resp = await this.sendMessageToApi(body)
                    resolve(resp)
                } catch (error) {
                    reject(error)
                }
            })
        )
    }

    /**
     * Send message directly to Evolution API
     * @param body Message body
     */
    sendMessageToApi = async (body: any): Promise<any> => {
        const { baseURL, instanceName } = this.globalVendorArgs

        try {
            const response = await axios.post(`${baseURL}/message/sendText/${instanceName}`, body, {
                headers: this.builderHeader(),
            })
            return response.data
        } catch (error) {
            const errorMessage =
                error instanceof AxiosError ? error.response?.data?.message || error.message : 'Unknown error'
            console.error(`Error sending message to API: ${errorMessage}`)
            throw error
        }
    }
}

export { EvolutionProvider }
