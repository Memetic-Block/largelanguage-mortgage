export async function* parseSSEStream(
  body: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
): AsyncGenerator<{ choices: { delta: { content?: string } }[] }> {
  const decoder = new TextDecoder()
  let buffer = ''

  // Handle both browser ReadableStream and Node stream
  const stream = body instanceof ReadableStream
    ? body
    : readableStreamFromNode(body)

  const reader = stream.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') return
        try {
          yield JSON.parse(data)
        } catch {
          // malformed chunk — skip
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function readableStreamFromNode(
  stream: NodeJS.ReadableStream,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(
        typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk,
      ))
      stream.on('end', () => controller.close())
      stream.on('error', (err) => controller.error(err))
    },
  })
}