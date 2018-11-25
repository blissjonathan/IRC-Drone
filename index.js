var config = require('./config')

const tmi = require('tmi.js')
const haikudos = require('haikudos')
const request = require('request');
var WeightedList = require('js-weighted-list');
var moment = require('moment');
var fs = require('fs');
let huejay = require('huejay');
var arDrone = require('ar-drone');
var mDrone = require('./lib/Drone');
const http = require('http');
const RemoteTCPFeedRelay = require('./lib/static');
var soundplayer = require('play-sound')({player: "./mplayer/mplayer.exe"});
const express = require('express');
const vidapp = express();
var PaVEParser = require('./lib/video/PaVEParser');
var users = [];
var startedGA = false;
var regulars = [];
var channelID = config.channelID;
var reward = '';
var chances = [];
var times = [];
var checklist = [];
var loyalonly = false;
var loyaldays = 1;
let lampClient = null;
var droneClient = null;
var droneIP = null;
var vidstream = null;
var isMoving = false;
var lampuser = null;

var allowDrone = false;
var allowLamp = false;
var isLamp = false;
var isDrone = false;
var lampLight = null;
var lampId = null;
var isGun = false;
var isClaw = false;
var LampIP = null;

var droneSpeed = 400;
var droneSense = 70;
var flightParams = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  altitude: 0,
};

function viewHues() {
  huejay.discover()
  .then(bridges => {
    for (let bridge of bridges) {
      console.log(`Id: ${bridge.id}, IP: ${bridge.ip}`);
      LampIP = bridge.ip;
    }
  })
  .catch(error => {
    console.log(`An error occurred: ${error.message}`);
  });
}
viewHues();

function newLamp(newip = '', newport = 80, newuser = 'jblamp') {
  try {
    lampClient = new huejay.Client({
      host:     LampIP,
      username: config.lampUser,
      timeout:  15000,            // Optional, timeout in milliseconds (15000 is the default)
    });

    lampClient.lights.getAll().then(lights => {
      for (let light of lights) {
        console.log(`Light [${light.id}]: ${light.name}`);
      }
    });


    lampClient.lights.getById(1)
    .then(light => {
      lampLight = light;
      console.log('Found light:');
      console.log(`  Light [${light.id}]: ${light.name}`);
      lampLight.brightness = 254;
      lampLight.hue        = 240;
      lampLight.saturation = 254;

      lampClient.lights.save(lampLight);
    })
    .catch(error => {
      console.log('Could not find light');
      console.log(error.stack);
    });

    isLamp = true;
    console.log('Lamp Connected');
    return;
  } catch(err) {
    console.log(err);
  }
  isLamp = false;
}

function sendData(videostream) {

}

function newDrone() {
  try {
    droneClient = new mDrone({
      autoconnect: true,
    });
  } catch(err) {
    console.log(err);
  }
}

function newDroneOld(newip = '') {
  try {
    droneClient  = arDrone.createClient({
      ip: newip
    });

    console.log(droneClient);
    vidstream = droneClient.getVideoStream();
    var parser = new PaVEParser();
    parser.on('data', function(data) {
      vidoutput.write(data.payload);
    }).on('end', function() {
      vidoutput.end();
    });

    vidstream.pipe(parser);

    droneClient.createRepl();
    isDrone = true;
    console.log('Drone Connected');
    return;
  }
  catch(err) {
    console.log(err);
  }
  isDrone = false;
}

var storage = './assets/';
if (fs.existsSync(storage)) {
  console.log("Storage Online");
} else {
  console.log("Storage Offline");
}

var timePath = storage + 'time-1.txt';
console.log(timePath);
var regularPath = storage + 'regular-1.txt';
console.log(regularPath);

