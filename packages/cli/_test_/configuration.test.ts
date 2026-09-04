import { test } from 'uvu'
import * as assert from 'uvu/assert'

import {
    AVAILABLE_LANGUAGES,
    PROVIDER_LIST,
    Provider,
    PROVIDER_DATA,
    ProviderData,
    ProviderWithHint,
    ProviderWithoutHint,
    validateTemplateCombination,
} from '../src/configuration'

test('PROVIDER_LIST', () => {
    assert.ok(Array.isArray(PROVIDER_LIST))
    PROVIDER_LIST.forEach((provider: Provider) => {
        assert.type(provider.value, 'string')
        assert.type(provider.label, 'string')
        if ('hint' in provider) {
            assert.type(provider.hint, 'string')
        }
    })
})

test('PROVIDER_DATA', () => {
    assert.ok(Array.isArray(PROVIDER_DATA))
    PROVIDER_DATA.forEach((providerData: ProviderData) => {
        assert.type(providerData.value, 'string')
        assert.type(providerData.label, 'string')
    })
})

test('Provider With Hint', () => {
    const providersWithHint = PROVIDER_LIST.filter(
        (provider: Provider): provider is ProviderWithHint => 'hint' in provider
    )
    assert.ok(providersWithHint.length > 0)
    providersWithHint.forEach((providerWithHint) => {
        assert.type(providerWithHint.hint, 'string')
    })
})

test('Provider Without Hint', () => {
    const providersWithoutHint = PROVIDER_LIST.filter(
        (provider: Provider): provider is ProviderWithoutHint => !('hint' in provider)
    )
    assert.ok(providersWithoutHint.length > 0)
    providersWithoutHint.forEach((providerWithoutHint) => {
        assert.not('hint' in providerWithoutHint)
    })
})

test('validateTemplateCombination allows gupshup supported combo', () => {
    const result = validateTemplateCombination({ provider: 'gupshup', language: 'ts', database: 'memory' })
    assert.equal(result.pass, true)
    assert.equal(result.message, '')
})

test('validateTemplateCombination rejects gupshup unsupported combo', () => {
    const result = validateTemplateCombination({ provider: 'gupshup', language: 'js', database: 'memory' })
    assert.equal(result.pass, false)
    assert.match(result.message, /Unsupported template combination for provider gupshup/)
})

test('validateTemplateCombination keeps non-gupshup combos open', () => {
    const result = validateTemplateCombination({ provider: 'baileys', language: 'js', database: 'mongo' })
    assert.equal(result.pass, true)
    assert.equal(result.message, '')
})

test('validateTemplateCombination keeps matrix parity for all combinations', () => {
    for (const provider of PROVIDER_LIST) {
        for (const language of AVAILABLE_LANGUAGES) {
            for (const database of PROVIDER_DATA) {
                const result = validateTemplateCombination({
                    provider: provider.value,
                    language: language.value,
                    database: database.value,
                })

                if (provider.value !== 'gupshup') {
                    assert.equal(result.pass, true)
                    continue
                }

                const isSupported = language.value === 'ts' && database.value === 'memory'
                assert.equal(result.pass, isSupported)
            }
        }
    }
})

test.run()
