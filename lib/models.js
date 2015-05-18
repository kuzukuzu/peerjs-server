var mongoose = require('mongoose');

exports.init_models = function() {
  var CastSchema =  new mongoose.Schema({
    title: String,
      masterid: String /// socket id
  });
  mongoose.model('Cast', CastSchema);

  var ClientTreeSchema = new mongoose.Schema({
    cast_id: String,
      client_id: String, // socket idj
      node_path: String, // in the shape of /path/to/nodes/parent/
      child_num: Number,
      depth: Number
  });
  ClientTreeSchema.static('removeClientAndRestructing', function(query, callback) {
    var CT = this;
    // TODO: Array入れたほうがよくね？
    CT.find({client_id: query.client_id}, function(err, docs) {
      if (docs.length > 0) {
        var path = docs[0].node_path;
        var found = path.match(/\/([^/]+)\/$/);
        CT.update({client_id: found[1]}, {$inc: {child_num: -1}}, function(err) { });
        CT.remove({_id: docs[0]._id}, function(err) {});
      }
    });
    CT.find({node_path: new RegExp('/' + query.client_id + '/$')}, function(err, docs) {
      if (docs.length === 0) return;
      docs.forEach(function(doc) {
        CT.rebaseClient({_id: doc._id}, function() {});
      });
    });
  });
  ClientTreeSchema.static('rebaseClient', function(query, callback) {
    var CT = this;
    var child_max_num = 3;
    CT.find(query, function(err, docs) {
      var node_to_move = docs[0];

      CT.find({cast_id: node_to_move.cast_id}, {}, {sort: {depth: 1}}, function(err, docs) {
        docs.every(function(doc) {
          if (doc.child_num < child_max_num) {
            CT.update({_id: doc._id}, {$inc: {child_num: 1}}, function(err) { });
            var new_parent = doc;

            CT.find({node_path: new RegExp('^' + node_to_move.node_path)}, function(err, docs) {
              docs.forEach(function(doc) {
                var new_path = doc.node_path.replace(new RegExp('^' + node_to_move.node_path), new_parent.node_path + new_parent.client_id + '/');
                var new_depth = new_path.split('/').length - 2
                doc.set({node_path: new_path, depth: new_depth});
              doc.save();
              });
            });
            return false;
          }
          return true;
        });
      });
    });
  });
  mongoose.model('ClientTree', ClientTreeSchema);
}