if (fs.existsSync(timePath)) {
  var timeReader = require('readline').createInterface({
    input: require('fs').createReadStream(timePath)
  });
  timeReader.on('line', function (line) {
    console.log("adding existing time: " + line);
    var data = line.split("||");
    var name = data[0];
    var num = parseFloat(data[1]);
    times[name] = num;
  });
  console.log(times);
} else {
  console.log('No time file');
}

if (fs.existsSync(regularPath)) {
  var regularReader = require('readline').createInterface({
    input: require('fs').createReadStream(regularPath)
  });
  regularReader.on('line', function (line) {
    var data = line.split("||");
    var name = data[0];
    var num = parseInt(data[1]);
    regulars[name] = num;
  });
}

function writeTimes() {
  var stream = fs.createWriteStream(timePath);
  stream.once('open', function(fd) {
    for (var key in times) {
      stream.write(key + "||" + times[key] + "\n");
    }
    stream.end();
  });
}

function writeRegulars() {
  var stream = fs.createWriteStream(regularPath);
  stream.once('open', function(fd) {
    for (var key in regulars) {
      stream.write(key + "||" + regulars[key] + "\n");
    }
    stream.end();
  });
}

function emptyFiles() {
  fs.writeFile(regularPath, '', function(){});
  fs.writeFile(timePath, '', function(){});
}

// Valid commands start with:
let commandPrefix = '!'
// Define configuration options:
let opts = {
  identity: {
    username: config.botUser,
    password: config.botAuth
  },
  channels: [
    config.channel
  ]
}

// These are the commands the bot knows (defined below):
let knownCommands = { setSpeed, setSense, setDrone, connectDrone, enableGun, enableClaw, connectLamp, setLamp, takeOff, land, grab, letgo, fire, forward, back, left, right, rl, rr, blink, up, down, color  }


function setLamp(target, context) {
  if(context.username == config.channel) {
    if(allowLamp) {
      allowLamp = false;
      client.say(target, 'Chat Lamp Disabled');
    } else {
      allowLamp = true;
      client.say(target, 'Chat Lamp Enabled');
    }
  }
}

function connectLamp(target, context, params) {
  if(context.username == config.channel) {
    newLamp(params[0]);
    client.say(target, "Lamp Connected");
  }
}

function color(target, context, params) {
  if((allowLamp || context.username == config.channel) && lampClient != null) {
    try {
      console.log(params[0]);
      switch(params[0]) {
        case 'blue':
        lampLight.hue = 42042;
        lampClient.lights.save(lampLight);
        break;
        case 'red':
        lampLight.hue = 0;
        lampClient.lights.save(lampLight);
        break;
        case 'green':
        lampLight.hue = 22204;
        lampClient.lights.save(lampLight);
        break;
        case 'purple':
        lampLight.hue = 52780;
        lampClient.lights.save(lampLight);
        break;
        case 'orange':
        lampLight.hue = 3822;
        lampClient.lights.save(lampLight);
        break;
        case 'yellow':
        lampLight.hue = 11648;
        lampClient.lights.save(lampLight);
        break;
        default:
        try {
          var c = parseInt(params[0]) * 182;
          console.log(c);
          lampLight.hue = c;
          lampClient.lights.save(lampLight);
        } catch(err) {
          console.log('color error: ' + err);
        }
        break;
      }
    } catch(err) {
      console.log('bad command');
    }
  }
}

function setDrone(target, context) {
  if(context.username == config.channel) {
    if(allowDrone) {
      allowDrone = false;
      client.say(target, 'Chat Drone Disabled');
    } else {
      allowDrone = true;
      client.say(target, 'Chat Drone Enabled');
    }
  }
}

function enableGun(target, context) {
  if(context.username == config.channel) {
    if(isGun) {
      isGun = false;
      client.say(target, 'Gun Disabled');
    } else {
      isGun = true;
      client.say(target, 'Gun Enabled');
    }
  }
}

function enableClaw(target, context) {
  if(context.username == config.channel) {
    if(isClaw) {
      isClaw = false;
      client.say(target, 'Claw Disabled');
    } else {
      isClaw = true;
      client.say(target, 'Claw Enabled');
    }
  }
}

