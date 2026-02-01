import axios from 'axios'

import type { GHLContactSearchResult } from '~/types'

const GHL_API_URL = 'https://services.leadconnectorhq.com'

export class ContactResolver {
    private cache: Map<string, { contactId: string; expiresAt: number }> = new Map()
    private cacheTTL: number = 300000 // 5 minutes

    async resolveContactId(
        phone: string,
        locationId: string,
        token: string
    ): Promise<string | null> {
        const cacheKey = `${locationId}:${phone}`
        const cached = this.cache.get(cacheKey)
        if (cached && cached.expiresAt > Date.now()) {
            return cached.contactId
        }

        try {
            const response = await axios.get<GHLContactSearchResult>(
                `${GHL_API_URL}/contacts/`,
                {
                    params: {
                        locationId,
                        query: phone,
                    },
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Version: '2021-07-28',
                    },
                }
            )

            const contacts = response.data?.contacts ?? []
            if (contacts.length === 0) return null

            const contact = contacts.find((c) => {
                const contactPhone = c.phone?.replace(/\+/g, '').replace(/\s/g, '').replace(/-/g, '')
                const searchPhone = phone.replace(/\+/g, '').replace(/\s/g, '').replace(/-/g, '')
                return contactPhone === searchPhone
            }) ?? contacts[0]

            this.cache.set(cacheKey, {
                contactId: contact.id,
                expiresAt: Date.now() + this.cacheTTL,
            })

            return contact.id
        } catch (error) {
            console.error(`[GoHighLevel] Error resolving contactId for ${phone}:`, error.message)
            return null
        }
    }

    clearCache(): void {
        this.cache.clear()
    }
}
