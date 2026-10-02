import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/boards';

function formatDate(dateString) {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Dashboard() {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

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
        setError('Unable to load boards. Please make sure the server is running.');
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

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    axios
      .get(API_URL)
      .then((res) => {
        setBoards(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error('Failed to load boards:', err);
        setError('Unable to load boards. Please make sure the server is running.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const filteredBoards = boards.filter((board) => {
    const title = board.title || 'Untitled Board';
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="dashboard-page">
      {/* Top Navigation Bar */}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              GFG
            </span>
            <div className="brand-info">
              <span className="brand-title">GFG Draw</span>
              <span className="brand-badge">Instructor Dashboard</span>
            </div>
          </div>

          <Link to="/board/new" className="create-board-btn">
            <svg
              className="create-icon"
              width="18"
              height="18"
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
            <span>Create New Board</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="dashboard-main">
        <div className="dashboard-content">
          {/* Subheader with title, stats, and search */}
          <section className="dashboard-toolbar">
            <div className="toolbar-info">
              <h1 className="toolbar-heading">Lecture Boards</h1>
              <p className="toolbar-subtext">
                Manage, organize, and present your interactive whiteboards
              </p>
            </div>

            <div className="toolbar-actions">
              <div className="search-input-wrapper">
                <svg
                  className="search-icon"
                  width="16"
                  height="16"
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
                  className="search-input"
                  aria-label="Search boards by title"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="search-clear-btn"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Loading State */}
          {loading && (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p className="loading-text">Fetching your lecture boards...</p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="error-card">
              <div className="error-icon" aria-hidden="true">
                !
              </div>
              <div className="error-content">
                <h3 className="error-title">Connection Error</h3>
                <p className="error-message">{error}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="retry-btn"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && boards.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon-wrap" aria-hidden="true">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <h2 className="empty-title">No boards created yet</h2>
              <p className="empty-description">
                Get started by creating your first interactive drawing canvas for
                your students.
              </p>
              <Link to="/board/new" className="create-board-btn">
                <svg
                  className="create-icon"
                  width="18"
                  height="18"
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
                <span>Create New Board</span>
              </Link>
            </div>
          )}

          {/* Filter Empty State */}
          {!loading && !error && boards.length > 0 && filteredBoards.length === 0 && (
            <div className="empty-search-state">
              <p className="empty-search-text">
                No boards matched &ldquo;{searchQuery}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="clear-search-btn"
              >
                Clear Search Filter
              </button>
            </div>
          )}

          {/* Modern Grid of Boards */}
          {!loading && !error && filteredBoards.length > 0 && (
            <div className="boards-grid">
              {filteredBoards.map((board) => (
                <Link
                  to={`/board/${board._id}`}
                  key={board._id}
                  className="board-card"
                >
                  <div className="board-card-preview">
                    <div className="preview-canvas-pattern" aria-hidden="true" />
                    <div className="preview-content">
                      <span className="preview-badge">Canvas</span>
                      {Array.isArray(board.elements) && (
                        <span className="element-count">
                          {board.elements.length}{' '}
                          {board.elements.length === 1 ? 'element' : 'elements'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="board-card-body">
                    <h3 className="board-card-title">
                      {board.title?.trim() || 'Untitled Board'}
                    </h3>

                    <div className="board-card-meta">
                      <div className="meta-item">
                        <svg
                          className="meta-icon"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>Updated {formatDate(board.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="board-card-footer">
                      <span className="open-link-label">Open Board</span>
                      <svg
                        className="open-arrow"
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
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
