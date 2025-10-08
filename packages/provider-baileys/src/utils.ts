import { utils } from '@builderbot/bot'
import type { WriteStream } from 'fs'
import { createWriteStream } from 'fs'
import { emptyDir } from 'fs-extra'
import * as qr from 'qr-image'

const emptyDirSessions = async (pathBase: string) =>
    new Promise((resolve, reject) => {
        emptyDir(pathBase, (err) => {
            if (err) reject(err)
            resolve(true)
        })
    })

/**
 * Cleans and extracts the appropriate identifier from MessageKey, supporting LID system.
 * Uses remoteJidAlt/participantAlt when available according to Baileys v7.0.0+ specs.
 * @param key The MessageKey object from Baileys with LID support
 * @returns The appropriate identifier (PN or LID)
 */
function baileyCleanNumberWithLid(key: {
    senderPn?: string
    remoteJid?: string
    remoteJidAlt?: string
    participantAlt?: string
    participant?: string
}): string {
    // For groups: use participantAlt if available, fallback to participant
    if (key.participant || key.participantAlt) {
        const groupParticipant = key.participantAlt || key.participant
        return groupParticipant || ''
    }

    // For DMs: use remoteJidAlt if available, fallback to remoteJid
    if (key.remoteJid || key.remoteJidAlt) {
        const directMessage = key.remoteJidAlt || key.remoteJid

        // If we have a LID and senderPn is available, prefer the PN for compatibility
        if (directMessage?.includes('@lid') && key.senderPn) {
            return key.senderPn
        }

        return directMessage || ''
    }

    return ''
}

/**
 * Cleans the WhatsApp number format, supporting both LIDs and PNs.
 * @param number The WhatsApp number/LID to be cleaned.
 * @param full Whether to return the full number format or not.
 * @returns The cleaned number or LID.
 */
const baileyCleanNumber = (number: string, full: boolean = false): string => {
    // Handle group chats - return as is
    const regexGroup: RegExp = /\@g.us\b/gm
    const existGroup = number.match(regexGroup)
    if (existGroup) return number

    // Handle LIDs - return as is since they should be preserved
    if (number.includes('@lid')) {
        return number
    }

    // Handle PNs (Phone Numbers) - traditional format
    if (number.includes('@s.whatsapp.net')) {
        if (full) {
            return number.replace('@s.whatsapp.net', '').replace('+', '').replace(/\s/g, '')
        }
        return number
    }

    // Clean and format as PN if it's a raw phone number
    const cleanedNumber = number.replace('+', '').replace(/\s/g, '')
    return full ? cleanedNumber : `${cleanedNumber}@s.whatsapp.net`
}

/**
 * Generates an image from a base64 string.
 * @param base64 The base64 string to generate the image from.
 * @param name The name of the file to write the image to.
 */
const baileyGenerateImage = async (base64: string, name: string = 'qr.png'): Promise<void> => {
    const PATH_QR: string = `${process.cwd()}/${name}`
    const qr_svg = qr.image(base64, { type: 'png', margin: 4 })

    const writeFilePromise = (): Promise<boolean> =>
        new Promise((resolve, reject) => {
            const file: WriteStream = qr_svg.pipe(createWriteStream(PATH_QR))
            file.on('finish', () => resolve(true))
            file.on('error', reject)
        })

    await writeFilePromise()
    await utils.cleanImage(PATH_QR)
}

/**
 * Validates if the given identifier is a valid WhatsApp user identifier (PN or LID) and not a group ID.
 * Compatible with Baileys v7.0.0+ LID system.
 * @param rawIdentifier The identifier to validate (PN, LID, or other)
 * @returns True if it's a valid user identifier, false otherwise
 */
const baileyIsValidNumber = (rawIdentifier: string): boolean => {
    if (!rawIdentifier || typeof rawIdentifier !== 'string') {
        return false
    }

    // Exclude group chats
    const regexGroup: RegExp = /\@g.us\b/gm
    const isGroup = rawIdentifier.match(regexGroup)
    if (isGroup) return false

    // Exclude broadcast lists
    if (rawIdentifier.includes('@broadcast')) return false

    // Accept LIDs (Local Identifiers) - preferred format
    if (rawIdentifier.includes('@lid')) return true

    // Accept PNs (Phone Numbers) - legacy format but still valid
    if (rawIdentifier.includes('@s.whatsapp.net')) return true

    // For raw numbers, consider them valid if they look like phone numbers
    const cleanNumber = rawIdentifier.replace(/\D/g, '') // Remove non-digits
    return cleanNumber.length >= 10 && cleanNumber.length <= 15 // Reasonable phone number length
}

