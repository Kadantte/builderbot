import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
ffmpeg.setFfmpegPath(ffmpegInstaller.path)

export interface FormatOptions {
    code: string
    ext: 'mp4' | 'opus' | 'mp3'
}

const formats: Record<string, FormatOptions> = {
    mp3: {
        code: 'libmp3lame',
        ext: 'mp3',
    },
    opus: {
        code: 'libopus',
        ext: 'opus',
    },
    mp4: {
        code: 'aac',
        ext: 'mp4',
    },
}

const convertAudio = async (filePath: string, format: FormatOptions['ext'] = 'opus'): Promise<string> => {
    if (!filePath) {
        throw new Error('filePath is required')
    }
    const opusFilePath = path.join(
        path.dirname(filePath),
        `${path.basename(filePath, path.extname(filePath))}.${formats[format].ext}`
    )

    await new Promise<void>((resolve, reject) => {
        const cmd = ffmpeg(filePath)
            .audioCodec(formats[format].code)
            .audioBitrate(format === 'opus' ? '32k' : '64k')
            .format(formats[format].ext)
            .output(opusFilePath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))

        if (format === 'opus') {
            cmd.audioChannels(1).audioFrequency(48000).outputOptions(['-application voip', '-frame_duration 20'])
        }

        cmd.run()
    })

    return opusFilePath
}

export { convertAudio }
