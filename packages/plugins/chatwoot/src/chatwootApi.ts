import type {
    ChatwootContact,
    ChatwootConversation,
    ChatwootInbox,
    ChatwootMessage,
    ChatwootPluginConfig,
    ChatwootSearchContactsPayload,
} from './types'

class ChatwootApi {
    private baseUrl: string
    private headers: Record<string, string>
    private accountId: number

    constructor(config: ChatwootPluginConfig) {
        this.baseUrl = `${config.url.replace(/\/$/, '')}/api/v1/accounts/${config.accountId}`
        this.accountId = config.accountId
        this.headers = {
            'Content-Type': 'application/json',
            api_access_token: config.token,
        }
    }

    /**
     * Crea un inbox tipo API channel en Chatwoot.
     * Si ya existe uno con el mismo nombre, lo retorna.
     */
    async findOrCreateInbox(name: string): Promise<ChatwootInbox> {
        const existing = await this.listInboxes()
        const found = existing.find((inbox) => inbox.name === name)
        if (found) return found

        const response = await fetch(`${this.baseUrl}/inboxes`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                name,
                channel: {
                    type: 'api',
                    webhook_url: '',
                },
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`[Chatwoot] Error creating inbox: ${error}`)
        }

        return (await response.json()) as ChatwootInbox
    }

    /**
     * Lista todos los inboxes de la cuenta.
     */
    async listInboxes(): Promise<ChatwootInbox[]> {
        const response = await fetch(`${this.baseUrl}/inboxes`, {
            method: 'GET',
            headers: this.headers,
        })

        if (!response.ok) return []

        const data = (await response.json()) as { payload: ChatwootInbox[] }
        return data?.payload ?? []
    }

    /**
     * Busca un contacto por teléfono. Si no existe, lo crea.
     */
    async findOrCreateContact(phone: string, name?: string): Promise<ChatwootContact> {
        const found = await this.searchContacts(phone)
        if (found) return found

        return this.createContact(phone, name)
    }

    /**
     * Busca contactos por query (teléfono, nombre, email).
     */
    async searchContacts(query: string): Promise<ChatwootContact | null> {
        const response = await fetch(`${this.baseUrl}/contacts/search?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: this.headers,
        })

        if (!response.ok) return null

        const data = (await response.json()) as ChatwootSearchContactsPayload
        return data?.payload?.[0] ?? null
    }

    /**
     * Crea un nuevo contacto en Chatwoot.
     */
    async createContact(phone: string, name?: string): Promise<ChatwootContact> {
        const response = await fetch(`${this.baseUrl}/contacts`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                name: name ?? phone,
                phone_number: phone.startsWith('+') ? phone : `+${phone}`,
                identifier: phone,
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`[Chatwoot] Error creating contact: ${error}`)
        }

        const data = (await response.json()) as { payload: { contact: ChatwootContact } }
        return data?.payload?.contact ?? (data as unknown as ChatwootContact)
    }

    /**
     * Busca una conversación abierta para un contacto en un inbox.
     * Si no existe, crea una nueva.
     */
    async findOrCreateConversation(contactId: number, inboxId: number): Promise<ChatwootConversation> {
        const existing = await this.getContactConversations(contactId)
        const open = existing.find((conv) => conv.inbox_id === inboxId && conv.status !== 'resolved')
        if (open) return open

        return this.createConversation(contactId, inboxId)
    }

    /**
     * Obtiene las conversaciones de un contacto.
     */
    async getContactConversations(contactId: number): Promise<ChatwootConversation[]> {
        const response = await fetch(`${this.baseUrl}/contacts/${contactId}/conversations`, {
            method: 'GET',
            headers: this.headers,
        })

        if (!response.ok) return []

        const data = (await response.json()) as { payload: ChatwootConversation[] }
        return data?.payload ?? []
    }

    /**
     * Crea una nueva conversación en Chatwoot.
     */
    async createConversation(contactId: number, inboxId: number): Promise<ChatwootConversation> {
        const response = await fetch(`${this.baseUrl}/conversations`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                contact_id: contactId,
                inbox_id: inboxId,
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`[Chatwoot] Error creating conversation: ${error}`)
        }

        return (await response.json()) as ChatwootConversation
    }

    /**
     * Envía un mensaje a una conversación de Chatwoot.
     */
    async sendMessage(
        conversationId: number,
        content: string,
        messageType: 'incoming' | 'outgoing' = 'incoming'
    ): Promise<ChatwootMessage> {
        const response = await fetch(`${this.baseUrl}/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                content,
                message_type: messageType,
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`[Chatwoot] Error sending message: ${error}`)
        }

        return (await response.json()) as ChatwootMessage
    }
}

export { ChatwootApi }
