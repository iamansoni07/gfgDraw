import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/boards';

const uiOptions = {
  canvasActions: {
    toggleTheme: true,
    export: false,
    loadScene: false,
    saveToActiveFile: false,
    clearCanvas: false,
    changeViewBackgroundColor: false,
  },
};

const canvasDefaults = {
  viewBackgroundColor: '#f3f6f4',
  gridModeEnabled: false,
};

function Whiteboard({ readOnly = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('Untitled Board');
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [copyStatus, setCopyStatus] = useState(false);

  useEffect(() => {
    if (!id || id === 'new') {
      return;
    }

    let cancelled = false;

    const fetchBoard = async () => {
      try {
        const response = await axios.get(`${API_URL}/${id}`);
        if (cancelled) {
          return;
        }

        setTitle(response.data.title || 'Untitled Board');
        if (excalidrawAPI) {
          excalidrawAPI.updateScene({
            elements: response.data.elements || [],
            appState: canvasDefaults,
          });
        }
      } catch (error) {
        console.error('Failed to load board:', error);
      }
    };

    fetchBoard();

    return () => {
      cancelled = true;
    };
  }, [id, excalidrawAPI]);

  const saveToServer = useCallback(async () => {
    const elements = excalidrawAPI?.getSceneElements() ?? [];
    setSaveStatus('saving');

    try {
      if (id && id !== 'new') {
        await axios.put(`${API_URL}/${id}`, { title, elements });
      } else {
        const response = await axios.post(API_URL, {
          title,
          elements,
          isPublic: true,
        });
        navigate(`/board/${response.data._id}`, { replace: true });
      }

      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1600);
    } catch (error) {
      console.error('Failed to save board:', error);
      setSaveStatus('error');
      window.setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [excalidrawAPI, id, navigate, title]);

  const handleShareLink = async () => {
    const shareUrl = `${window.location.origin}/view/${id}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopyStatus(true);
      window.setTimeout(() => setCopyStatus(false), 2000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const saveLabel =
    saveStatus === 'saving'
      ? 'Saving...'
      : saveStatus === 'saved'
        ? 'Saved!'
        : saveStatus === 'error'
          ? 'Save failed'
          : 'Save Board';

  return (
    <div className={`whiteboard${readOnly ? ' is-readonly' : ''}`}>
      <header className="app-header">
        <div className="header-left">
          {!readOnly && (
            <>
              <Link
                to="/"
                className="back-to-dashboard-btn"
                title="Back to Dashboard"
                aria-label="Back to Dashboard"
              >
                <svg
                  className="back-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>Dashboard</span>
              </Link>
              <span className="header-divider" aria-hidden="true" />
            </>
          )}

          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              GFG
            </span>
            {readOnly ? (
              <h1 className="board-title-static" title={title}>
                {title}
              </h1>
            ) : (
              <input
                className="board-title-input"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-label="Board title"
              />
            )}
          </div>
        </div>

        <div className="header-actions">
          {readOnly ? (
            <span className="student-view-badge">
              <span className="badge-dot" aria-hidden="true" />
              Student View (Read-Only)
            </span>
          ) : (
            <>
              {id && id !== 'new' && (
                <button
                  className={`share-link-btn${copyStatus ? ' is-copied' : ''}`}
                  type="button"
                  onClick={handleShareLink}
                  aria-label="Share student link"
                >
                  {copyStatus ? (
                    <svg
                      className="btn-icon"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      className="btn-icon"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  )}
                  <span>{copyStatus ? 'Link Copied!' : 'Share Link'}</span>
                </button>
              )}

              <button
                className={`save-board-btn${saveStatus === 'saved' ? ' is-saved' : ''}`}
                type="button"
                onClick={saveToServer}
                disabled={saveStatus === 'saving'}
              >
                {saveLabel}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="canvas-stage">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          UIOptions={uiOptions}
          initialData={{ appState: canvasDefaults }}
          gridModeEnabled={false}
          welcomeScreen={false}
          theme="light"
          viewModeEnabled={readOnly}
        />
      </div>
    </div>
  );
}

export default Whiteboard;
