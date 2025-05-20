import { ProviderClass, utils } from '@builderbot/bot'
import type { Vendor } from '@builderbot/bot/dist/provider/interface/provider'
import type { BotContext, Button, SendOptions } from '@builderbot/bot/dist/types'
import axios from 'axios'
import FormData from 'form-data'
import { createReadStream } from 'fs'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import { tmpdir } from 'os'
import { join, basename, resolve } from 'path'
import Queue from 'queue-promise'

import { EvolutionCoreVendor } from './core'
import type { EvolutionInterface } from '../interface/evolution'
import { downloadFile, getProfile } from '../utils'
import { parseMetaNumber } from '../utils/number'

import type {
    EvolutionGlobalVendorArgs,
    Localization,
    Message,
    MetaList,
    ParsedContact,
    Reaction,
    SaveFileOptions,
    TextMessageBody,
} from '~/types'

class EvolutionProvider extends ProviderClass<EvolutionInterface> implements EvolutionInterface {
    public vendor: Vendor<any>
    public queue: Queue = new Queue()

    public globalVendorArgs: EvolutionGlobalVendorArgs = {
        name: 'bot',
        apiKey: '',
        baseURL: 'http://localhost:8080',
        instanceName: '',
    }

    constructor(args: EvolutionGlobalVendorArgs) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        this.queue = new Queue({
            concurrent: 1,
            interval: 100,
            start: true,
        })
    }

    protected beforeHttpServerInit(): void {
        this.server = this.server
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .post('/', this.vendor.indexHome)
    }

    protected async initVendor(): Promise<any> {
        const vendor = new EvolutionCoreVendor(this.queue)
        this.vendor = vendor
        return Promise.resolve(this.vendor)
    }

    protected async afterHttpServerInit(): Promise<void> {
        try {
            const { baseURL, instanceName, apiKey } = this.globalVendorArgs

            // Verificar conexión con Evolution API
            const response = await axios.get(`${baseURL}/instance/connectionState/${instanceName}`, {
                headers: {
                    apikey: apiKey,
                },
            })

            if (response.data.state === 'open') {
                this.emit('ready')
            } else {
                throw new Error('Instance not connected')
            }
        } catch (err) {
            this.emit('notice', {
                title: '🟠 ERROR AUTH 🟠',
                instructions: [
                    'Error connecting to Evolution API, please check your credentials',
                    'Make sure your instance is connected',
                ],
            })
        }
    }

    busEvents = () => [
        {
            event: 'auth_failure',
            func: (payload: any) => this.emit('auth_failure', payload),
        },
        {
            event: 'notice',
            func: ({ instructions, title }) => this.emit('notice', { instructions, title }),
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

    async sendText(to: string, message: string): Promise<any> {
        return this.sendMessage(to, message)
    }

    async sendMessage(to: string, message: string): Promise<any> {
        try {
            const { baseURL, instanceName, apiKey } = this.globalVendorArgs

            return await axios.post(
                `${baseURL}/message/sendText/${instanceName}`,
                {
                    number: to,
                    text: message,
                },
                {
                    headers: {
                        apikey: apiKey,
                    },
                }
            )
        } catch (error) {
            console.error('Error sending message:', error)
            throw error
        }
    }

    async sendImage(to: string, mediaUrl: string, mediaName?: string, caption?: string): Promise<any> {
        try {
            const { baseURL, instanceName, apiKey } = this.globalVendorArgs

            return await axios.post(
                `${baseURL}/message/sendMedia/${instanceName}`,
                {
                    number: to,
                    mediaType: 'image',
                    mimeType: mime.lookup(mediaUrl) || 'image/png',
                    caption: caption,
                    media: mediaUrl,
                    fileName: mediaName || 'image.png',
                },
                {
                    headers: {
                        apikey: apiKey,
                    },
                }
            )
        } catch (error) {
            console.error('Error sending image:', error)
            throw error
        }
    }

    async sendImageUrl(to: string, url: string, mediaName?: string, caption?: string): Promise<any> {
        return this.sendImage(to, url, mediaName, caption)
    }

    async sendVideo(to: string, mediaUrl: string, mediaName?: string, caption?: string): Promise<any> {
        try {
            const { baseURL, instanceName, apiKey } = this.globalVendorArgs

            return await axios.post(
                `${baseURL}/message/video/${instanceName}`,
                {
                    number: to,
                    mediaType: 'video',
                    mimeType: 'video/mp4',
                    caption: caption,
                    media: mediaUrl,
                    fileName: mediaName || 'video.mp4',
                },
                {
                    headers: {
                        apikey: apiKey,
                    },
                }
            )
        } catch (error) {
            console.error('Error sending video:', error)
            throw error
        }
    }

    async sendVideoUrl(to: string, url: string, mediaName?: string, caption?: string): Promise<any> {
        return this.sendVideo(to, url, mediaName, caption)
    }

    async sendAudio(to: string, mediaUrl: string, mediaName?: string, caption?: string): Promise<any> {
        try {
            const { baseURL, instanceName, apiKey } = this.globalVendorArgs

            return await axios.post(
                `${baseURL}/message/audio/${instanceName}`,
                {
                    number: to,
                    mediaType: 'audio',
                    mimeType: 'audio/mp3',
                    caption: caption,
                    media: mediaUrl,
                    fileName: mediaName || 'audio.mp3',
                },
                {
                    headers: {
                        apikey: apiKey,
                    },
                }
            )
        } catch (error) {
            console.error('Error sending audio:', error)
            throw error
        }
    }

    async sendAudioUrl(to: string, url: string, mediaName?: string, caption?: string): Promise<any> {
        return this.sendAudio(to, url, mediaName, caption)
    }

    async sendMedia(to: string, file: string, type: string): Promise<any> {
        const { baseURL, instanceName, apiKey } = this.globalVendorArgs

        try {
            return await axios.post(
                `${baseURL}/message/${type}/${instanceName}`,
                {
                    number: to,
                    [type]: file,
                },
                {
                    headers: {
                        apikey: apiKey,
                    },
                }
            )
        } catch (error) {
            console.error(`Error sending ${type}:`, error)
            throw error
        }
    }

    // async sendButtons(to: string, buttons: Button[] = [], text: string): Promise<any> {
    //     try {
    //         const { baseURL, instanceName, apiKey } = this.globalVendorArgs

    //         return await axios.post(
    //             `${baseURL}/message/buttons/${instanceName}`,
    //             {
    //                 number: to,
    //                 buttons: buttons.map(btn => ({
    //                     buttonText: btn.body,
    //                     buttonId: btn.id
    //                 })),
    //                 text
    //             },
    //             {
    //                 headers: {
    //                     'apikey': apiKey
    //                 }
    //             }
    //         )
    //     } catch (error) {
    //         console.error('Error sending buttons:', error)
    //         throw error
    //     }
    // }

    async sendList(to: string, list: any): Promise<any> {
        try {
            const { baseURL, instanceName, apiKey } = this.globalVendorArgs

            return await axios.post(
                `${baseURL}/message/list/${instanceName}`,
                {
                    number: to,
                    list,
                },
                {
                    headers: {
                        apikey: apiKey,
                    },
                }
            )
        } catch (error) {
            console.error('Error sending list:', error)
            throw error
        }
    }

    async sendListComplete(to: string, list: any): Promise<any> {
        return this.sendList(to, list)
    }

    async saveFile(ctx: Partial<Message & BotContext>, options: SaveFileOptions = {}): Promise<string> {
        // try {
        //     // Download the file from the URL
        //     const buffer = await utils.downloadFile(ctx.url)

        //     // Generate filename using timestamp and mime type from file data
        //     const fileName = `file-${Date.now()}.${ctx.fileData?.mime_type?.split('/')[1] || 'tmp'}`

        //     // Create full path by joining target directory with filename
        //     const pathFile = join(options?.path ?? tmpdir(), fileName)

        //     // Write buffer to file
        //     await writeFile(pathFile, buffer)

        //     // Return resolved absolute path
        //     return resolve(pathFile)
        // } catch (err) {
        //     console.error(`[Error saving file]:`, err.message)
        //     return 'ERROR'
        // }

        return ''
    }

    // async sendLocation(to: string, lat: string, long: string): Promise<any> {
    //     const { baseURL, instanceName, apiKey } = this.globalVendorArgs

    //     try {
    //         return await axios.post(
    //             `${baseURL}/message/sendLocation/${instanceName}`,
    //             {
    //                 number: to,
    //                 lat,
    //                 long
    //             },
    //             {
    //                 headers: {
    //                     'apikey': apiKey
    //                 }
    //             }
    //         )
    //     } catch (error) {
    //         console.error('Error sending location:', error)
    //         throw error
    //     }
    // }

    // async sendContact(to: string, contact: Contact): Promise<any> {
    //     const { baseURL, instanceName, apiKey } = this.globalVendorArgs

    //     try {
    //         return await axios.post(
    //             `${baseURL}/message/contact/${instanceName}`,
    //             {
    //                 number: to,
    //                 contact
    //             },
    //             {
    //                 headers: {
    //                     'apikey': apiKey
    //                 }
    //             }
    //         )
    //     } catch (error) {
    //         console.error('Error sending contact:', error)
    //         throw error
    //     }
    // }

    // async sendReaction(to: string, message: string): Promise<any> {
    //     const { baseURL, instanceName, apiKey } = this.globalVendorArgs

    //     try {
    //         return await axios.post(
    //             `${baseURL}/message/reaction/${instanceName}`,
    //             {
    //                 number: to,
    //                 reaction: message
    //             },
    //             {
    //                 headers: {
    //                     'apikey': apiKey
    //                 }
    //             }
    //         )
    //     } catch (error) {
    //         console.error('Error sending reaction:', error)
    //         throw error
    //     }
    // }

    // Métodos auxiliares requeridos por la interfaz
    sendMessageMeta = (body: any): Promise<any> => {
        return new Promise((resolve) =>
            this.queue.add(async () => {
                const resp = await this.sendMessageToApi(body)
                resolve(resp)
            })
        )
    }

    sendMessageToApi = async (body: any): Promise<any> => {
        const { baseURL, instanceName, apiKey } = this.globalVendorArgs

        try {
            const response = await axios.post(`${baseURL}/message/sendText/${instanceName}`, body, {
                headers: {
                    apikey: apiKey,
                },
            })
            return response.data
        } catch (error) {
            console.error('Error sending message:', error)
            throw error
        }
    }
}

export { EvolutionProvider }
