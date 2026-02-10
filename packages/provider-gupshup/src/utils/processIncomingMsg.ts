import { utils } from '@builderbot/bot'
import { BotContext } from '@builderbot/bot/dist/types'

import { GupshupIncomingMessage, GupshupGlobalVendorArgs } from '../types'

export const processIncomingMessage = async (
    raw: GupshupIncomingMessage,
    args: GupshupGlobalVendorArgs
): Promise<BotContext> => {
    const { payload } = raw
    const from = payload.source
    const name = payload.sender.name || from // Fallback

    let body = ''
    let url = ''

    switch (payload.type) {
        case 'text':
            body = payload.payload.text
            break

        case 'image':
            body = utils.generateRefProvider('_event_media_')
            url = payload.payload.url
            break

        case 'file':
        case 'document': // Gupshup a veces usa 'file'
            body = utils.generateRefProvider('_event_document_')
            url = payload.payload.url
            break

        case 'audio':
            body = utils.generateRefProvider('_event_voice_note_')
            url = payload.payload.url
            break

        case 'location':
            body = utils.generateRefProvider('_event_location_')
            // Agregar lat/long al contexto si es necesario
            break

        default:
            console.log(`[Gupshup] Unhandled message type: ${payload.type}`)
            return null
    }

    return {
        from,
        name,
        body,
        url,
        // Host info
        host: {
            phone: args.phoneNumber,
        },
    }
}
