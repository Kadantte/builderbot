import type { SendOptions, BotContext, Button } from '@builderbot/bot/dist/types'
import type polka from 'polka'

import type { TextMessageBody, Reaction, Localization, Message, SaveFileOptions, MetaList } from '~/types'

export interface EvolutionInterface {
    indexHome?: polka.Middleware
    // Queue related methods that are used in the implementation
    sendMessageMeta: (body: any) => Promise<any>
    sendMessageToApi: (body: any) => Promise<any>

    // Message sending methods
    sendMessage: <K = any>(to: string, message: string, args?: any) => Promise<K>
    sendText: (to: string, message: string, context?: string | null) => Promise<any>
    sendImage: (to: string, mediaInput: string, caption?: string, context?: string | null) => Promise<any>
    sendImageUrl: (to: string, url: string, mediaName?: string, caption?: string) => Promise<any>
    sendVideo: (to: string, mediaUrl: string, mediaName?: string, caption?: string) => Promise<any>
    sendVideoUrl: (to: string, url: string, mediaName?: string, caption?: string) => Promise<any>
    sendAudio: (to: string, mediaUrl: string, mediaName?: string, caption?: string) => Promise<any>
    sendAudioUrl: (to: string, url: string, mediaName?: string, caption?: string) => Promise<any>
    sendMedia: (to: string, file: string, type: string) => Promise<any>
    sendList: (to: string, list: any) => Promise<any>
    sendListComplete: (to: string, list: any) => Promise<any>

    // File handling
    saveFile: (ctx: Partial<Message & BotContext>, options?: SaveFileOptions) => Promise<string>

    // Additional methods that could be implemented in the future
    // sendButtons: (to: string, buttons: Button[], text: string) => Promise<any>
    // sendButtonUrl: (to: string, button: Button & { url: string }, text: string) => Promise<any>
    // sendButtonsMedia: (
    //     to: string,
    //     media_type: string,
    //     buttons: Button[],
    //     text: string,
    //     mediaInput: string
    // ) => Promise<any>
    // sendTemplate: (to: string, template: string, languageCode: string, components: Record<string, any>) => Promise<any>
    // sendFlow: (
    //     to: string,
    //     headerText: string,
    //     bodyText: string,
    //     footerText: string,
    //     flowMessageVer: string,
    //     flowAction: string,
    //     flowID: string,
    //     flowToken: string,
    //     flowCta: string,
    //     isDraftFlow: boolean,
    //     screenName: string,
    //     data: Record<string, any>
    // ) => Promise<void>
    // sendContacts: (to: string, contact: any[]) => Promise<any>
    // sendCatalog: (number: any, bodyText: any, itemCatalogId: any) => Promise<any>
    // sendReaction: (number: string, react: Reaction) => Promise<any>
    // sendLocation: (to: string, localization: Localization, context: string | null) => Promise<any>
    // sendLocationRequest: (to: string, bodyText: string, context: string | null) => Promise<any>
    // sendFile: (to: string, mediaInput: string | null, caption: string, context: string | null) => Promise<any>
}
