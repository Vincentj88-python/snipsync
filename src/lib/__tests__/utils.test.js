import { describe, it, expect } from 'vitest'
import { detectType, mapPlatform } from '../utils'

describe('detectType', () => {
  it('returns "link" for HTTP URLs', () => {
    expect(detectType('https://example.com')).toBe('link')
    expect(detectType('http://foo.bar/baz?q=1')).toBe('link')
  })

  it('returns "link" for www URLs without protocol', () => {
    expect(detectType('www.snipsync.xyz')).toBe('link')
    expect(detectType('www.google.com/search?q=test')).toBe('link')
  })

  it('returns "link" for URLs regardless of case', () => {
    expect(detectType('HTTPS://EXAMPLE.COM')).toBe('link')
    expect(detectType('WWW.EXAMPLE.COM')).toBe('link')
  })

  it('returns "address" for street address patterns', () => {
    expect(detectType('123 Main Street')).toBe('address')
    expect(detectType('456 Oak Ave')).toBe('address')
    expect(detectType('789 Elm Road')).toBe('address')
    expect(detectType('10 Park Blvd')).toBe('address')
    expect(detectType('5 Pine Drive')).toBe('address')
    expect(detectType('42 Maple Lane')).toBe('address')
  })

  it('returns "code" for code-like strings with brackets/operators', () => {
    expect(detectType('const x = 5;')).toBe('code')
    expect(detectType('function foo() {}')).toBe('code')
    expect(detectType('arr[0]')).toBe('code')
    expect(detectType('if (a > b) {}')).toBe('code')
  })

  it('returns "note" for plain text', () => {
    expect(detectType('hello world')).toBe('note')
    expect(detectType('buy milk and eggs')).toBe('note')
    expect(detectType('meeting at 3pm')).toBe('note')
  })

  it('returns "note" for long code-like strings over 300 chars', () => {
    const longCode = 'const x = ' + 'a'.repeat(300) + ';'
    expect(detectType(longCode)).toBe('note')
  })
})

describe('mapPlatform', () => {
  it('maps "darwin" to "mac"', () => {
    expect(mapPlatform('darwin')).toBe('mac')
  })

  it('maps "win32" to "windows"', () => {
    expect(mapPlatform('win32')).toBe('windows')
  })

  it('returns "mac" when platform is undefined', () => {
    expect(mapPlatform(undefined)).toBe('mac')
  })

  it('returns "mac" when platform is empty string', () => {
    expect(mapPlatform('')).toBe('mac')
  })

  it('passes through other platform values as-is', () => {
    expect(mapPlatform('linux')).toBe('linux')
  })
})
