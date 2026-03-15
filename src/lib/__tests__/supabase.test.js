import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase client before importing the module
const mockSingle = vi.fn().mockReturnValue({ data: null, error: null })
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle, data: null, error: null })
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ data: null, error: null }) })
const mockEq = vi.fn()
const mockOrder = vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ data: [], error: null }), data: [], error: null })
const mockLimit = vi.fn().mockReturnValue({ data: [], error: null })
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ data: null, error: null }) })

const mockSubscribe = vi.fn()
const mockOn = vi.fn().mockReturnValue({ on: vi.fn().mockReturnValue({ subscribe: mockSubscribe }), subscribe: mockSubscribe })
const mockChannel = vi.fn().mockReturnValue({ on: mockOn })
const mockRemoveChannel = vi.fn()

// Build a chainable from() mock
const mockFrom = vi.fn().mockImplementation(() => ({
  insert: mockInsert,
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: mockLimit,
        data: [],
        error: null,
      }),
      single: mockSingle,
      data: [],
      error: null,
    }),
  }),
  delete: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ data: null, error: null }),
  }),
  update: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ data: null, error: null }),
  }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
    auth: {
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  })),
}))

// Now import the functions under test
const {
  getClips,
  addClip,
  deleteClip,
  subscribeToClips,
  supabase,
} = await import('../supabase')

describe('getClips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.from("clips") with correct query chain', async () => {
    await getClips('user-123')
    expect(mockFrom).toHaveBeenCalledWith('clips')
  })

  it('passes the userId as a filter', async () => {
    const result = await getClips('user-456', 25)
    expect(mockFrom).toHaveBeenCalledWith('clips')
  })
})

describe('addClip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.from("clips").insert() with correct data', async () => {
    await addClip('user-123', 'device-1', 'hello world', 'note')
    expect(mockFrom).toHaveBeenCalledWith('clips')
  })
})

describe('deleteClip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.from("clips").delete() with the clip id', async () => {
    await deleteClip('clip-99')
    expect(mockFrom).toHaveBeenCalledWith('clips')
  })
})

describe('subscribeToClips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a channel with the user ID', () => {
    const onInsert = vi.fn()
    const onDelete = vi.fn()
    subscribeToClips('user-123', onInsert, onDelete)
    expect(mockChannel).toHaveBeenCalledWith('clips:user-123')
  })

  it('subscribes to postgres_changes for INSERT events', () => {
    const onInsert = vi.fn()
    const onDelete = vi.fn()
    subscribeToClips('user-789', onInsert, onDelete)
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'INSERT',
        schema: 'public',
        table: 'clips',
      }),
      expect.any(Function)
    )
  })

  it('returns an unsubscribe function', () => {
    const unsub = subscribeToClips('user-123', vi.fn(), vi.fn())
    expect(typeof unsub).toBe('function')
  })

  it('calls removeChannel when unsubscribe is invoked', () => {
    const unsub = subscribeToClips('user-123', vi.fn(), vi.fn())
    unsub()
    expect(mockRemoveChannel).toHaveBeenCalled()
  })
})
