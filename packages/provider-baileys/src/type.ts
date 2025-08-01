import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'
import { proto, WABrowserDescription, WAVersion } from '@leifermendez/baileys'
export type { WABrowserDescription, WAVersion }
export interface BaileyGlobalVendorArgs extends GlobalVendorArgs {
    gifPlayback: boolean
    usePairingCode: boolean
    phoneNumber: string | null
    browser: WABrowserDescription | string[]
    experimentalSyncMessage?: string
    fallBackAction?: (ctx: proto.IWebMessageInfo) => Promise<void>
    useBaileysStore: boolean
    timeRelease?: number
    experimentalStore?: boolean
    groupsIgnore: boolean
    readStatus: boolean
    version?: WAVersion | number[] //
    autoRefresh?: number
    host?: any
}
