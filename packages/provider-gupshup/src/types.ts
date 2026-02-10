import { GlobalVendorArgs } from '@builderbot/bot/dist/types'

export interface GupshupGlobalVendorArgs extends GlobalVendorArgs {
    apiKey: string
    srcName: string // Nombre de la App en Gupshup
    phoneNumber: string // Número origen (Source)
}

export interface GupshupIncomingMessage {
    type: 'message' | 'message-event' | 'user-event'
    payload: {
        id: string
        source: string // Teléfono Origen
        type: 'text' | 'image' | 'file' | 'document' | 'audio' | 'video' | 'contact' | 'location'
        payload: {
            text?: string
            url?: string
            caption?: string
            latitude?: string
            longitude?: string
        }
        sender: {
            phone: string
            name: string
            country_code: string
            dial_code: string
        }
        timestamp: string
    }
    app: string
    timestamp: number
}
