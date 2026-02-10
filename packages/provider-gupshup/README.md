<p align="center">
  <a href="https://builderbot.app/">
    <h2 align="center">@builderbot/provider-gupshup</h2>
  </a>
</p>

## Description

Gupshup provider for BuilderBot v1.

## Installation

```bash
npm install @builderbot/provider-gupshup
```

## Quick Start
```typescript
import { createProvider } from '@builderbot/bot'
import { GupshupProvider } from '@builderbot/provider-gupshup'

const adapterProvider = createProvider(GupshupProvider, {
    apiKey: 'YOUR_API_KEY',
    srcName: 'YOUR_APP_NAME',
    phoneNumber: 'YOUR_SOURCE_NUMBER'
})
```