function connectDrone(target, context, params) {
  if(context.username == config.channel) {
    newDrone();
    client.say(target, "Drone connected");
  }
}

function setSpeed(target, context, params) {
  if(context.username == config.channel) {
    droneSpeed = parseInt(params[0]);
    client.say(target, 'Set Drone Speed');
  }
}

function setSense(target, context, params) {
  if(context.username == config.channel) {
    droneSense = parseInt(params[0]);
    client.say(target, 'Set Drone Sensitivity');
  }
}

function takeOff(target,context) {
  if(context.username == config.channel && droneClient != null) {
    try {
      droneClient.takeOff();
    } catch(err) {
      console.log(err);
    }
  }
}

function land(target,context) {
  if(context.username == config.channel && droneClient != null) {
    try {
      droneClient.land();
    } catch(err) {
      console.log(err);
    }
  }
}

function grab(target, context){
  if((allowDrone || context.username == config.channel) && droneClient != null && isClaw) {
    try {
      if(!isMoving) {
        droneClient.close();
        soundplayer.play('./sounds/grabbing.mp3', function(err){
          if (err) console.log(err);
        });
      }
    } catch(err) {
      console.log(err);
    }
  }
}

function letgo(target, context){
  if((allowDrone || context.username == config.channel) && droneClient != null && isClaw) {
    try {
      if(!isMoving) {
        droneClient.open();
        soundplayer.play('./sounds/letgo.mp3', function(err){
          if (err) console.log(err);
        });
      }
    } catch(err) {
      console.log(err);
    }
  }
}

function fire(target, context){
  if((allowDrone || context.username == config.channel) && droneClient != null && isGun) {
    try {
      if(!isMoving) {
        droneClient.shoot();
        soundplayer.play('./sounds/shoot.mp3', function(err){
          if (err) console.log(err);
        });
      }
    } catch(err) {
      console.log(err);
    }
  }
}

function forward(target, context){
  if((allowDrone || context.username == config.channel) && droneClient != null) {
    try {
      if(!isMoving) {
        isMoving = true;
        droneClient.setFlightParams({
          yaw: 0,
          pitch: droneSense,
          roll: 0,
          altitude: 0,
        });
        soundplayer.play('./sounds/forward.mp3', function(err){
          if (err) console.log(err);
        });
        var move = setTimeout(() => {
          droneClient.setFlightParams({
            yaw: 0,
            pitch: 0,
            roll: 0,
            altitude: 0,
          });
          isMoving = false;
        }, droneSpeed);
      }
    } catch(err) {
      console.log(err);
    }
  }
}

function back(target, context){
  if((allowDrone || context.username == config.channel) && droneClient != null) {
    try {
      if(!isMoving) {
        isMoving = true;
        droneClient.setFlightParams({
          yaw: 0,
          pitch: -droneSense,
          roll: 0,
          altitude: 0,
        });
        soundplayer.play('./sounds/backward.mp3', function(err){
          if (err) console.log(err);
        });
        var move = setTimeout(() => {
          droneClient.setFlightParams({
            yaw: 0,
            pitch: 0,
            roll: 0,
            altitude: 0,
          });
          isMoving = false;
        }, droneSpeed);
      }
    } catch(err) {
      console.log(err);
    }
  }
}

function up(target, context){
  if((allowDrone || context.username == config.channel) && droneClient != null) {
    try {
      if(!isMoving) {
        isMoving = true;
        droneClient.setFlightParams({
          yaw: 0,
          pitch: 0,
          roll: 0,
          altitude: droneSense,
        });
        soundplayer.play('./sounds/up.mp3', function(err){
          if (err) console.log(err);
        });
        var move = setTimeout(() => {
          droneClient.setFlightParams({
            yaw: 0,
            pitch: 0,
            roll: 0,
            altitude: 0,
          });
          isMoving = false;
        }, droneSpeed);
      }
    } catch(err) {
      console.log(err);
    }
  }
}

