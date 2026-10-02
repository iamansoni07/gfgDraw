const Board = require('../models/Board');

const createBoard = async (req, res) => {
  try {
    const { title, elements, isPublic } = req.body;
    const board = await Board.create({
      title: title?.trim() ? title.trim() : undefined,
      ...(Array.isArray(elements) && { elements }),
      ...(typeof isPublic === 'boolean' && { isPublic }),
    });
    res.status(201).json(board);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create board', error: error.message });
  }
};

const getBoardById = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }
    res.status(200).json(board);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch board', error: error.message });
  }
};

const updateBoard = async (req, res) => {
  try {
    const { elements, title } = req.body;
    const board = await Board.findByIdAndUpdate(
      req.params.id,
      {
        ...(title !== undefined && { title }),
        ...(elements !== undefined && { elements }),
      },
      { new: true, runValidators: true }
    );

    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    res.status(200).json(board);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update board', error: error.message });
  }
};

const getAllBoards = async (req, res) => {
  try {
    const boards = await Board.find().sort({ updatedAt: -1 });
    res.status(200).json(boards);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch boards', error: error.message });
  }
};

module.exports = {
  createBoard,
  getBoardById,
  updateBoard,
  getAllBoards,
};
