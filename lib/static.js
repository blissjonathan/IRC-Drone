"use strict";

const fs           = require('fs');
const ss           = require('tailing-stream');
const Throttle     = require('stream-throttle').Throttle;
const merge        = require('mout/object/merge');

const Server       = require('./_server');

class StaticFeed extends Server {

  constructor(server, opts) {
    super(server, merge({
      video_path     : null,
      video_duration : 0,
    }, opts));
  }

  get_feed() {
    var source = this.options.video_path;
    var readStream = ss.createReadStream(source);
    readStream = readStream.pipe(new Throttle({rate: 5000}));

    console.log("Generate a static feed from ", source);
    return readStream;
  }

}




module.exports = StaticFeed;
