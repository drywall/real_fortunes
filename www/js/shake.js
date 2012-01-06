//https://raw.github.com/paulb777/NameTrendz/master/www/shaker.js

function roundNumber(num) {
  var dec = 3;
  var result = Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
  return result;
}

var accelerationWatch = null;

var lastX = null;
var lastY, lastZ;

function updateAcceleration(a) {
  
  if (lastX !== null) {  // not first time
    var deltaX = Math.abs(a.x - lastX);
    var deltaY = Math.abs(a.y - lastY);
    var deltaZ = Math.abs(a.z - lastZ);
    
    var changes = 0;
    if (deltaX > 1) changes++;
    if (deltaY > 1) changes++;
    if (deltaZ > 1) changes++;
    
    if (changes >= 2 || deltaX + deltaY + deltaZ > 4) {
      on_shake_event();
    }
  }
  lastX = a.x;
  lastY = a.y;
  lastZ = a.z;
}

var toggleShaker = function() {
  if (accelerationWatch !== null) {
    navigator.accelerometer.clearWatch(accelerationWatch);
    updateAcceleration({
      x : "",
      y : "",
      z : ""
    });
    accelerationWatch = null;
    lastX = null;
  } else {
    var options = {};
    options.frequency = 300;
    accelerationWatch = navigator.accelerometer.watchAcceleration(
        updateAcceleration, function(ex) {
          alert("accel fail (" + ex.name + ": " + ex.message + ")");
        }, options);
  }
};