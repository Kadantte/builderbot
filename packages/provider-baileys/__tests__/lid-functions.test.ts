import {
    baileyCleanNumber,
    baileyCleanNumberWithLid,
    baileyIsValidNumber,
    baileyIsLID,
    baileyIsPN,
    baileyGetLIDFromPN,
    baileyGetPNFromLID,
    baileyGetLIDsFromPNs,
    baileyStoreLIDPNMapping,
    baileyStoreLIDPNMappings,
} from '../src/utils'

describe('LID Functions - Baileys v7.0.0+ Compatibility', () => {
    describe('baileyCleanNumber', () => {
        it('should preserve LIDs as-is', () => {
            const lid = 'user123@lid'
            expect(baileyCleanNumber(lid)).toBe('user123@lid')
            expect(baileyCleanNumber(lid, true)).toBe('user123@lid')
        })

        it('should preserve group chats as-is', () => {
            const group = '1234567890@g.us'
            expect(baileyCleanNumber(group)).toBe('1234567890@g.us')
            expect(baileyCleanNumber(group, true)).toBe('1234567890@g.us')
        })

        it('should handle PNs correctly', () => {
            const pn = '1234567890@s.whatsapp.net'
            expect(baileyCleanNumber(pn)).toBe('1234567890@s.whatsapp.net')
            expect(baileyCleanNumber(pn, true)).toBe('1234567890')
        })

        it('should format raw phone numbers as PNs', () => {
            expect(baileyCleanNumber('1234567890')).toBe('1234567890@s.whatsapp.net')
            expect(baileyCleanNumber('1234567890', true)).toBe('1234567890')
            expect(baileyCleanNumber('+1234567890')).toBe('1234567890@s.whatsapp.net')
            expect(baileyCleanNumber('+1234567890', true)).toBe('1234567890')
        })

        it('should remove spaces from phone numbers', () => {
            expect(baileyCleanNumber('+1 234 567 890')).toBe('1234567890@s.whatsapp.net')
            expect(baileyCleanNumber('1 234 567 890', true)).toBe('1234567890')
        })
    })

    describe('baileyIsValidNumber', () => {
        it('should validate LIDs as valid', () => {
            expect(baileyIsValidNumber('user123@lid')).toBe(true)
            expect(baileyIsValidNumber('abc456@lid')).toBe(true)
        })

        it('should validate PNs as valid', () => {
            expect(baileyIsValidNumber('1234567890@s.whatsapp.net')).toBe(true)
            expect(baileyIsValidNumber('9876543210@s.whatsapp.net')).toBe(true)
        })

        it('should validate reasonable phone numbers as valid', () => {
            expect(baileyIsValidNumber('1234567890')).toBe(true)
            expect(baileyIsValidNumber('+1234567890')).toBe(true)
            expect(baileyIsValidNumber('12345678901234')).toBe(true) // 14 digits
        })

        it('should reject group chats', () => {
            expect(baileyIsValidNumber('1234567890@g.us')).toBe(false)
            expect(baileyIsValidNumber('group@g.us')).toBe(false)
        })

        it('should reject broadcast lists', () => {
            expect(baileyIsValidNumber('status@broadcast')).toBe(false)
            expect(baileyIsValidNumber('list@broadcast')).toBe(false)
        })

        it('should reject invalid inputs', () => {
            expect(baileyIsValidNumber('')).toBe(false)
            expect(baileyIsValidNumber(null as any)).toBe(false)
            expect(baileyIsValidNumber(undefined as any)).toBe(false)
            expect(baileyIsValidNumber('123')).toBe(false) // Too short
            expect(baileyIsValidNumber('1234567890123456')).toBe(false) // Too long
        })
    })

    describe('baileyIsLID', () => {
        it('should correctly identify LIDs', () => {
            expect(baileyIsLID('user123@lid')).toBe(true)
            expect(baileyIsLID('abc456@lid')).toBe(true)
        })

        it('should reject non-LIDs', () => {
            expect(baileyIsLID('1234567890@s.whatsapp.net')).toBe(false)
            expect(baileyIsLID('group@g.us')).toBe(false)
            expect(baileyIsLID('1234567890')).toBe(false)
        })
    })

    describe('baileyIsPN', () => {
        it('should correctly identify PNs', () => {
            expect(baileyIsPN('1234567890@s.whatsapp.net')).toBe(true)
            expect(baileyIsPN('9876543210@s.whatsapp.net')).toBe(true)
        })

        it('should reject non-PNs', () => {
            expect(baileyIsPN('user123@lid')).toBe(false)
            expect(baileyIsPN('group@g.us')).toBe(false)
            expect(baileyIsPN('1234567890')).toBe(false)
        })
    })

    describe('baileyCleanNumberWithLid', () => {
        it('should extract PN from direct messages', () => {
            const messageKey = {
                remoteJid: '1234567890@s.whatsapp.net',
                senderPn: null,
            }
            expect(baileyCleanNumberWithLid(messageKey)).toBe('1234567890@s.whatsapp.net')
        })

        it('should prefer remoteJidAlt over remoteJid for DMs', () => {
            const messageKey = {
                remoteJid: 'user123@lid',
                remoteJidAlt: '5555555555@s.whatsapp.net',
            }
            expect(baileyCleanNumberWithLid(messageKey)).toBe('5555555555@s.whatsapp.net')
        })

        it('should prefer senderPn when remoteJid is a LID', () => {
            const messageKey = {
                remoteJid: 'user123@lid',
                senderPn: '1234567890@s.whatsapp.net',
            }
            expect(baileyCleanNumberWithLid(messageKey)).toBe('1234567890@s.whatsapp.net')
        })

        it('should prefer participantAlt over participant for groups', () => {
            const messageKey = {
                remoteJid: 'group@g.us',
                participant: 'user456@lid',
                participantAlt: '9876543210@s.whatsapp.net',
            }
            expect(baileyCleanNumberWithLid(messageKey)).toBe('9876543210@s.whatsapp.net')
        })

        it('should fallback to participant when participantAlt is not available', () => {
            const messageKey = {
                remoteJid: 'group@g.us',
                participant: 'user456@lid',
            }
            expect(baileyCleanNumberWithLid(messageKey)).toBe('user456@lid')
        })

        it('should return empty string for invalid keys', () => {
            expect(baileyCleanNumberWithLid({})).toBe('')
            expect(baileyCleanNumberWithLid({ remoteJid: null })).toBe('')
        })
    })

    describe('LID Mapping Functions', () => {
        let mockLidStore: any

        beforeEach(() => {
            mockLidStore = {
                getLIDForPN: jest.fn(),
                getPNForLID: jest.fn(),
                getLIDsForPNs: jest.fn(),
                storeLIDPNMapping: jest.fn(),
                storeLIDPNMappings: jest.fn(),
            }
        })

        describe('baileyGetLIDFromPN', () => {
            it('should return LID for valid PN', async () => {
                mockLidStore.getLIDForPN.mockResolvedValue('user123@lid')
                const result = await baileyGetLIDFromPN(mockLidStore, '1234567890@s.whatsapp.net')
                expect(result).toBe('user123@lid')
                expect(mockLidStore.getLIDForPN).toHaveBeenCalledWith('1234567890@s.whatsapp.net')
            })

            it('should return null when LID not found', async () => {
                mockLidStore.getLIDForPN.mockResolvedValue(null)
                const result = await baileyGetLIDFromPN(mockLidStore, 'unknown@s.whatsapp.net')
                expect(result).toBe(null)
            })

            it('should handle missing lidStore gracefully', async () => {
                const result = await baileyGetLIDFromPN(null, '1234567890@s.whatsapp.net')
                expect(result).toBe(null)
            })

            it('should handle errors gracefully', async () => {
                mockLidStore.getLIDForPN.mockRejectedValue(new Error('Test error'))
                const result = await baileyGetLIDFromPN(mockLidStore, '1234567890@s.whatsapp.net')
                expect(result).toBe(null)
            })
        })

        describe('baileyGetPNFromLID', () => {
            it('should return PN for valid LID', async () => {
                mockLidStore.getPNForLID.mockResolvedValue('1234567890@s.whatsapp.net')
                const result = await baileyGetPNFromLID(mockLidStore, 'user123@lid')
                expect(result).toBe('1234567890@s.whatsapp.net')
                expect(mockLidStore.getPNForLID).toHaveBeenCalledWith('user123@lid')
            })

            it('should return null when PN not found', async () => {
                mockLidStore.getPNForLID.mockResolvedValue(null)
                const result = await baileyGetPNFromLID(mockLidStore, 'unknown@lid')
                expect(result).toBe(null)
            })

            it('should handle missing lidStore gracefully', async () => {
                const result = await baileyGetPNFromLID(null, 'user123@lid')
                expect(result).toBe(null)
            })

            it('should handle errors gracefully', async () => {
                mockLidStore.getPNForLID.mockRejectedValue(new Error('Test error'))
                const result = await baileyGetPNFromLID(mockLidStore, 'user123@lid')
                expect(result).toBe(null)
            })
        })

        describe('baileyGetLIDsFromPNs', () => {
            it('should return mapping for multiple PNs', async () => {
                const mockMapping = {
                    '1234567890@s.whatsapp.net': 'user123@lid',
                    '9876543210@s.whatsapp.net': 'user456@lid',
                }
                mockLidStore.getLIDsForPNs.mockResolvedValue(mockMapping)

                const result = await baileyGetLIDsFromPNs(mockLidStore, [
                    '1234567890@s.whatsapp.net',
                    '9876543210@s.whatsapp.net',
                ])

                expect(result).toEqual(mockMapping)
                expect(mockLidStore.getLIDsForPNs).toHaveBeenCalledWith([
                    '1234567890@s.whatsapp.net',
                    '9876543210@s.whatsapp.net',
                ])
            })

            it('should return empty object when no mappings found', async () => {
                mockLidStore.getLIDsForPNs.mockResolvedValue({})
                const result = await baileyGetLIDsFromPNs(mockLidStore, ['unknown@s.whatsapp.net'])
                expect(result).toEqual({})
            })

            it('should handle errors gracefully', async () => {
                mockLidStore.getLIDsForPNs.mockRejectedValue(new Error('Test error'))
                const result = await baileyGetLIDsFromPNs(mockLidStore, ['test@s.whatsapp.net'])
                expect(result).toEqual({})
            })
        })

        describe('baileyStoreLIDPNMapping', () => {
            it('should store single mapping successfully', async () => {
                mockLidStore.storeLIDPNMapping.mockResolvedValue(undefined)

                await baileyStoreLIDPNMapping(mockLidStore, 'user123@lid', '1234567890@s.whatsapp.net')

                expect(mockLidStore.storeLIDPNMapping).toHaveBeenCalledWith('user123@lid', '1234567890@s.whatsapp.net')
            })

            it('should handle missing lidStore gracefully', async () => {
                await expect(
                    baileyStoreLIDPNMapping(null, 'user123@lid', '1234567890@s.whatsapp.net')
                ).resolves.toBeUndefined()
            })

            it('should handle errors gracefully', async () => {
                mockLidStore.storeLIDPNMapping.mockRejectedValue(new Error('Test error'))

                await expect(
                    baileyStoreLIDPNMapping(mockLidStore, 'user123@lid', '1234567890@s.whatsapp.net')
                ).resolves.toBeUndefined()
            })
        })

        describe('baileyStoreLIDPNMappings', () => {
            it('should store multiple mappings successfully', async () => {
                const mappings = {
                    'user123@lid': '1234567890@s.whatsapp.net',
                    'user456@lid': '9876543210@s.whatsapp.net',
                }
                mockLidStore.storeLIDPNMappings.mockResolvedValue(undefined)

                await baileyStoreLIDPNMappings(mockLidStore, mappings)

                expect(mockLidStore.storeLIDPNMappings).toHaveBeenCalledWith(mappings)
            })

            it('should handle missing lidStore gracefully', async () => {
                await expect(baileyStoreLIDPNMappings(null, {})).resolves.toBeUndefined()
            })

            it('should handle errors gracefully', async () => {
                mockLidStore.storeLIDPNMappings.mockRejectedValue(new Error('Test error'))

                await expect(baileyStoreLIDPNMappings(mockLidStore, {})).resolves.toBeUndefined()
            })
        })
    })
})

