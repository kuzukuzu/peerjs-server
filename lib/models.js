var mongoose = require('mongoose');

exports.init_models = function() {
  var CastSchema =  new mongoose.Schema({
    title: String,
    masterid: String /// socket id
  });
  mongoose.model('Cast', CastSchema);

  var ClientTreeSchema = new mongoose.Schema({
    cast_id: String,
    parent_client_id: String, // socket idj
    child_client_id: String, // socket idj
  });
  ClientTreeSchema.static('removeClientAndRestructing', function(query, callback) {
    var CT = this;
    CT.remove({child_client_id: query.client_id}, function(err) { });
    CT.find({parent_client_id: query.client_id}, function(err, docs) {
      if (docs.length === 0) return;
      docs.forEach(function(doc) {
        CT.findParentCandidate({cast_id: doc.cast_id}, function(err, parent_id) {
          if (!err) {
            doc.parent_client_id = parent_id;
            doc.save();
          }
        });
      });
    });
  });
  ClientTreeSchema.static('rebaseClient', function(query, callback) {
    var CT = this;
    CT.find(query, function(err, docs) {
      if (docs.length === 0) return;
      var node_to_move = docs[0];

      CT.findParentCandidate({cast_id: node_to_move.cast_id}, function(err, parent_id) {
        if (!err) {
          node_to_move.parent_client_id = parent_id;
          node_to_move.save();
          callback(false, parent_id);
        }
      });
    });
  });
  ClientTreeSchema.static('findParentCandidate', (function() {
    var child_max_num = 3;
    var inner_func = function(queue, callback) {
      var CT = this;
      if (queue.length === 0) callback(true, null);
      var parent_id = queue.shift();

      CT.find({parent_client_id: parent_id}, function(err, docs) {
        if (docs.length < child_max_num) {
          callback(false, parent_id);
        } else {
          docs.forEach(function(doc) {
            queue.push(doc.child_client_id);
          });

          inner_func.call(CT, queue, function(err, docs) {
            callback(err, docs);
          });
        }
      });
    }
    return function(query, callback) {
      var CT = this;

      // firstly find master_id of cast
      CT.find({cast_id: query.cast_id, parent_client_id: null}, function(err, docs) {
        if (docs.length === 0) return;
        var queue = [docs[0].child_client_id];

        inner_func.call(CT, queue, function(err, parent_id) {
          callback(err, parent_id);
        });
      });
    };
  })());
  mongoose.model('ClientTree', ClientTreeSchema);
}
