import { ProviderClass, utils } from '@builderbot/bot'
import { Vendor } from '@builderbot/bot/dist/provider/interface/provider'
import { BotContext, SendOptions } from '@builderbot/bot/dist/types'
import axios, { AxiosInstance } from 'axios'

import { GupshupCoreVendor } from './core'
import { GupshupGlobalVendorArgs } from '../types'

export class GupshupProvider extends ProviderClass<GupshupCoreVendor> {
    public vendor: Vendor<GupshupCoreVendor>
    public globalVendorArgs: GupshupGlobalVendorArgs = {
        name: 'bot',
        port: 3000,
        apiKey: '',
        srcName: '', // App Name en Gupshup
        phoneNumber: '',
    }
    private http: AxiosInstance

    constructor(args: GupshupGlobalVendorArgs) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }

        // Cliente HTTP pre-configurado para Gupshup
        this.http = axios.create({
            baseURL: 'https://api.gupshup.io/wa/api/v1',
            headers: {
                apikey: this.globalVendorArgs.apiKey,
                'Content-Type': 'application/x-www-form-urlencoded', // Gupshup a veces prefiere URLEncoded
            },
        })
    }

    protected beforeHttpServerInit(): void {
        // Rutas del Webhook
        this.server = this.server
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .post('/webhook', this.vendor.incomingMsg)
    }

    protected async afterHttpServerInit(): Promise<void> {
        try {
            // Verificación simple: Intentar obtener templates (u otro endpoint de lectura)
            // Para validar credenciales. Si no, solo emitir ready.
            this.emit('ready')
            this.emit('notice', {
                title: '🟢 Gupshup Provider Ready',
                instructions: ['Webhook URI: /webhook'],
            })
        } catch (error) {
            console.error(error)
        }
    }

    protected initVendor(): Promise<GupshupCoreVendor> {
        const vendor = new GupshupCoreVendor(this.globalVendorArgs)
        this.vendor = vendor
        return Promise.resolve(vendor)
    }

    protected busEvents = () => [
        { event: 'message', func: (payload: BotContext) => this.emit('message', payload) },
        { event: 'notice', func: (p: any) => this.emit('notice', p) },
    ]

    /**
     * Enviar Mensaje (Entrypoint principal)
     */
    public sendMessage = async (to: string, message: string, options?: SendOptions): Promise<any> => {
        if (options?.buttons?.length) return this.sendButtons(to, message, options.buttons)
        if (options?.media) return this.sendMedia(to, message, options.media)

        return this.sendText(to, message)
    }

    public saveFile = async (ctx: any, options?: { path: string }): Promise<string> => {
        // Implementación genérica de descarga
        return 'NOT_IMPLEMENTED_YET'
    }

    // --- Métodos de Envío Específicos para Gupshup ---

    /**
     * NOTA SOBRE EL CONTENIDO:
     * Gupshup requiere estrictamente 'application/x-www-form-urlencoded' para este endpoint.
     * Aunque el contenido parece JSON, debe enviarse como string dentro del campo 'message'.
     */
    private async sendText(to: string, text: string) {
        // Payload Cloud API style
        const body = new URLSearchParams()
        body.append('channel', 'whatsapp')
        body.append('source', this.globalVendorArgs.phoneNumber)
        body.append('destination', to)
        body.append('src.name', this.globalVendorArgs.srcName)
        body.append(
            'message',
            JSON.stringify({
                isHSM: 'false',
                type: 'text',
                text: text,
            })
        )

        // O SI USAS LA NUEVA API V1 (/msg):
        // const payload = {
        //    messaging_product: "whatsapp",
        //    recipient_type: "individual",
        //    to: to,
        //    type: "text",
        //    text: { body: text }
        // }
        // Nota: Gupshup tiene endpoints polimórficos. Usaremos el URL form encoded que es el más estable en Gupshup v1.

        const response = await this.http.post('/msg', body)
        return response.data
    }

    private async sendMedia(to: string, caption: string, url: string) {
        const body = new URLSearchParams()
        body.append('channel', 'whatsapp')
        body.append('source', this.globalVendorArgs.phoneNumber)
        body.append('destination', to)
        body.append('src.name', this.globalVendorArgs.srcName)
        body.append(
            'message',
            JSON.stringify({
                isHSM: 'false',
                type: 'image', // Detectar mime type real
                originalUrl: url,
                previewUrl: url,
                caption: caption,
            })
        )

        const response = await this.http.post('/msg', body)
        return response.data
    }

    private async sendButtons(to: string, text: string, buttons: any[]) {
        // Gupshup usa formato específico para botones (Quick Reply)
        // Adaptar payload aquí
        return Promise.resolve({ error: 'Buttons not implemented yet for Gupshup' })
    }
}