function down(target, context){
  if((allowDrone || context.username == config.channel) && droneClient != null) {
    try {
      if(!isMoving) {
        isMoving = true;
        droneClient.setFlightParams({
          yaw: 0,
          pitch: 0,
          roll: 0,
          altitude: -droneSense,
        });
        soundplayer.play('./sounds/down.mp3', function(err){
          if (err) console.log(err);
        });
        var move = setTimeout(() => {
          droneClient.setFlightParams({
            yaw: 0,
            pitch: 0,
            roll: 0,
            altitude: 0,
          });
          isMoving = false;
        }, droneSpeed);
      }
    } catch(err) {
      console.log(err);
    }
  }
}

function blink(target, context, params){
  if((allowDrone || context.username == config.channel) && droneClient != null) {
    try {

    } catch(err) {
      console.log(err);
    }
  }
}

function rr(target, context){
  if((allowDrone || context.username == config.channel) && droneClient != null) {
    try {
      if(!isMoving) {
        isMoving = true;
        droneClient.setFlightParams({
          yaw: droneSense,
          pitch: 0,
          roll: 0,
          altitude: 0,
        });
        soundplayer.play('./sounds/rr.mp3', function(err){
          if (err) console.log(err);
        });
        var move = setTimeout(() => {
          droneClient.setFlightParams({
            yaw: 0,
            pitch: 0,
            roll: 0,
            altitude: 0,
          });
          isMoving = false;
        }, droneSpeed);
      }
    } catch(err) {
      console.log(err);
    }
  }
}

function rl(target, context){
  if((allowDrone || context.username == config.channel) && droneClient != null) {
    try {
      if(!isMoving) {
        isMoving = true;
        droneClient.setFlightParams({
          yaw: -droneSense,
          pitch: 0,
          roll: 0,
          altitude: 0,
        });
        soundplayer.play('./sounds/rl.mp3', function(err){
          if (err) console.log(err);
        });
        var move = setTimeout(() => {
          droneClient.setFlightParams({
            yaw: 0,
            pitch: 0,
            roll: 0,
            altitude: 0,
          });
          isMoving = false;
        }, droneSpeed);
      }
    } catch(err) {
      console.log(err);
    }
  }
}

function left(target, context){
  if((allowDrone || context.username == config.channel) && droneClient != null) {
    try {
      if(!isMoving) {
        isMoving = true;
        droneClient.setFlightParams({
          yaw: 0,
          pitch: 0,
          roll: -droneSense,
          altitude: 0,
        });
        soundplayer.play('./sounds/left.mp3', function(err){
          if (err) console.log(err);
        });
        var move = setTimeout(() => {
          droneClient.setFlightParams({
            yaw: 0,
            pitch: 0,
            roll: 0,
            altitude: 0,
          });
          isMoving = false;
        }, droneSpeed);
      }
    } catch(err) {
      console.log(err);
    }
  }
}

function right(target, context){
  if((allowDrone || context.username == config.channel) && droneClient != null) {
    try {
      if(!isMoving) {
        isMoving = true;
        droneClient.setFlightParams({
          yaw: 0,
          pitch: 0,
          roll: droneSense,
          altitude: 0,
        });
        soundplayer.play('./sounds/right.mp3', function(err){
          if (err) console.log(err);
        });
        var move = setTimeout(() => {
          droneClient.setFlightParams({
            yaw: 0,
            pitch: 0,
            roll: 0,
            altitude: 0,
          });
          isMoving = false;
        }, droneSpeed);
      }
    } catch(err) {
      console.log(err);
    }
  }
}


