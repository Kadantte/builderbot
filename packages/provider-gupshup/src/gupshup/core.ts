import EventEmitter from 'node:events'
import type polka from 'polka'

import { GupshupGlobalVendorArgs } from '../types'
import { processIncomingMessage } from '../utils/processIncomingMsg'

export class GupshupCoreVendor extends EventEmitter {
    constructor(private args: GupshupGlobalVendorArgs) {
        super()
    }

    public incomingMsg: polka.Middleware = async (req: any, res: any) => {
        try {
            const body = req.body
            // Gupshup envía eventos 'message' o 'messge-event' (status)
            if (body.type !== 'message') {
                res.end('OK')
                return
            }

            // Normalizar
            const botContext = await processIncomingMessage(body, this.args)
            if (botContext) {
                this.emit('message', botContext)
            }

            res.statusCode = 200
            res.end('OK')
        } catch (e) {
            console.error('Webhook Error:', e)
            res.statusCode = 500
            res.end('Error')
        }
    }
}
