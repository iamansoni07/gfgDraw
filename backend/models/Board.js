const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: 'Untitled Board',
    },
    elements: {
      type: Array,
      default: [],
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Board', boardSchema);
