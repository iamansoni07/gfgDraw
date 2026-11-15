import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/boards';

function formatFriendlyDate(dateString) {
  if (!dateString) return 'Updated recently';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Updated recently';

  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0 && date.getDate() === now.getDate()) {
    return 'Updated today';
  }
  if (diffInDays <= 1 && date.getDate() === now.getDate() - 1) {
    return 'Updated yesterday';
  }
  if (diffInDays < 7) {
    return `Updated ${diffInDays}d ago`;
  }

  return `Updated ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function Dashboard({ theme = 'light', onToggleTheme }) {
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [copiedId, setCopiedId] = useState(null);
  const [boardToDelete, setBoardToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const toastTimeoutRef = useRef(null);
  const copyTimeoutRef = useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  useEffect(() => {
    let cancelled = false;

    const fetchBoards = async () => {
      try {
        const response = await axios.get(API_URL);
        if (cancelled) return;
        setBoards(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load boards:', err);
        setError('Unable to load lecture boards. Ensure the backend server is running.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchBoards();

    return () => {
      cancelled = true;
    };
  }, []);

  // Handle ESC key for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (!isDeleting) {
          setBoardToDelete(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDeleting]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    axios
      .get(API_URL)
      .then((res) => {
        setBoards(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error('Failed to reload boards:', err);
        setError('Unable to load lecture boards. Ensure the backend server is running.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleCopyShareLink = async (e, boardId) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/view/${boardId}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedId(boardId);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 2000);

      showToast('Student view link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
      showToast('Failed to copy share link', 'error');
    }
  };

  const promptDeleteBoard = (e, board) => {
    e.stopPropagation();
    setBoardToDelete(board);
  };

  const confirmDeleteBoard = async () => {
    if (!boardToDelete) return;
    setIsDeleting(true);

    try {
      await axios.delete(`${API_URL}/${boardToDelete._id}`);
      setBoards((prev) => prev.filter((b) => b._id !== boardToDelete._id));
      showToast('Board deleted successfully');
      setBoardToDelete(null);
    } catch (err) {
      console.error('Failed to delete board:', err);
      showToast('Failed to delete board. Please try again.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredAndSortedBoards = boards
    .filter((board) => {
      const title = board.title || 'Untitled Board';
      return title.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'alphabetical') {
        const titleA = (a.title || 'Untitled Board').toLowerCase();
        const titleB = (b.title || 'Untitled Board').toLowerCase();
        return titleA.localeCompare(titleB);
      }
      if (sortBy === 'oldest') {
        return new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0);
      }
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });

  const sessionCountText = `${boards.length} ${boards.length === 1 ? 'session' : 'sessions'}`;

  return (
    <div className="dashboard-page">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`dashboard-toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}
          role="status"
          aria-live="polite"
        >
          {toast.type === 'error' ? (
            <svg
              className="toast-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg
              className="toast-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div className="brand-lockup">
            <div className="brand-badge">
              <span className="brand-code-symbol">[ &#123; &#125; ]</span>
              <span className="brand-title-text">GFG Draw</span>
            </div>
            <span className="brand-divider" aria-hidden="true">/</span>
            <div className="workspace-pill">
              <span className="status-dot-pulse" aria-hidden="true" />
              <span>Instructor Workspace</span>
            </div>
          </div>

          <div className="header-right-actions">
            {/* Theme Toggle Button */}
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? (
                /* Sun Icon */
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                /* Moon Icon */
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Open Infinite Canvas Button */}
            <button
              type="button"
              onClick={() => navigate('/canvas')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#2F9E44] bg-[#2F9E44]/10 hover:bg-[#2F9E44]/20 border border-[#2F9E44]/30 transition-all flex items-center gap-1.5 shadow-sm"
              title="Launch Infinite Whiteboard (JSON Canvas 1.0 + Realtime Multiplayer)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>Infinite Canvas</span>
            </button>

            {/* Create New Board Button */}
            <button
              type="button"
              onClick={() => navigate('/board/new')}
              className="create-board-btn"
            >
              <svg
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
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>+ Create New Board</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="dashboard-main">
        <div className="dashboard-container">
          {/* Action / Filter Strip */}
          <section className="dashboard-toolbar">
            <div className="toolbar-headline">
              <div className="headline-text-group">
                <h1 className="toolbar-title">Lecture Whiteboards</h1>
                <span className="sessions-count-pill">{sessionCountText}</span>
              </div>
              <p className="toolbar-description">
                Interactive drawings, blueprints, and live lecture visual aids for your students.
              </p>
            </div>

            <div className="toolbar-controls">
              {/* Search Bar */}
              <div className="search-field">
                <svg
                  className="search-field-icon"
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
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search whiteboards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-field-input"
                  aria-label="Search boards by title"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="search-clear-action"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Sort Control */}
              <div className="sort-control">
                <label htmlFor="board-sort-select" className="sort-label">Sort:</label>
                <div className="sort-select-wrapper">
                  <select
                    id="board-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="sort-select"
                    aria-label="Sort lecture boards"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="alphabetical">Title A-Z</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                  <svg
                    className="sort-caret"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>
          </section>

          {/* Loading Skeleton State */}
          {loading && (
            <div className="boards-grid">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="skeleton-card" aria-hidden="true">
                  <div className="skeleton-preview shimmer" />
                  <div className="skeleton-body">
                    <div className="skeleton-title shimmer" />
                    <div className="skeleton-subtitle shimmer" />
                    <div className="skeleton-footer shimmer" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Connection Error State */}
          {!loading && error && (
            <div className="status-banner">
              <div className="banner-icon-wrap" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="banner-content">
                <h3 className="banner-title">Failed to load boards</h3>
                <p className="banner-text">{error}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="banner-action-btn"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}

          {/* Empty State - No boards in database */}
          {!loading && !error && boards.length === 0 && (
            <div className="empty-state-card">
              <div className="empty-state-art" aria-hidden="true">
                <div className="empty-art-circle">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              </div>
              <h2 className="empty-state-title">No lecture boards created yet</h2>
              <p className="empty-state-text">
                Your workspace is ready. Launch a new drawing canvas to prepare sketches, architectural blueprints, or code walkthroughs.
              </p>
              <button
                type="button"
                onClick={() => navigate('/board/new')}
                className="create-board-btn"
              >
                <svg
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
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Create your first lecture board</span>
              </button>
            </div>
          )}

          {/* Empty State - Search Query Yielded 0 Matches */}
          {!loading && !error && boards.length > 0 && filteredAndSortedBoards.length === 0 && (
            <div className="empty-search-card">
              <div className="empty-search-icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h3 className="empty-search-title">No matching boards found</h3>
              <p className="empty-search-desc">
                No whiteboards matched &ldquo;{searchQuery}&rdquo;. Try another term or clear the filter.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="clear-search-action-btn"
              >
                Clear Search Filter
              </button>
            </div>
          )}

          {/* Board Cards Grid */}
          {!loading && !error && filteredAndSortedBoards.length > 0 && (
            <div className="boards-grid">
              {filteredAndSortedBoards.map((board) => {
                const elementCount = Array.isArray(board.elements) ? board.elements.length : 0;
                const isCopied = copiedId === board._id;

                return (
                  <div
                    key={board._id}
                    className="board-card"
                    tabIndex={0}
                    onClick={() => navigate(`/board/${board._id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/board/${board._id}`);
                      }
                    }}
                    role="button"
                    aria-label={`Open board: ${board.title || 'Untitled Board'}`}
                  >
                    {/* Card Preview Banner */}
                    <div className="board-card-thumbnail">
                      <div className="canvas-grid-art" aria-hidden="true" />
                      <div className="thumbnail-badge-row">
                        <span className="diagram-pill">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                          </svg>
                          <span>Canvas</span>
                        </span>

                        <span className="elements-count-badge">
                          {elementCount} {elementCount === 1 ? 'node/shape' : 'nodes/shapes'}
                        </span>
                      </div>

                      {/* Quick Action Buttons (Copy & Delete) */}
                      <div className="card-quick-actions">
                        <button
                          type="button"
                          className={`card-action-icon-btn ${isCopied ? 'is-copied' : ''}`}
                          onClick={(e) => handleCopyShareLink(e, board._id)}
                          aria-label="Copy Share Link"
                          title={isCopied ? 'Link Copied!' : 'Copy Share Link'}
                        >
                          {isCopied ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="18" cy="5" r="3" />
                              <circle cx="6" cy="12" r="3" />
                              <circle cx="18" cy="19" r="3" />
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                          )}
                        </button>

                        <button
                          type="button"
                          className="card-action-icon-btn btn-danger"
                          onClick={(e) => promptDeleteBoard(e, board)}
                          aria-label="Delete Board"
                          title="Delete Board"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="board-card-body">
                      <div className="board-card-main-info">
                        <h3 className="board-card-title" title={board.title || 'Untitled Board'}>
                          {board.title?.trim() || 'Untitled Board'}
                        </h3>
                        <div className="board-card-timestamp">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span>{formatFriendlyDate(board.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="board-card-footer">
                        <span className="open-canvas-link">
                          <span>Open Canvas</span>
                          <svg
                            className="open-canvas-arrow"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {boardToDelete && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!isDeleting) setBoardToDelete(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div
            className="modal-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-danger-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div className="modal-title-group">
                <h3 id="delete-dialog-title" className="modal-title">Delete Lecture Board</h3>
                <p className="modal-description">
                  Are you sure you want to permanently delete{' '}
                  <strong className="modal-highlight">
                    &ldquo;{boardToDelete.title || 'Untitled Board'}&rdquo;
                  </strong>
                  ? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => setBoardToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn-delete"
                onClick={confirmDeleteBoard}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Board'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
