const { User } = require('../models');
/** Map of user id -> user (for "received by" / "added by" names). */
async function userMap() {
  return new Map((await User.find({}).lean()).map((u) => [String(u._id), u]));
}
module.exports = { userMap };
