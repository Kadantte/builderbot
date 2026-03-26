import type { CoreClass } from '@builderbot/bot'

import { ChatwootApi } from './chatwootApi'
import type { ChatwootInbox, ChatwootPluginConfig } from './types'

const DEFAULT_INBOX_NAME = 'BuilderBot Inbox'

class ChatwootPlugin {
    private api: ChatwootApi
    private config: ChatwootPluginConfig
    private inbox: ChatwootInbox | null = null
    private conversationCache = new Map<string, number>()
    private contactCache = new Map<string, number>()

    constructor(config: ChatwootPluginConfig) {
        this.config = config
        this.api = new ChatwootApi(config)
    }

    /**
     * Conecta el plugin al bot. Una sola línea y listo.
     *
     * ```ts
     * const bot = await createBot({ flow, provider, database })
     * await chatwoot.attach(bot)
     * ```
     */
    async attach(bot: CoreClass): Promise<void> {
        const inboxName = this.config.inboxName ?? DEFAULT_INBOX_NAME
        this.inbox = await this.api.findOrCreateInbox(inboxName)
        console.log(`[Chatwoot] Inbox "${this.inbox.name}" ready (id: ${this.inbox.id})`)

        bot.on('send_message', async (payload) => {
            try {
                const { from, answer } = payload
                if (!from || !answer) return

                const content = Array.isArray(answer) ? answer.join('\n') : String(answer)
                if (!content || content.startsWith('__')) return

                const conversationId = await this.resolveConversation(from)
                await this.api.sendMessage(conversationId, content, 'outgoing')
            } catch (err) {
                console.error('[Chatwoot] Error syncing outgoing message:', err)
            }
        })

        bot.provider.on('message', async (payload: { from: string; body: string; name?: string }) => {
            try {
                const { from, body, name } = payload
                if (!from || !body) return

                const conversationId = await this.resolveConversation(from, name)
                await this.api.sendMessage(conversationId, body, 'incoming')
            } catch (err) {
                console.error('[Chatwoot] Error syncing incoming message:', err)
            }
        })

        console.log(`[Chatwoot] Plugin attached successfully`)
    }

    /**
     * Resuelve (o crea) el contacto y la conversación en Chatwoot para un número dado.
     */
    private async resolveConversation(phone: string, name?: string): Promise<number> {
        const cached = this.conversationCache.get(phone)
        if (cached) return cached

        let contactId = this.contactCache.get(phone)
        if (!contactId) {
            const contact = await this.api.findOrCreateContact(phone, name)
            if (!contact?.id) throw new Error(`[Chatwoot] Could not resolve contact for ${phone}`)
            contactId = contact.id
            this.contactCache.set(phone, contactId)
        }

        if (!this.inbox) throw new Error('[Chatwoot] Plugin not attached yet. Call attach() first.')
        const conversation = await this.api.findOrCreateConversation(contactId, this.inbox.id)
        this.conversationCache.set(phone, conversation.id)

        return conversation.id
    }

    /**
     * Acceso directo a la API de Chatwoot para operaciones avanzadas.
     */
    getApi(): ChatwootApi {
        return this.api
    }

    /**
     * Retorna el inbox creado por el plugin.
     */
    getInbox(): ChatwootInbox | null {
        return this.inbox
    }
}

/**
 * Crea una instancia del plugin de Chatwoot.
 *
 * ```ts
 * const chatwoot = createChatwootPlugin({
 *     token: 'tu-token',
 *     url: 'https://app.chatwoot.com',
 *     accountId: 1,
 * })
 *
 * const bot = await createBot({ flow, provider, database })
 * await chatwoot.attach(bot)
 * ```
 */
const createChatwootPlugin = (config: ChatwootPluginConfig): ChatwootPlugin => {
    return new ChatwootPlugin(config)
}

export { ChatwootPlugin, createChatwootPlugin }
