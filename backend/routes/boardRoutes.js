const express = require('express');
const {
  createBoard,
  getAllBoards,
  getBoardById,
  updateBoard,
} = require('../controllers/boardController');

const router = express.Router();

router.post('/', createBoard);
router.get('/', getAllBoards);
router.get('/:id', getBoardById);
router.put('/:id', updateBoard);

module.exports = router;