function chance(target, context, params, gs = false) {
  var score = 1;
  var regularBonus = false;
  var followBonus = false;
  var subBonus = false;

  function checkRest() {
    //Check if active chat user
    if(context.username in regulars) {
      if(regulars[context.username] >= 10) {
        score += 1;
        regularBonus = true;
      }
    }

    if(context.username in times) {
      score += times[context.username];
    }

    if(gs) {
      var message = context.username + ' you\'re already in! You have a ' + score + 'x chance to win!';
      client.say(target, message)
      return;
    }

    var message = context.username + ' you have a ' + score + 'x chance to win the next giveaway. Make sure you follow and hang out in stream to increase your chance!';
    client.say(target, message)
  }

  function followcallback(error, response, body) {
    if (!error && response.statusCode == 200) {
      var info = JSON.parse(body);
      if('channel' in info) {
        score += 1;
        followBonus = true;
      }
    }
    checkRest();
  }

  var urlGet = 'https://api.twitch.tv/kraken/users/' + context.username + '/follows/channels/' + config.channel;

  //Get Follower Info
  var followoptions = {
    url: urlGet,
    headers: {
      'Client-ID': config.clientID
    }
  };

  function nowFollow() {
    request(followoptions, followcallback);
  }

  var suboptions = {
    url: 'https://api.twitch.tv/kraken/users/'+context.username+'/subscriptions/' + config.channel,
    headers: {
      'Client-ID': config.clientID,
      'Authorization': config.clientAuth
    }
  }

  function subcallback(error, response, body) {
    if (!error && response.statusCode == 200) {
      var info = JSON.parse(body);
      if('channel' in info) {
        score += 1;
        subBonus = true;
      }
    }
    nowFollow();
  }

  request(suboptions, subcallback);
}


function setprize(target, context, params) {
  if(context.username == config.channel) {
    reward = params.join(' ');
    var message = 'PogChamp New giveaway prize set: ' + reward + ' PogChamp';
    client.say(target, message)
  }
}

function about(target, context) {
  var message = 'I run giveaways. (!joinGA, !prize)';
  client.say(target, message)
}

function prize(target, context) {
  var message = 'Next giveaway prize is: ' + reward + ' PogChamp';
  client.say(target, message)
}

function startGA(target, context, params) {
  if(!startedGA) {
    if(context.username == config.channel) {
      var message = 'PogChamp GiveAway Started. Type !joinGA to enter! Followers/Regulars get extra chance to win! PogChamp';
      if (params.length) {
        console.log(params);
        msg = params[0];
        days = params[1];
        if(msg == "loyalonly") {
          loyalonly = true;
          if(days != null) {
            if(checkDays = parseInt(days)) {
              loyaldays = checkDays;
            }
          }
          var message = 'PogChamp Loyal Member GiveAway Started. Type !joinGA to enter! Only followers of '+loyaldays+' day(s) can enter! PogChamp';
        }
      }

      users = [];
      startedGA = true;
      console.log('success start')
      client.say(target, message)
      client.say(target, message)
      client.say(target, message)
    }
  }
}

function allTimes() {
  function getRoom() {
    var urlGet = 'https://tmi.twitch.tv/group/user/'+ config.channel + '/chatters';
    //Get Follower Info
    var chatoptions = {
      url: urlGet,
      headers: {
        'Client-ID': config.clientID
      }
    };

    function chatcallback(error, response, body) {
      if (!error && response.statusCode == 200) {
        var info = JSON.parse(body);
        console.log(info['chatters']['viewers']);
        for(var i = 0; i < info['chatters']['viewers'].length; i++) {
          var name = info['chatters']['viewers'][i];
          if(name in times) {
            times[name] += .01;
            console.log('added bonus ' + name);
          } else {
            times[name] = .01;
            console.log('set new bonus ' + name);
          }
        }
        writeTimes();
      } else {
        console.log(error);
      }
    }
    request(chatoptions, chatcallback);
  }

  var channeloptions = {
    url: 'https://api.twitch.tv/helix/streams?user_login=' + config.channel,
    headers: {
      'Client-ID': config.clientID
    }
  };

  function channelcallback(error, response, body) {
    if (!error && response.statusCode == 200) {
      var info = JSON.parse(body);
      if(info['data'][0]) {
        if('type' in info['data'][0]) {
          if(info['data'][0]['type'] == 'live') {
            getRoom();
          }
        } else {
          console.log('not live');
        }
      }
    } else {
      console.log(error);
    }
  }
  request(channeloptions, channelcallback);
}

