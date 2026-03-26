/**
 * Configuración principal del plugin de Chatwoot.
 * Solo necesitas `token`, `url` y `accountId` para empezar.
 */
export interface ChatwootPluginConfig {
    /** API access token de Chatwoot (User o Agent token) */
    token: string
    /** URL base de tu instancia de Chatwoot (ej: https://app.chatwoot.com) */
    url: string
    /** ID de la cuenta en Chatwoot */
    accountId: number
    /** Nombre del inbox que se creará automáticamente (default: 'BuilderBot Inbox') */
    inboxName?: string
}

export interface ChatwootContact {
    id?: number
    name?: string
    phone_number?: string
    email?: string
    identifier?: string
}

export interface ChatwootConversation {
    id: number
    inbox_id: number
    contact_id: number
    status?: string
    account_id?: number
}

export interface ChatwootInbox {
    id: number
    name: string
    channel_type?: string
    webhook_url?: string
}

export interface ChatwootMessage {
    id?: number
    content: string
    message_type: 'incoming' | 'outgoing'
    content_type?: string
    private?: boolean
}

export interface ChatwootApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
}

export interface ChatwootSearchContactsPayload {
    payload: ChatwootContact[]
}

export interface ChatwootConversationsPayload {
    data: {
        payload: ChatwootConversation[]
    }
}
