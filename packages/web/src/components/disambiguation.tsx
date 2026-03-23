import '../styles/disambiguation.css'

interface DisambiguationProps {
  videoId: string
  listId: string
  onChoose: (choice: 'video' | 'playlist') => void
}

export function Disambiguation({ onChoose }: DisambiguationProps) {
  return (
    <div className="disambiguation">
      <h2>What would you like to import?</h2>
      <p className="disambiguation-hint">This URL contains both a video and a playlist.</p>
      <div className="disambiguation-actions">
        <button className="btn-primary" onClick={() => onChoose('playlist')}>
          Import full playlist
        </button>
        <button className="btn-secondary" onClick={() => onChoose('video')}>
          Just this video
        </button>
      </div>
    </div>
  )
}
