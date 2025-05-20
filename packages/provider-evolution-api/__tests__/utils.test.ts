import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { IncomingMessage } from 'http'
import * as followRedirects from 'follow-redirects'
import * as fs from 'fs'
import mime from 'mime-types'
import path from 'path'
import { generalDownload } from '../src/utils'

// Create proper type for the mocked file handle
interface MockFileHandle {
    on: jest.Mock
    pipe: jest.Mock
    close: jest.Mock
}

// Mock dependencies with properly typed functions
jest.mock('fs', () => {
    const originalModule = jest.requireActual('fs')
    return {
        rename: jest.fn().mockImplementation((oldPath, newPath, callback) => {
            if (callback) callback(null)
        }),
        createWriteStream: jest.fn(),
        existsSync: jest.fn(),
        ...originalModule,
    }
})

jest.mock('follow-redirects', () => ({
    http: { get: jest.fn() },
    https: { get: jest.fn() },
}))

jest.mock('mime-types')

describe('Utils', () => {
    describe('generalDownload', () => {
        let mockFile: MockFileHandle

        beforeEach(() => {
            jest.clearAllMocks()

            // Create a mock file handle with typed callbacks
            mockFile = {
                on: jest.fn().mockImplementation(function (event, callback) {
                    if (event === 'finish') {
                        setTimeout(() => callback(), 0)
                    }
                    return this
                }),
                pipe: jest.fn().mockReturnThis(),
                close: jest.fn(),
            }

            // Mock createWriteStream
            ;(fs.createWriteStream as jest.Mock).mockReturnValue(mockFile as any)

            // Mock existsSync
            ;(fs.existsSync as jest.Mock).mockReturnValue(false)
        })

        test('should download file from URL correctly', async () => {
            // Mock response with content-type
            const mockResponse = {
                headers: { 'content-type': 'image/jpeg' },
                pipe: jest.fn().mockReturnThis(),
            } as unknown as IncomingMessage

            // Mock https.get with proper typing
            ;(followRedirects.https.get as jest.Mock).mockImplementation(function (url, options, callback) {
                callback(mockResponse)
                return { on: jest.fn() }
            })

            // Mock mime-types extension function
            ;(mime.extension as jest.Mock).mockReturnValue('jpg')

            const result = await generalDownload('https://example.com/image.jpg')

            // Check if https.get was called with the correct URL
            expect(followRedirects.https.get).toHaveBeenCalledWith(
                'https://example.com/image.jpg',
                { headers: {} },
                expect.any(Function)
            )

            // Check if the file was processed correctly
            expect(fs.createWriteStream).toHaveBeenCalled()
            expect(mockResponse.pipe).toHaveBeenCalled()

            // Check if result has correct extension
            expect(result).toMatch(/\.jpg$/)
        })

        test('should handle local files correctly', async () => {
            // Mock existsSync to simulate a local file
            ;(fs.existsSync as jest.Mock).mockReturnValue(true)

            // Mock mime-types contentType and extension
            ;(mime.contentType as jest.Mock).mockReturnValue('image/jpeg')
            ;(mime.extension as jest.Mock).mockReturnValue('jpg')

            const localFilePath = '/path/to/local/image.jpg'
            const result = await generalDownload(localFilePath)

            // For local files, it should return the original path
            expect(result).toBe(localFilePath)

            // Should not call http/https get for local files
            expect(followRedirects.https.get).not.toHaveBeenCalled()
            expect(followRedirects.http.get).not.toHaveBeenCalled()
        })

        test('should throw error if unable to determine file extension', async () => {
            // Mock response with no content-type
            const mockResponse = {
                headers: {},
                pipe: jest.fn().mockReturnThis(),
            } as unknown as IncomingMessage

            // Mock https.get with proper typing
            ;(followRedirects.https.get as jest.Mock).mockImplementation(function (url, options, callback) {
                callback(mockResponse)
                return { on: jest.fn() }
            })

            // Mock mime-types extension function to return false (no extension found)
            ;(mime.extension as jest.Mock).mockReturnValue(false)

            // Should throw an error
            await expect(generalDownload('https://example.com/unknown')).rejects.toThrow(
                'Unable to determine file extension'
            )
        })

        test('should use custom path if provided', async () => {
            // Mock response with content-type
            const mockResponse = {
                headers: { 'content-type': 'image/jpeg' },
                pipe: jest.fn().mockReturnThis(),
            } as unknown as IncomingMessage

            // Mock https.get with proper typing
            ;(followRedirects.https.get as jest.Mock).mockImplementation(function (url, options, callback) {
                callback(mockResponse)
                return { on: jest.fn() }
            })

            // Mock mime-types extension function
            ;(mime.extension as jest.Mock).mockReturnValue('jpg')

            const customPath = '/custom/save/path'
            await generalDownload('https://example.com/image.jpg', customPath)

            // Check if createWriteStream used the custom path
            expect(fs.createWriteStream).toHaveBeenCalledWith(expect.stringContaining(customPath))
        })

        test('should handle file download errors', async () => {
            // Create error mock file with properly typed callbacks
            const errorMockFile: MockFileHandle = {
                on: jest.fn().mockImplementation(function (event, callback) {
                    if (event === 'error') {
                        setTimeout(() => callback(new Error('Download error')), 0)
                    }
                    return this
                }),
                pipe: jest.fn().mockReturnThis(),
                close: jest.fn(),
            }

            // Override createWriteStream mock for this test
            ;(fs.createWriteStream as jest.Mock).mockReturnValueOnce(errorMockFile as any)

            // Mock https.get with proper typing
            ;(followRedirects.https.get as jest.Mock).mockImplementation(function (url, options, callback) {
                callback({
                    headers: { 'content-type': 'image/jpeg' },
                    pipe: jest.fn().mockReturnThis(),
                } as unknown as IncomingMessage)
                return { on: jest.fn() }
            })

            // Mock mime-types extension function
            ;(mime.extension as jest.Mock).mockReturnValue('jpg')

            // Should reject with error
            await expect(generalDownload('https://example.com/image.jpg')).rejects.toThrow()
        })
    })
})
