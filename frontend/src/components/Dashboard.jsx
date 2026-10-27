import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/boards';

function formatRelativeTime(dateString) {
  if (!dateString) return 'Edited recently';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Edited recently';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Edited just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Edited ${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Edited ${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `Edited ${diffInDays}d ago`;

  return `Edited on ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function Dashboard() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [boardToDelete, setBoardToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const toastTimeoutRef = useRef(null);

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

  // Close card action menus on external click or ESC key
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (!e.target.closest('.card-actions-wrapper')) {
        setActiveMenuId(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveMenuId(null);
        if (!isDeleting) {
          setBoardToDelete(null);
        }
      }
    };

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
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
    setActiveMenuId(null);
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
      showToast('Student view link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
      showToast('Failed to copy share link', 'error');
    }
  };

  const promptDeleteBoard = (e, board) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setBoardToDelete(board);
  };

  const confirmDeleteBoard = async () => {
    if (!boardToDelete) return;
    setIsDeleting(true);

    try {
      await axios.delete(`${API_URL}/${boardToDelete._id}`);
      setBoards((prev) => prev.filter((b) => b._id !== boardToDelete._id));
      showToast('Board removed successfully');
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
      // Default: 'recent'
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });

  const sessionCountText =
    boards.length === 1 ? '1 session stored' : `${boards.length} sessions stored`;

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

      {/* Top Navigation Bar */}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div className="brand-lockup">
            <div className="brand-logo-mark" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <div className="brand-titles">
              <span className="brand-name">GFG Draw</span>
              <span className="brand-divider" aria-hidden="true">/</span>
              <div className="workspace-pill">
                <span className="status-dot-pulse" aria-hidden="true" />
                <span>Instructor Workspace</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/board/new')}
            className="create-board-btn"
          >
            <svg
              className="btn-icon"
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
            <span>New Board</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="dashboard-main">
        <div className="dashboard-container">
          {/* Header & Controls Toolbar */}
          <section className="dashboard-toolbar">
            <div className="toolbar-headline">
              <div className="headline-text-group">
                <h1 className="toolbar-title">Lecture Boards</h1>
                <span className="sessions-count-pill">{sessionCountText}</span>
              </div>
              <p className="toolbar-description">
                Interactive drawings, diagrams, and live lectures created for your students.
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
                  placeholder="Search boards..."
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
                    <option value="alphabetical">Alphabetical (A-Z)</option>
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
            <div className="status-banner error-banner">
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
                  className="btn-icon"
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
                <span>Create Your First Board</span>
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
              <h3 className="empty-search-title">No boards found</h3>
              <p className="empty-search-desc">
                No lecture boards match &ldquo;{searchQuery}&rdquo;. Try another keyword or reset the filter.
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

          {/* Redesigned Board Cards Grid */}
          {!loading && !error && filteredAndSortedBoards.length > 0 && (
            <div className="boards-grid">
              {filteredAndSortedBoards.map((board) => {
                const isMenuOpen = activeMenuId === board._id;
                const elementCount = Array.isArray(board.elements) ? board.elements.length : 0;

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
                    {/* Card Thumbnail / Header Area */}
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
                          {elementCount} {elementCount === 1 ? 'object' : 'objects'}
                        </span>
                      </div>

                      {/* Card Action Menu Toggle */}
                      <div className="card-actions-wrapper">
                        <button
                          type="button"
                          className={`card-menu-trigger ${isMenuOpen ? 'is-active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isMenuOpen ? null : board._id);
                          }}
                          aria-label="More board actions"
                          title="Board options"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div
                            className="card-dropdown-menu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={(e) => handleCopyShareLink(e, board._id)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                              </svg>
                              <span>Copy Share Link</span>
                            </button>

                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                window.open(`/view/${board._id}`, '_blank');
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                              <span>Open Student View</span>
                            </button>

                            <div className="dropdown-divider" />

                            <button
                              type="button"
                              className="dropdown-item dropdown-danger"
                              onClick={(e) => promptDeleteBoard(e, board)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                              <span>Delete Board</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="board-card-body">
                      <div className="board-card-main-info">
                        <h3 className="board-card-title" title={board.title || 'Untitled Board'}>
                          {board.title?.trim() || 'Untitled Board'}
                        </h3>
                        <div className="board-card-timestamp">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span>{formatRelativeTime(board.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Card Footer with Direct Launch CTA */}
                      <div className="board-card-footer">
                        <span className="open-canvas-text">Open Board</span>
                        <svg
                          className="open-canvas-arrow"
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
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
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
                  ? This action cannot be undone and student links will stop functioning.
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
