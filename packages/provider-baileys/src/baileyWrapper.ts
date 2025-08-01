import {
    useMultiFileAuthState,
    DisconnectReason,
    proto,
    makeCacheableSignalKeyStore,
    getAggregateVotesInPollMessage,
    WASocket,
    BaileysEventMap,
    AnyMediaMessageContent,
    AnyMessageContent,
    PollMessageOptions,
    downloadMediaMessage,
    WAMessage,
    MessageUpsertType,
    isJidGroup,
    isJidBroadcast,
} from '@leifermendez/baileys'

const makeWASocketOther = require('@leifermendez/baileys').default

export {
    makeWASocketOther,
    useMultiFileAuthState,
    DisconnectReason,
    proto,
    makeCacheableSignalKeyStore,
    getAggregateVotesInPollMessage,
    WASocket,
    BaileysEventMap,
    AnyMediaMessageContent,
    AnyMessageContent,
    PollMessageOptions,
    downloadMediaMessage,
    WAMessage,
    MessageUpsertType,
    isJidGroup,
    isJidBroadcast,
}