/**
 * Gets the LID (Local Identifier) for a given PN (Phone Number).
 * @param lidStore The LID mapping store from sock.signalRepository.lidMapping
 * @param phoneNumber The phone number to get LID for
 * @returns The LID if found, null otherwise
 */
const baileyGetLIDFromPN = async (lidStore: any, phoneNumber: string): Promise<string | null> => {
    try {
        if (!lidStore || !lidStore.getLIDForPN) {
            console.warn('LID store not available or getLIDForPN method missing')
            return null
        }
        const lid = await lidStore.getLIDForPN(phoneNumber)
        return lid || null
    } catch (error) {
        console.error('Error getting LID from PN:', error)
        return null
    }
}

/**
 * Gets the PN (Phone Number) for a given LID (Local Identifier).
 * @param lidStore The LID mapping store from sock.signalRepository.lidMapping
 * @param lid The LID to get phone number for
 * @returns The phone number if found, null otherwise
 */
const baileyGetPNFromLID = async (lidStore: any, lid: string): Promise<string | null> => {
    try {
        if (!lidStore || !lidStore.getPNForLID) {
            console.warn('LID store not available or getPNForLID method missing')
            return null
        }
        const phoneNumber = await lidStore.getPNForLID(lid)
        return phoneNumber || null
    } catch (error) {
        console.error('Error getting PN from LID:', error)
        return null
    }
}

/**
 * Gets multiple LIDs for given PNs (Phone Numbers).
 * @param lidStore The LID mapping store from sock.signalRepository.lidMapping
 * @param phoneNumbers Array of phone numbers to get LIDs for
 * @returns Object mapping phone numbers to their LIDs
 */
const baileyGetLIDsFromPNs = async (lidStore: any, phoneNumbers: string[]): Promise<Record<string, string>> => {
    try {
        if (!lidStore || !lidStore.getLIDsForPNs) {
            console.warn('LID store not available or getLIDsForPNs method missing')
            return {}
        }
        const lids = await lidStore.getLIDsForPNs(phoneNumbers)
        return lids || {}
    } catch (error) {
        console.error('Error getting LIDs from PNs:', error)
        return {}
    }
}

/**
 * Stores a single LID-PN mapping in the store.
 * @param lidStore The LID mapping store from sock.signalRepository.lidMapping
 * @param lid The Local Identifier
 * @param phoneNumber The Phone Number
 * @returns Promise<void>
 */
const baileyStoreLIDPNMapping = async (lidStore: any, lid: string, phoneNumber: string): Promise<void> => {
    try {
        if (!lidStore || !lidStore.storeLIDPNMapping) {
            console.warn('LID store not available or storeLIDPNMapping method missing')
            return
        }
        await lidStore.storeLIDPNMapping(lid, phoneNumber)
    } catch (error) {
        console.error('Error storing LID-PN mapping:', error)
    }
}

/**
 * Stores multiple LID-PN mappings in the store.
 * @param lidStore The LID mapping store from sock.signalRepository.lidMapping
 * @param mappings Object with LID-PN mappings
 * @returns Promise<void>
 */
const baileyStoreLIDPNMappings = async (lidStore: any, mappings: Record<string, string>): Promise<void> => {
    try {
        if (!lidStore || !lidStore.storeLIDPNMappings) {
            console.warn('LID store not available or storeLIDPNMappings method missing')
            return
        }
        await lidStore.storeLIDPNMappings(mappings)
    } catch (error) {
        console.error('Error storing LID-PN mappings:', error)
    }
}

/**
 * Determines if a JID is a LID (Local Identifier).
 * @param jid The JID to check
 * @returns True if it's a LID, false otherwise
 */
const baileyIsLID = (jid: string): boolean => {
    return jid.includes('@lid')
}

/**
 * Determines if a JID is a PN (Phone Number).
 * @param jid The JID to check
 * @returns True if it's a PN, false otherwise
 */
const baileyIsPN = (jid: string): boolean => {
    return jid.includes('@s.whatsapp.net')
}

export {
    baileyCleanNumber,
    baileyGenerateImage,
    baileyIsValidNumber,
    emptyDirSessions,
    baileyCleanNumberWithLid,
    baileyGetLIDFromPN,
    baileyGetPNFromLID,
    baileyGetLIDsFromPNs,
    baileyStoreLIDPNMapping,
    baileyStoreLIDPNMappings,
    baileyIsLID,
    baileyIsPN,
}
