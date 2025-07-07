import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear, delay, parseAnswers } from '../../__mock__/env'
import { addKeyword, createBot, createFlow } from '../../src'

const suiteCase = suite('Bug: Error rename en downloads concurrentes de vehículos')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Reproducir error exacto: rename nissan_sentra_2019_9b355dd41ef23_d`, async ({ database, provider }) => {
    console.log('🚗 PASO 1: Configurando flujo de catálogo de vehículos...')

    // Recrear exactamente el flujo que causa el problema
    const flowVehicleCatalog = addKeyword(['catalogo', 'vehiculos'])
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic('🚗 ¡Bienvenido a nuestro catálogo de vehículos!')
        })
        .addAction(async (_, { flowDynamic }) => {
            console.log('📤 Enviando vehículos con imágenes (aquí puede ocurrir el error)...')

            // Usar las URLs EXACTAS del problema real
            await flowDynamic([
                {
                    body: '1. ¡Hola! Te compartimos una excelente opción que tenemos disponible: Nissan March 2018. ¿Te gustaría agendar una cita para conocerlo en persona o recibir más detalles?',
                    media: 'https://s3.amazonaws.com/stg01maxiaublica/uploads/2024/9/1736/20846553/nissan_march_2018_733073727_d.jpeg',
                },
                {
                    body: '2. ¡Hola! Tenemos disponible esta increíble Toyota Tacoma 2022. Es ideal si buscas potencia y estilo. ¿Quieres que te enviemos más información?',
                    media: 'https://s3.amazonaws.com/stg01maxiaublica/uploads/2025/4/0/21006172/toyota_tacoma_2022_310005426_d.jpeg',
                },
                {
                    body: '3. ¡Hola! Mira esta Omoda C5 2023 que tenemos disponible. Un diseño moderno y excelente equipamiento. ¿Te interesa saber más?',
                    // Sin media como en el ejemplo real
                },
                {
                    // ⚠️ ESTA ES LA URL QUE CAUSA EL PROBLEMA DE RENAME ⚠️
                    body: '4. ¡Hola! Tenemos disponible este Nissan Sentra 2019. Un sedán confiable, cómodo y eficiente. ¿Quieres más detalles o agendar una visita?',
                    media: 'https://s3.amazonaws.com/stg01maxiaublica/uploads/2023/3/3375/20711942/nissan_sentra_2019_9b355dd41ef23_d.jpeg',
                },
                {
                    body: '5. ¡Hola! Checa este Renault Kwid 2023 que tenemos en inventario. Ideal para ciudad, económico y muy práctico. ¿Quieres que te compartamos más info?',
                    // Sin media como en el ejemplo real
                },
            ])
        })
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic('✅ Catálogo enviado. ¿Cuál te interesa?')
        })

    await createBot(
        {
            database,
            flow: createFlow([flowVehicleCatalog]),
            provider,
        },
        {
            // ⚡ Configuración que maximiza la probabilidad de race condition
            queue: {
                timeout: 30000,
                concurrencyLimit: 15, // Alta concurrencia para forzar el problema
            },
        }
    )

    console.log('👥 PASO 2: Simulando múltiples usuarios concurrentes...')

    // Simular exactamente el escenario que causa el error
    const users = [
        '5217461127733', // Usuario original del ejemplo
        '5217461127734',
        '5217461127735',
        '5217461127736',
        '5217461127737',
        '5217461127738',
        '5217461127739',
        '5217461127740',
    ]

    console.log(`🔥 Enviando ${users.length} peticiones SIMULTÁNEAS para forzar race condition...`)

    // ⚡ CRÍTICO: Enviar TODAS las peticiones SIN delay para maximizar race condition
    const startTime = Date.now()
    await Promise.all(users.map((user) => provider.delaySendMessage(0, 'message', { from: user, body: 'catalogo' })))

    console.log('⏱️ Todas las peticiones enviadas. Esperando procesamiento de downloads...')

    // Esperar suficiente tiempo para que se procesen todas las descargas
    await delay(10000)

    const endTime = Date.now()
    console.log(`⏱️ Procesamiento completado en ${endTime - startTime}ms`)

    const history = parseAnswers(database.listHistory)
    const answers = history.map((item) => item.answer)

    console.log('📊 RESULTADOS DEL TEST:')

    // Contar respuestas por vehículo
    const catalogStarts = answers.filter((a) => a.includes('Bienvenido a nuestro catálogo')).length
    const nissanMarchCount = answers.filter((a) => a.includes('Nissan March 2018')).length
    const toyotaTacomaCount = answers.filter((a) => a.includes('Toyota Tacoma 2022')).length
    const omodaC5Count = answers.filter((a) => a.includes('Omoda C5 2023')).length
    const nissanSentraCount = answers.filter((a) => a.includes('Nissan Sentra 2019')).length // ← Problemática
    const renaultKwidCount = answers.filter((a) => a.includes('Renault Kwid 2023')).length
    const catalogCompleted = answers.filter((a) => a.includes('Catálogo enviado')).length

    console.log(`   📈 Catálogos iniciados: ${catalogStarts}/${users.length}`)
    console.log(`   🚗 Nissan March enviados: ${nissanMarchCount}/${users.length}`)
    console.log(`   🚗 Toyota Tacoma enviados: ${toyotaTacomaCount}/${users.length}`)
    console.log(`   🚗 Omoda C5 enviados: ${omodaC5Count}/${users.length}`)
    console.log(`   🚗 Nissan Sentra enviados: ${nissanSentraCount}/${users.length} ← ⚠️ URL PROBLEMÁTICA`)
    console.log(`   🚗 Renault Kwid enviados: ${renaultKwidCount}/${users.length}`)
    console.log(`   ✅ Catálogos completados: ${catalogCompleted}/${users.length}`)

    // Verificaciones del test
    assert.ok(catalogStarts >= users.length / 2, `Al menos la mitad de los catálogos deben iniciarse`)

    // El test debe detectar si el error de rename afecta específicamente al Nissan Sentra
    if (nissanSentraCount < nissanMarchCount || nissanSentraCount < toyotaTacomaCount) {
        console.log('⚠️ POSIBLE BUG DETECTADO: Nissan Sentra tiene menos éxito que otros vehículos')
        console.log('   Esto podría indicar errores de rename en la URL problemática')
    }

    // Verificar que el sistema no falla completamente
    assert.ok(catalogStarts >= 3, `Al menos 3 usuarios deben recibir respuesta`)
    assert.ok(nissanMarchCount >= 1, `Al menos 1 Nissan March debe enviarse`)

    console.log('✅ Test completado - Sistema evaluado bajo condiciones de race condition')
})

suiteCase(`Aislar problema: múltiples descargas de la MISMA URL`, async ({ database, provider }) => {
    console.log('🔍 PASO 3: Test aislado - misma URL múltiples veces...')

    const flowSameUrl = addKeyword(['same-url'])
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic('🔍 Enviando la MISMA imagen múltiples veces para forzar el error...')
        })
        .addAction(async (_, { flowDynamic }) => {
            // Usar la URL problemática específica 5 veces
            const problematicUrl =
                'https://s3.amazonaws.com/stg01maxiaublica/uploads/2023/3/3375/20711942/nissan_sentra_2019_9b355dd41ef23_d.jpeg'

            await flowDynamic([
                { body: 'Descarga 1 - Nissan Sentra', media: problematicUrl },
                { body: 'Descarga 2 - Nissan Sentra', media: problematicUrl },
                { body: 'Descarga 3 - Nissan Sentra', media: problematicUrl },
                { body: 'Descarga 4 - Nissan Sentra', media: problematicUrl },
                { body: 'Descarga 5 - Nissan Sentra', media: problematicUrl },
            ])
        })
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic('✅ Test de múltiples descargas completado')
        })

    await createBot({
        database,
        flow: createFlow([flowSameUrl]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', { from: '5217461127733', body: 'same-url' })

    await delay(6000)

    const history = parseAnswers(database.listHistory)
    const answers = history.map((item) => item.answer)

    const downloadsCount = answers.filter((a) => a.includes('Descarga') && a.includes('Nissan Sentra')).length

    console.log('🔍 RESULTADOS TEST AISLADO:')
    console.log(`   📥 Descargas procesadas: ${downloadsCount}/5`)

    if (downloadsCount < 5) {
        console.log('⚠️ PROBLEMA CONFIRMADO: No todas las descargas se completaron')
        console.log('   Esto confirma el error de rename con URLs duplicadas')
    }

    assert.ok(answers.includes('✅ Test de múltiples descargas completado'))
    assert.ok(downloadsCount >= 1, `Al menos 1 descarga debe completarse`)

    console.log('✅ Test aislado completado')
})

suiteCase(`Verificar comportamiento bajo alta carga`, async ({ database, provider }) => {
    console.log('⚡ PASO 4: Test de alta carga como en producción...')

    const flowHighLoad = addKeyword(['carga'])
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic('⚡ Simulando carga de producción...')
        })
        .addAction(async (_, { flowDynamic }) => {
            // Mix de URLs reales + URLs duplicadas para simular escenario real
            await flowDynamic([
                {
                    body: 'Auto 1',
                    media: 'https://s3.amazonaws.com/stg01maxiaublica/uploads/2024/9/1736/20846553/nissan_march_2018_733073727_d.jpeg',
                },
                {
                    body: 'Auto 2',
                    media: 'https://s3.amazonaws.com/stg01maxiaublica/uploads/2023/3/3375/20711942/nissan_sentra_2019_9b355dd41ef23_d.jpeg',
                }, // Problemática
                {
                    body: 'Auto 3',
                    media: 'https://s3.amazonaws.com/stg01maxiaublica/uploads/2025/4/0/21006172/toyota_tacoma_2022_310005426_d.jpeg',
                },
                {
                    body: 'Promoción',
                    media: 'https://s3.amazonaws.com/stg01maxiaublica/uploads/2023/3/3375/20711942/nissan_sentra_2019_9b355dd41ef23_d.jpeg',
                }, // Duplicada
                {
                    body: 'Oferta',
                    media: 'https://s3.amazonaws.com/stg01maxiaublica/uploads/2024/9/1736/20846553/nissan_march_2018_733073727_d.jpeg',
                }, // Duplicada
            ])
        })

    await createBot(
        {
            database,
            flow: createFlow([flowHighLoad]),
            provider,
        },
        {
            queue: {
                timeout: 20000,
                concurrencyLimit: 20,
            },
        }
    )

    // 12 usuarios concurrentes para simular carga real
    const highLoadUsers = Array(12)
        .fill(0)
        .map((_, i) => `load_user_${i + 1}`)

    console.log(`⚡ Simulando ${highLoadUsers.length} usuarios concurrentes...`)

    await Promise.all(
        highLoadUsers.map((user, index) =>
            provider.delaySendMessage(index * 25, 'message', { from: user, body: 'carga' })
        )
    )

    await delay(8000)

    const history = parseAnswers(database.listHistory)
    const answers = history.map((item) => item.answer)

    const loadStarts = answers.filter((a) => a.includes('Simulando carga')).length
    const autoMessages = answers.filter(
        (a) => a.includes('Auto') || a.includes('Promoción') || a.includes('Oferta')
    ).length

    console.log('⚡ RESULTADOS ALTA CARGA:')
    console.log(`   🚀 Tests iniciados: ${loadStarts}/${highLoadUsers.length}`)
    console.log(`   🚗 Mensajes de autos procesados: ${autoMessages}`)

    assert.ok(loadStarts >= highLoadUsers.length * 0.6, `Al menos 60% de tests debe iniciarse`)

    console.log('✅ Test de alta carga completado')
})

suiteCase.run()
