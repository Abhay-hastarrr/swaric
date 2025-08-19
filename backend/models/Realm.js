const mongoose = require('mongoose');

const realmSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Larger default map (rows x cols)
    mapData: { type: [[Number]], required: true, default: () => Array.from({ length: 12 }, () => Array(20).fill(0)) },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Realm', realmSchema);


