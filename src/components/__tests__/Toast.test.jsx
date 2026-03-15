import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Toast from '../Toast'

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the message text', () => {
    render(<Toast message="Clip deleted" onDismiss={vi.fn()} />)
    expect(screen.getByText('Clip deleted')).toBeInTheDocument()
  })

  it('renders an Undo button when onUndo is provided', () => {
    render(<Toast message="Deleted" onUndo={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByText('Undo')).toBeInTheDocument()
  })

  it('does not render an Undo button when onUndo is not provided', () => {
    render(<Toast message="Deleted" onDismiss={vi.fn()} />)
    expect(screen.queryByText('Undo')).not.toBeInTheDocument()
  })

  it('calls onUndo when the Undo button is clicked', () => {
    const onUndo = vi.fn()
    render(<Toast message="Deleted" onUndo={onUndo} onDismiss={vi.fn()} />)

    fireEvent.click(screen.getByText('Undo'))

    // onUndo is called after a 100ms setTimeout
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('auto-dismisses after the default duration (3000ms)', () => {
    const onDismiss = vi.fn()
    render(<Toast message="Gone soon" onDismiss={onDismiss} />)

    // After 3000ms the leaving state is set, then 200ms later onDismiss fires
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('auto-dismisses after a custom duration', () => {
    const onDismiss = vi.fn()
    render(<Toast message="Custom" onDismiss={onDismiss} duration={1000} />)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('adds the leaving class before dismissing', () => {
    const onDismiss = vi.fn()
    const { container } = render(<Toast message="Leaving" onDismiss={onDismiss} />)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(container.querySelector('.toast--leaving')).toBeInTheDocument()
  })
})