function checkLoyal(target, context) {
  var t = config.followAuth;
  //Get Follower Info
  var followoptions = {
    url: 'https://api.twitch.tv/kraken/users/' + context.username + '/follows/channels/' + config.channel,
    headers: {
      'Client-ID': config.clientID
    }
  };

  function followcallback(error, response, body) {
    if (!error && response.statusCode == 200) {
      var info = JSON.parse(body);
      if('created_at' in info) {
        var n = info['created_at'].indexOf('T');
        var date = info['created_at'].substring(0,n);
        var hn = info['created_at'].indexOf(':');
        var dhours = info['created_at'].substring(n+1,hn);
        date = date + '-' + dhours;

        var today = new Date();
        var dd = today.getDate();
        var mm = today.getMonth()+1; //January is 0!
        var hours = today.getHours();
        if (hours < 10){
          hours = '0'+hours;
        }

        var yyyy = today.getFullYear();
        if(dd<10){
          dd='0'+dd;
        }
        if(mm<10){
          mm='0'+mm;
        }
        var today = yyyy +'-'+mm+'-' + dd + '-' + hours;
        console.log("Today: " + today);
        console.log("Follow: " + date);
        var a = moment(today, 'YYYY-MM-DD-HH');
        var b = moment(date, 'YYYY-MM-DD-HH');
        var days = a.diff(b, 'days');
        console.log(days);
        if(days >= loyaldays) {
          joinGA(target,context,null,true,true);
          return;
        }
      }
    }
    joinGA(target,context,null,false,true);
  }

  request(followoptions, followcallback);
}

function joinGA(target, context, params, isLoyal = false, hasChecked = false) {
  if(!context.mod) {
    if(startedGA) {
      var followBonus = false;
      var regularBonus = false;
      var subBonus = false;
      var score = 1;
      var time = 0;

      if(loyalonly && !hasChecked) {
        checkLoyal(target,context);
        return;
      } else if(loyalonly && hasChecked) {
        if(!isLoyal) {
          var message = context.username + ' this giveaway is only for followers of at least '+ loyaldays + ' day(s). Follow and watch for a chance next time!';
          client.say(target, message)
          return;
        }
      }

      if(checklist.includes(context.username)) {
        chance(target,context,null,true);
        return;
      }

      var suboptions = {
        url: 'https://api.twitch.tv/kraken/users/'+context.username+'/subscriptions/' + config.channel,
        headers: {
          'Client-ID': config.clientID,
          'Authorization': config.clientAuth
        }
      }

      //Get Follower Info
      var followoptions = {
        url: 'https://api.twitch.tv/kraken/users/' + context.username + '/follows/channels/' + config.channel,
        headers: {
          'Client-ID': config.clientID
        }
      };

      function addUser() {
        //Check if active chat user
        if(context.username in regulars) {
          if(regulars[context.username] >= 10) {
            score += 1;
            regularBonus = true;
          }
        }
        //Always Push
        users.push([context.username, score]);
        chances[context.username] = score;
        checklist.push(context.username);
        console.log(users);
        console.log(chances);


        if(subBonus) {
          var message = context.username + ' thanks for being a subscriber! You\'ve been entered with a '+score+'x chance to win. TwitchLit';
          client.say(target, message);
        } else if(followBonus) {
          var message = context.username + ' thanks for being a follower! You\'ve been entered with a '+score+'x chance to win. TwitchLit';
          client.say(target, message);
        } else if(regularBonus) {
          var message = context.username + ' thanks for being a regular! You\'ve been entered with a '+score+'x chance to win!. TwitchLit';
          client.say(target, message)
        } else {
          var message = context.username + ' entered the giveaway! You have a '+score+'x chance to win PogChamp';
          client.say(target, message)
        }
      }

      function checkTime() {
        if(context.username in times) {
          score += times[context.username];
        }
        addUser();
      }

      function followcallback(error, response, body) {
        if (!error && response.statusCode == 200) {
          var info = JSON.parse(body);
          if('channel' in info) {
            score += 1;
            followBonus = true;
          }
        }
        checkTime();
      }

      function subcallback(error, response, body) {
        if (!error && response.statusCode == 200) {
          var info = JSON.parse(body);
          if('channel' in info) {
            score += 1;
            subBonus = true;
          }
        }
        nowFollow();
      }

      function nowFollow() {
        request(followoptions, followcallback);
      }

      request(suboptions, subcallback);
    } else {
      var message = 'No giveaway running right now FeelsBadMan';
      client.say(target, message)
    }
  } else {
    console.log( context.user + " mod tried to enter");
  }
}

