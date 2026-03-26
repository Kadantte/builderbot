import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { ChatwootApi } from '../src/chatwootApi'
import { ChatwootPlugin, createChatwootPlugin } from '../src/chatwootPlugin'

const MOCK_CONFIG = {
    token: 'test-token-123',
    url: 'https://chatwoot.example.com',
    accountId: 1,
}

test('createChatwootPlugin returns a ChatwootPlugin instance', () => {
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    assert.instance(plugin, ChatwootPlugin)
})

test('ChatwootPlugin exposes getApi()', () => {
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const api = plugin.getApi()
    assert.instance(api, ChatwootApi)
})

test('ChatwootPlugin getInbox() returns null before attach', () => {
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    assert.is(plugin.getInbox(), null)
})

test('createChatwootPlugin uses default inbox name', () => {
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    assert.instance(plugin, ChatwootPlugin)
})

test('createChatwootPlugin accepts custom inbox name', () => {
    const plugin = createChatwootPlugin({
        ...MOCK_CONFIG,
        inboxName: 'Custom Inbox',
    })
    assert.instance(plugin, ChatwootPlugin)
})

test('ChatwootApi constructs correct base URL', () => {
    const api = new ChatwootApi(MOCK_CONFIG)
    assert.instance(api, ChatwootApi)
})

test('ChatwootApi trims trailing slash from URL', () => {
    const api = new ChatwootApi({
        ...MOCK_CONFIG,
        url: 'https://chatwoot.example.com/',
    })
    assert.instance(api, ChatwootApi)
})

test.run()