describe('LID Functions Integration Tests', () => {
    it('should work together in a realistic scenario', () => {
        // Simulate a message from a user with LID
        const messageKey = {
            remoteJid: 'user123@lid',
            remoteJidAlt: '1234567890@s.whatsapp.net',
            senderPn: '1234567890@s.whatsapp.net',
        }

        // Extract the appropriate identifier
        const identifier = baileyCleanNumberWithLid(messageKey)
        expect(identifier).toBe('1234567890@s.whatsapp.net')

        // Validate the identifier
        expect(baileyIsValidNumber(identifier)).toBe(true)
        expect(baileyIsPN(identifier)).toBe(true)
        expect(baileyIsLID(identifier)).toBe(false)

        // Clean the identifier
        const cleaned = baileyCleanNumber(identifier)
        expect(cleaned).toBe('1234567890@s.whatsapp.net')
    })

    it('should handle group message scenario', () => {
        const messageKey = {
            remoteJid: 'group@g.us',
            participant: 'user456@lid',
            participantAlt: '9876543210@s.whatsapp.net',
        }

        const participant = baileyCleanNumberWithLid(messageKey)
        expect(participant).toBe('9876543210@s.whatsapp.net')
        expect(baileyIsValidNumber(participant)).toBe(true)
        expect(baileyIsPN(participant)).toBe(true)
    })
})