function pickwin(target, context) {
  if(startedGA) {
    if(context.username == config.channel) {
      if (users.length > 0) {
        var wl = new WeightedList(users);
        var winner = wl.peek();
        var message = 'PogChamp '+ winner + ' won the giveaway! PogChamp';
        client.say(target, message)
        client.say(target, message)
        client.say(target, message)
      } else {
        var message = 'No one entered FeelsBadMan';
        client.say(target, message)
      }
    }
  }
}

function endGA(target,context) {
  if(startedGA) {
    if(context.username == config.channel) {
      if(!loyalonly) {
        regulars = [];
        chances = [];
        times = [];
        emptyFiles();
      }

      loyalonly = false;
      loyaldays = 1;
      users = [];
      checklist = [];
      startedGA = false;
      var message = 'TwitchLit Giveaway Finished TwitchLit Thanks for participating TwitchLit';
      client.say(target, message)
    }
  }
}


// Helper function to send the correct type of message:
function sendMessage (target, context, message) {
  if (context['message-type'] === 'whisper') {
    client.whisper(target, message)
  } else {
    client.say(target, message)
  }
}

// Create a client with our options:
let client = new tmi.client(opts)

// Register our event handlers (defined below):
client.on('message', onMessageHandler)
client.on('connected', onConnectedHandler)
client.on('disconnected', onDisconnectedHandler)

// Connect to Twitch:
client.connect()

// Called every time a message comes in:
function onMessageHandler (target, context, msg, self) {
  if (self) { return } // Ignore messages from the bot

  if(context.username in regulars) {
    regulars[context.username]++;
    writeRegulars();
  } else {
    regulars[context.username] = 1;
  }


  // This isn't a command since it has no prefix:
  if (msg.substr(0, 1) !== commandPrefix) {
    return
  }

  // Split the message into individual words:
  const parse = msg.slice(1).split(' ')
  // The command name is the first (0th) one:
  const commandName = parse[0]
  // The rest (if any) are the parameters:
  const params = parse.splice(1)

  // If the command is known, let's execute it:
  if (commandName in knownCommands) {
    // Retrieve the function by its name:
    const command = knownCommands[commandName]
    // Then call the command with parameters:
    command(target, context, params)
    console.log(`* Executed ${commandName} command for ${context.username}`)
  } else {
    console.log(`* Unknown command ${commandName} from ${context.username}`)
  }
}

// Called every time the bot connects to Twitch chat:
function onConnectedHandler (addr, port) {
  console.log(`* Connected to ${addr}:${port}`)
}

// Called every time the bot disconnects from Twitch:
function onDisconnectedHandler (reason) {
  console.log(`Womp womp, disconnected: ${reason}`)
  process.exit(1)
}
