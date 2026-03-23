import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ImportComplete } from '../components/import-complete'

const defaultProps = {
  cardId: 'card-123',
  imported: 1,
  total: 1,
  skipped: [] as Array<{ title: string; reason: string }>,
  onViewCard: vi.fn(),
  onImportAnother: vi.fn(),
}

describe('ImportComplete', () => {
  it('shows correct text for single track', () => {
    render(<ImportComplete {...defaultProps} />)

    expect(screen.getByText('Track added!')).toBeInTheDocument()
  })

  it('shows imported/total for multi-track', () => {
    render(<ImportComplete {...defaultProps} imported={18} total={20} />)

    expect(screen.getByText('18/20 tracks imported')).toBeInTheDocument()
  })

  it('shows skipped track details', () => {
    render(
      <ImportComplete
        {...defaultProps}
        imported={2}
        total={3}
        skipped={[{ title: 'Bad Song', reason: 'Too long' }]}
      />,
    )

    expect(screen.getByText('Bad Song')).toBeInTheDocument()
    expect(screen.getByText('Too long')).toBeInTheDocument()
  })

  it('shows cancelled state', () => {
    render(<ImportComplete {...defaultProps} imported={12} total={20} cancelled />)

    expect(screen.getByText(/12/)).toBeInTheDocument()
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument()
  })

  it('calls onViewCard with cardId when View Card is clicked', () => {
    const onViewCard = vi.fn()
    render(<ImportComplete {...defaultProps} onViewCard={onViewCard} />)

    fireEvent.click(screen.getByText('View Card'))
    expect(onViewCard).toHaveBeenCalledWith('card-123')
  })

  it('calls onImportAnother when Import Another is clicked', () => {
    const onImportAnother = vi.fn()
    render(<ImportComplete {...defaultProps} onImportAnother={onImportAnother} />)

    fireEvent.click(screen.getByText('Import Another'))
    expect(onImportAnother).toHaveBeenCalledOnce()
  })
})
